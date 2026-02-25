import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { embedManyWithFallback, withFallback } from '@/lib/llm';
import { embedMany, generateObject } from 'ai';
import { z } from 'zod';
import { extractMarkdownFromPdf } from '@/lib/llamaparse';
import { sendProgress, sendComplete, sendError } from '@/lib/progress';

// ── Schemas ─────────────────────────────────────────────────────────────

// Phase 1: Syllabus Skeleton
const structureSchema = z.object({
    topics: z.array(z.object({
        id: z.string(),
        title: z.string(),
        subtopics: z.array(z.object({
            id: z.string(),
            title: z.string(),
            concepts: z.array(z.object({
                id: z.string(),
                title: z.string(),
                content: z.string().optional()
            }))
        }))
    }))
});

// Phase 2: Atlas — boundary markers for each subtopic in the text
const atlasSchema = z.object({
    segments: z.array(z.object({
        subtopic_id: z.string().describe('The subtopic ID from the syllabus'),
        topic_name: z.string().describe('The parent topic title'),
        subtopic_name: z.string().describe('The subtopic title'),
        start_text_quote: z.string().describe('A unique ~10-20 char phrase from the document where this subtopic begins'),
        end_text_quote: z.string().describe('A unique ~10-20 char phrase from the document where this subtopic ends'),
    }))
});

export const maxDuration = 300;

// ── Constants ───────────────────────────────────────────────────────────
const CHUNK_SIZE = 3000;
const EMBED_BATCH_SIZE = 50;
const EMBED_CONCURRENCY = 5;  // Parallel embedding batches
const DB_INSERT_BATCH_SIZE = 50;

// ── Helpers ─────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
    const rawChunks = text.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) || [];
    return rawChunks.filter(c => c.trim().length > 50).map(c => c.trim());
}

/**
 * Find the character index of a quote in the text using fuzzy matching.
 * Tries exact match first, then progressively shorter substrings.
 */
function findQuoteIndex(text: string, quote: string): number {
    if (!quote) return -1;
    const cleaned = quote.trim();

    // Exact match
    const exact = text.indexOf(cleaned);
    if (exact !== -1) return exact;

    // Try progressively shorter substrings (from the start of the quote)
    for (let len = Math.min(cleaned.length, 40); len >= 8; len -= 2) {
        const sub = cleaned.slice(0, len);
        const idx = text.indexOf(sub);
        if (idx !== -1) return idx;
    }

    // Case-insensitive fallback
    const lower = text.toLowerCase();
    const lowerQuote = cleaned.toLowerCase();
    const ciIdx = lower.indexOf(lowerQuote);
    if (ciIdx !== -1) return ciIdx;

    for (let len = Math.min(lowerQuote.length, 40); len >= 8; len -= 2) {
        const sub = lowerQuote.slice(0, len);
        const idx = lower.indexOf(sub);
        if (idx !== -1) return idx;
    }

    return -1;
}

/**
 * Tag chunks using atlas segments (in-memory, O(N) scan — no AI calls).
 */
function tagChunksWithAtlas(
    text: string,
    chunks: string[],
    segments: z.infer<typeof atlasSchema>['segments'],
): { content: string; topic_name: string; subtopic_name: string }[] {

    // Build sorted boundary ranges
    const ranges: { start: number; end: number; topic_name: string; subtopic_name: string }[] = [];

    for (const seg of segments) {
        const start = findQuoteIndex(text, seg.start_text_quote);
        const end = findQuoteIndex(text, seg.end_text_quote);

        if (start !== -1) {
            ranges.push({
                start,
                end: end !== -1 ? end + seg.end_text_quote.length : text.length,
                topic_name: seg.topic_name,
                subtopic_name: seg.subtopic_name,
            });
        }
    }

    // Sort by start position
    ranges.sort((a, b) => a.start - b.start);

    // For each chunk, find which range it falls into
    let currentCharPos = 0;
    return chunks.map((chunk) => {
        const chunkStart = text.indexOf(chunk, Math.max(0, currentCharPos - 200));
        const chunkMid = chunkStart !== -1
            ? chunkStart + Math.floor(chunk.length / 2)
            : currentCharPos;

        // Advance position tracker
        if (chunkStart !== -1) {
            currentCharPos = chunkStart + chunk.length;
        }

        // Find the range this chunk's midpoint falls into
        let bestMatch = { topic_name: 'General', subtopic_name: 'Overview' };
        for (const range of ranges) {
            if (chunkMid >= range.start && chunkMid <= range.end) {
                bestMatch = { topic_name: range.topic_name, subtopic_name: range.subtopic_name };
                break;
            }
        }

        // Fallback: assign to nearest preceding range
        if (bestMatch.topic_name === 'General' && ranges.length > 0) {
            for (let i = ranges.length - 1; i >= 0; i--) {
                if (ranges[i].start <= chunkMid) {
                    bestMatch = { topic_name: ranges[i].topic_name, subtopic_name: ranges[i].subtopic_name };
                    break;
                }
            }
        }

        return { content: chunk, ...bestMatch };
    });
}

