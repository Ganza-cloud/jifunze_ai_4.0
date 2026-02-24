import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { embedManyWithFallback, withFallback } from '@/lib/llm';
import { embedMany, generateObject } from 'ai';
import { z } from 'zod';
import { extractMarkdownFromPdf } from '@/lib/llamaparse';
import { sendProgress, sendComplete, sendError } from '@/lib/progress';

// Schema for the Syllabus Skeleton
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

// Schema for mapping chunks to Syllabus
const taggingSchema = z.object({
    tags: z.array(z.object({
        chunkIndex: z.number().describe("The index of the chunk being mapped"),
        topic_name: z.string().describe("The matching topic title from Syllabus"),
        subtopic_name: z.string().describe("The matching subtopic title from Syllabus")
    }))
});

export const maxDuration = 300;

// ── Concurrency helper ──────────────────────────────────────────────────
// Run async tasks with a max concurrency limit
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

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

// ── Constants ───────────────────────────────────────────────────────────
const CHUNK_SIZE = 3000;        // Characters per chunk (was 1500 → halves chunk count)
const MAPPING_BATCH_SIZE = 20;  // Chunks per LLM mapping call (was 10)
const MAPPING_CONCURRENCY = 3;  // Parallel mapping calls
const EMBED_BATCH_SIZE = 50;    // Texts per embedMany call
const DB_INSERT_BATCH_SIZE = 50;// Rows per Supabase insert

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

                // ==== STEP A: Extract with LlamaParse ====
                sendProgress(controller, 'Reading your PDF', 5, `Opening "${file.name}"…`);

                const mainText = await extractMarkdownFromPdf(file);
                sendProgress(controller, 'Reading your PDF', 15, 'Main document processed');

                let suppTextCombined = '';
                if (suppFiles && suppFiles.length > 0) {
                    for (let i = 0; i < suppFiles.length; i++) {
                        sendProgress(
                            controller,
                            'Reading your materials',
                            15 + Math.round((i / suppFiles.length) * 10),
                            `Processing file ${i + 1} of ${suppFiles.length}…`,
                        );
                        const text = await extractMarkdownFromPdf(suppFiles[i]);
                        suppTextCombined += `\n--- Supplementary Document: ${suppFiles[i].name} ---\n${text}`;
                    }
                }
                sendProgress(controller, 'Reading your materials', 25, 'All documents read');

                // ==== STEP B: The Skeleton Pass ====
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

                // ==== STEP C: Parallel Mapping Pass ====
                const chunkText = (text: string) => {
                    const rawChunks = text.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) || [];
                    return rawChunks.filter(c => c.trim().length > 50).map(c => c.trim());
                };

                const mainChunks = chunkText(mainText);
                const suppChunks = chunkText(suppTextCombined);

                sendProgress(controller, 'Organizing your notes', 37,
                    `Mapping ${mainChunks.length + suppChunks.length} sections to your outline…`);

                // Build batch tasks
                function createMappingTasks(chunks: string[], syllabusJson: any) {
                    const tasks: (() => Promise<{ content: string; topic_name: string; subtopic_name: string }[]>)[] = [];
                    for (let i = 0; i < chunks.length; i += MAPPING_BATCH_SIZE) {
                        const batch = chunks.slice(i, i + MAPPING_BATCH_SIZE);
                        const batchStart = i;
                        tasks.push(async () => {
                            const batchText = batch.map((c, idx) => `[ChunkIndex: ${batchStart + idx}]\n${c}`).join('\n\n');
                            const prompt = `Here is the Master Syllabus JSON:
${JSON.stringify(syllabusJson)}

Read the following chunks of notes. Map EVERY section (chunk) to the exact matching topic_name and subtopic_name in the Syllabus.

CHUNKS TO MAP:
${batchText}`;

                            const { object: { tags } } = await withFallback((model) =>
                                generateObject({ model, schema: taggingSchema, prompt })
                            );

                            return batch.map((chunkValue, batchIdx) => {
                                const globalIdx = batchStart + batchIdx;
                                const match = tags.find(t => t.chunkIndex === globalIdx)
                                    || tags[0]
                                    || { topic_name: 'General', subtopic_name: 'Overview' };
                                return {
                                    content: chunkValue,
                                    topic_name: match.topic_name,
                                    subtopic_name: match.subtopic_name,
                                };
                            });
                        });
                    }
                    return tasks;
                }

                const mainTasks = createMappingTasks(mainChunks, structure);
                const suppTasks = createMappingTasks(suppChunks, structure);
                const allTasks = [...mainTasks, ...suppTasks];
                const totalTasks = allTasks.length;
                let completedTasks = 0;

                // Wrap tasks with progress reporting
                const trackedTasks = allTasks.map((task, idx) => async () => {
                    const result = await task();
                    completedTasks++;
                    const mappingProgress = 37 + Math.round((completedTasks / totalTasks) * 40);
                    sendProgress(controller, 'Organizing your notes', mappingProgress,
                        `Matched ${completedTasks} of ${totalTasks} sections…`);
                    return result;
                });

                // Run mapping in parallel with concurrency limit
                const mappedBatches = await runWithConcurrency(trackedTasks, MAPPING_CONCURRENCY);
                const flatMapped = mappedBatches.flat();

                // Tag with material type
                const mainCount = mainChunks.length;
                const allMappedChunks = flatMapped.map((chunk, idx) => ({
                    ...chunk,
                    material_type: idx < mainCount ? 'main' : 'supplementary',
                }));

                // ==== STEP D: Batch Embedding + Bulk Insert ====
                sendProgress(controller, 'Saving to your study library', 80,
                    `Storing ${allMappedChunks.length} sections…`);

                const totalEmbedBatches = Math.ceil(allMappedChunks.length / EMBED_BATCH_SIZE);

                for (let b = 0; b < allMappedChunks.length; b += EMBED_BATCH_SIZE) {
                    const batch = allMappedChunks.slice(b, b + EMBED_BATCH_SIZE);
                    const batchNum = Math.floor(b / EMBED_BATCH_SIZE) + 1;

                    sendProgress(controller, 'Saving to your study library',
                        80 + Math.round((batchNum / totalEmbedBatches) * 18),
                        `Storing batch ${batchNum} of ${totalEmbedBatches}…`);

                    // Batch embed: 1 API call for up to 50 texts
                    const { embeddings } = await embedManyWithFallback((model) =>
                        embedMany({ model, values: batch.map(c => c.content) })
                    );

                    // Bulk insert into Supabase
                    const rows = batch.map((chunk, idx) => ({
                        content: chunk.content,
                        embedding: embeddings[idx],
                        subject_id: subjectId,
                        material_type: chunk.material_type,
                        topic_name: chunk.topic_name,
                        subtopic_name: chunk.subtopic_name,
                    }));

                    // Insert in sub-batches if needed
                    for (let r = 0; r < rows.length; r += DB_INSERT_BATCH_SIZE) {
                        const insertBatch = rows.slice(r, r + DB_INSERT_BATCH_SIZE);
                        const { error: insertError } = await supabase
                            .from('documents')
                            .insert(insertBatch);
                        if (insertError) {
                            console.error('Supabase insert error:', insertError);
                        }
                    }
                }

                // Save subject hierarchy
                sendProgress(controller, 'Finishing up', 99, 'Creating your course…');

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
