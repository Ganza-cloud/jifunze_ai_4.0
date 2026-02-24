import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { embedWithFallback, withFallback } from '@/lib/llm';
import { embed, generateObject } from 'ai';
import { z } from 'zod';
import { extractMarkdownFromPdf } from '@/lib/llamaparse';

// Schema for the Syllabus Skeleton (Phase 2, Step B)
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

// Schema for mapping chunks to Syllabus (Phase 2, Step C)
const taggingSchema = z.object({
    tags: z.array(z.object({
        chunkIndex: z.number().describe("The index of the chunk being map"),
        topic_name: z.string().describe("The matching topic title from Syllabus"),
        subtopic_name: z.string().describe("The matching subtopic title from Syllabus")
    }))
});

export const maxDuration = 120; // Allow 2 minutes for ingestion

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const suppFiles = formData.getAll('suppFiles') as File[];
        const title = formData.get('title') as string;

        if (!file || !title) {
            return NextResponse.json({ error: 'File and title are required' }, { status: 400 });
        }

        const subjectId = title.toLowerCase().replace(/\s+/g, '-');

        // ==== STEP A: Extract with LlamaParse ====
        console.log('Extracting Main Material with LlamaParse...');
        const mainText = await extractMarkdownFromPdf(file);

        let suppTextCombined = '';
        if (suppFiles && suppFiles.length > 0) {
            console.log(`Extracting ${suppFiles.length} Supplementary Material(s)...`);
            for (const suppFile of suppFiles) {
                const text = await extractMarkdownFromPdf(suppFile);
                suppTextCombined += `\n--- Supplementary Document: ${suppFile.name} ---\n${text}`;
            }
        }
        console.log('LlamaParse text extraction complete.');

        // ==== STEP B: The Skeleton Pass ====
        console.log('Generating JSON Syllabus Skeleton using LLM...');
        const skeletonPrompt = `Analyze this core syllabus/textbook material. Generate a highly structured JSON Skeleton of Topics and Subtopics.
        MAIN MATERIAL (Excerpt if too long):
        ${mainText.slice(0, 30000)}`;

        const { object: structure } = await withFallback((model) =>
            generateObject({ model, schema: structureSchema, prompt: skeletonPrompt })
        );
        console.log('Successfully extracted Syllabus Skeleton JSON.');

        // ==== STEP C: The Supplementary Mapping Pass ====
        // We chunk the text first to avoid diluting context and preserving exact Markdown features
        const chunkText = (text: string) => {
            const rawChunks = text.match(/[\s\S]{1,1500}/g) || [];
            return rawChunks.filter(c => c.trim().length > 50).map(c => c.trim());
        };

        const mainChunks = chunkText(mainText);
        const suppChunks = chunkText(suppTextCombined);

        // Helper to batch-tag chunks using the LLM against the syllabus
        async function tagChunksWithSyllabus(chunks: string[], syllabusJson: any) {
            const mapped = [];
            // Batch chunks by 10 to ensure the LLM maps all of them accurately
            for (let i = 0; i < chunks.length; i += 10) {
                const batch = chunks.slice(i, i + 10);
                const batchText = batch.map((c, idx) => `[ChunkIndex: ${i + idx}]\n${c}`).join('\n\n');

                const prompt = `Here is the Master Syllabus JSON:
${JSON.stringify(syllabusJson)}

Read the following chunks of notes. Map EVERY section (chunk) of these notes to the exact matching topic_name and subtopic_name in the Syllabus.

CHUNKS TO MAP:
${batchText}`;

                const { object: { tags } } = await withFallback((model) =>
                    generateObject({ model, schema: taggingSchema, prompt })
                );

                // Merge tags directly with the original content to NEVER dilute/lose exact figures/tables
                for (const chunkValue of batch) {
                    // find matching tag by matching the chunk text index roughly if exact isn't there
                    const chunkGlobalIndex = i + batch.indexOf(chunkValue);
                    const match = tags.find(t => t.chunkIndex === chunkGlobalIndex) || tags[0] || { topic_name: 'General', subtopic_name: 'Overview' };
                    mapped.push({
                        content: chunkValue,
                        topic_name: match.topic_name,
                        subtopic_name: match.subtopic_name
                    });
                }
            }
            return mapped;
        }

        console.log('Mapping Main Chunks against Syllabus...');
        const mainMapped = await tagChunksWithSyllabus(mainChunks, structure);

        console.log('Mapping Supplementary Chunks against Syllabus...');
        const suppMapped = suppChunks.length > 0 ? await tagChunksWithSyllabus(suppChunks, structure) : [];

        const allMappedChunks = [
            ...mainMapped.map(c => ({ ...c, material_type: 'main' })),
            ...suppMapped.map(c => ({ ...c, material_type: 'supplementary' }))
        ];

        // ==== STEP D: Tagged Embedding ====
        console.log(`Embedding ${allMappedChunks.length} chunks into Vector DB...`);
        for (const chunk of allMappedChunks) {
            const { embedding } = await embedWithFallback((model) =>
                embed({ model, value: chunk.content })
            );

            await supabase.from('documents').insert({
                content: chunk.content,
                embedding,
                subject_id: subjectId,
                material_type: chunk.material_type,
                topic_name: chunk.topic_name,
                subtopic_name: chunk.subtopic_name
            });
        }
        console.log('Embeddings were successfully saved with their metadata tags.');

        // Finally, save the new Subject hierarchy
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

        return NextResponse.json({ success: true, subjectId });

    } catch (error: any) {
        console.error('Ingestion error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