/**
 * Run async tasks with concurrency limit.
 */
async function runWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number,
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < tasks.length) {
            const idx = nextIndex++;
            results[idx] = await tasks[idx]();
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
    return results;
}

// ── Main Route ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const stream = new ReadableStream({
        async start(controller) {
            try {
                const formData = await req.formData();
                const file = formData.get('file') as File;
                const suppFiles = formData.getAll('suppFiles') as File[];
                const title = formData.get('title') as string;

                if (!file || !title) {
                    sendError(controller, 'Please provide a title and upload a file.');
                    controller.close();
                    return;
                }

                const subjectId = title.toLowerCase().replace(/\s+/g, '-');

                // ════════════════════════════════════════════════════════
                // STEP A: Extract text with LlamaParse
                // ════════════════════════════════════════════════════════
                sendProgress(controller, 'Reading your PDF', 5, `Opening "${file.name}"…`);

                const mainText = await extractMarkdownFromPdf(file);
                sendProgress(controller, 'Reading your PDF', 15, 'Main document processed');

                let suppTextCombined = '';
                if (suppFiles && suppFiles.length > 0) {
                    for (let i = 0; i < suppFiles.length; i++) {
                        sendProgress(controller, 'Reading your materials', 15 + Math.round((i / suppFiles.length) * 10), `Processing file ${i + 1} of ${suppFiles.length}…`);
                        const text = await extractMarkdownFromPdf(suppFiles[i]);
                        suppTextCombined += `\n--- Supplementary Document: ${suppFiles[i].name} ---\n${text}`;
                    }
                }
                sendProgress(controller, 'Reading your materials', 25, 'All documents read');

                // ════════════════════════════════════════════════════════
                // STEP B: Generate Syllabus Skeleton (1 LLM call)
                // ════════════════════════════════════════════════════════
                sendProgress(controller, 'Building course outline', 28, 'Identifying topics and subtopics…');

                const skeletonPrompt = `Analyze this core syllabus/textbook material. Generate a highly structured JSON Skeleton of Topics and Subtopics.
                MAIN MATERIAL (Excerpt if too long):
                ${mainText.slice(0, 30000)}`;

                const { object: structure } = await withFallback((model) =>
                    generateObject({ model, schema: structureSchema, prompt: skeletonPrompt })
                );

                const topicCount = structure.topics.length;
                const subtopicCount = structure.topics.reduce((sum, t) => sum + t.subtopics.length, 0);
                sendProgress(controller, 'Building course outline', 35, `Found ${topicCount} topics and ${subtopicCount} subtopics`);

                // ════════════════════════════════════════════════════════
                // STEP C: Global Atlas Mapping (1 LLM call — O(1))
                // ════════════════════════════════════════════════════════
                sendProgress(controller, 'Generating course atlas', 38, 'Mapping entire document in one pass…');

                // Pass up to 700k chars to leverage Gemini 3 Flash's massive context window
                const atlasPrompt = `Here is the Master Syllabus Skeleton:
${JSON.stringify(structure.topics, null, 2)}

Here is the FULL Document Text:
${mainText.slice(0, 700000)}

TASK: Create a "Locator Atlas". For EVERY subtopic in the syllabus above, find the exact physical boundaries where that subtopic's content appears in the document text.

For each subtopic, provide:
- subtopic_id: The ID from the syllabus
- topic_name: The parent topic title
- subtopic_name: The subtopic title  
- start_text_quote: A unique phrase (~10-20 characters) from the document that marks where this subtopic's content BEGINS
- end_text_quote: A unique phrase (~10-20 characters) from the document that marks where this subtopic's content ENDS

The quotes must be EXACT text from the document. Choose distinctive phrases that appear only once.
Return segments in the order they appear in the document.`;

                const { object: atlas } = await withFallback((model) =>
                    generateObject({ model, schema: atlasSchema, prompt: atlasPrompt })
                );

                console.log(`[ingest] Atlas generated: ${atlas.segments.length} segments mapped`);
                sendProgress(controller, 'Generating course atlas', 55, `Mapped ${atlas.segments.length} sections in the document`);

                // ════════════════════════════════════════════════════════
                // STEP D: In-Memory Tagging (instant — no AI calls)
                // ════════════════════════════════════════════════════════
                sendProgress(controller, 'Organizing your notes', 58, 'Tagging sections instantly…');

                const mainChunks = chunkText(mainText);
                const suppChunks = chunkText(suppTextCombined);

                // Tag main chunks using atlas boundary matching
                const mainTagged = tagChunksWithAtlas(mainText, mainChunks, atlas.segments);

                // Tag supplementary chunks — use atlas on combined text (best effort)
                const suppTagged = suppChunks.length > 0
                    ? tagChunksWithAtlas(suppTextCombined, suppChunks, atlas.segments)
                    : [];

                const allMappedChunks = [
                    ...mainTagged.map(c => ({ ...c, material_type: 'main' as const })),
                    ...suppTagged.map(c => ({ ...c, material_type: 'supplementary' as const })),
                ];

                const totalChunks = allMappedChunks.length;
                console.log(`[ingest] Tagged ${totalChunks} chunks (${mainChunks.length} main + ${suppChunks.length} supp)`);
                sendProgress(controller, 'Organizing your notes', 62, `Tagged ${totalChunks} sections`);

                // ════════════════════════════════════════════════════════
                // STEP E: Parallel Batch Embedding + Bulk Insert
                // ════════════════════════════════════════════════════════
                sendProgress(controller, 'Saving to your study library', 65, `Embedding ${totalChunks} sections…`);

                // Build embedding + insert tasks
                const embeddingTasks: (() => Promise<void>)[] = [];
                const totalBatches = Math.ceil(totalChunks / EMBED_BATCH_SIZE);

                for (let b = 0; b < totalChunks; b += EMBED_BATCH_SIZE) {
                    const batch = allMappedChunks.slice(b, b + EMBED_BATCH_SIZE);
                    const batchNum = Math.floor(b / EMBED_BATCH_SIZE) + 1;

                    embeddingTasks.push(async () => {
                        // Batch embed
                        const { embeddings } = await embedManyWithFallback((model) =>
                            embedMany({ model, values: batch.map(c => c.content) })
                        );

                        // Bulk DB insert
                        const rows = batch.map((chunk, idx) => ({
                            content: chunk.content,
                            embedding: embeddings[idx],
                            subject_id: subjectId,
                            material_type: chunk.material_type,
                            topic_name: chunk.topic_name,
                            subtopic_name: chunk.subtopic_name,
                        }));

                        for (let r = 0; r < rows.length; r += DB_INSERT_BATCH_SIZE) {
                            const insertBatch = rows.slice(r, r + DB_INSERT_BATCH_SIZE);
                            const { error: insertError } = await supabase.from('documents').insert(insertBatch);
                            if (insertError) console.error('[ingest] DB insert error:', insertError);
                        }

                        const progress = 65 + Math.round((batchNum / totalBatches) * 30);
                        sendProgress(controller, 'Saving to your study library', progress, `Stored batch ${batchNum} of ${totalBatches}…`);
                    });
                }

                // Run embedding tasks in parallel with concurrency limit
                await runWithConcurrency(embeddingTasks, EMBED_CONCURRENCY);

                // ════════════════════════════════════════════════════════
                // STEP F: Save Subject
                // ════════════════════════════════════════════════════════
                sendProgress(controller, 'Finishing up', 98, 'Creating your course…');

                const { error: subjectError } = await supabase
                    .from('subjects')
                    .upsert({
                        id: subjectId,
                        title,
                        topics: structure.topics,
                        progress: 0,
                        last_studied: new Date().toISOString()
                    });

                if (subjectError) throw subjectError;

                sendComplete(controller, subjectId);
                controller.close();

            } catch (error: any) {
                console.error('Ingestion error:', error);
                sendError(controller, error.message || 'Something went wrong during processing.');
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
