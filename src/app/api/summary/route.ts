import { streamText } from 'ai';
import { getModelChain } from '@/lib/llm';
import { getContext } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

export const maxDuration = 60;

/**
 * Stream with model fallback for the summary endpoint.
 */
async function streamWithFallback(options: {
    system: string;
    prompt: string;
}): Promise<{ response: Response; getFullText: () => Promise<string> }> {
    const models = getModelChain();
    let lastError: unknown;
    const encoder = new TextEncoder();

    for (const model of models) {
        const modelName = (model as any).modelId || 'unknown';
        try {
            console.log(`[summary] Trying model: ${modelName}`);

            const result = streamText({
                model,
                system: options.system,
                prompt: options.prompt,
                maxRetries: 0,
            });

            const reader = result.textStream[Symbol.asyncIterator]();
            const firstChunk = await reader.next();

            if (firstChunk.done) {
                const err = new Error('Model returned empty stream');
                (err as any).isRetryable = true;
                throw err;
            }

            console.log(`[summary] ✓ Stream started with: ${modelName}`);

            // Collect full text for caching while streaming
            let fullText = '';

            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        if (!firstChunk.done && firstChunk.value) {
                            fullText += firstChunk.value;
                            controller.enqueue(encoder.encode(firstChunk.value));
                        }
                        let next = await reader.next();
                        while (!next.done) {
                            if (next.value) {
                                fullText += next.value;
                                controller.enqueue(encoder.encode(next.value));
                            }
                            next = await reader.next();
                        }
                        controller.close();
                    } catch (streamErr) {
                        controller.error(streamErr);
                    }
                },
            });

            const response = new Response(stream, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });

            return {
                response,
                getFullText: async () => {
                    // Wait for stream to finish by consuming it
                    // (the client will already be reading it)
                    // We return fullText which accumulates during streaming
                    return fullText;
                },
            };
        } catch (error: any) {
            lastError = error;
            const isRetryable =
                error?.statusCode === 429 ||
                error?.isRetryable ||
                error?.name === 'AI_RetryError' ||
                error?.reason === 'maxRetriesExceeded' ||
                String(error?.message || '').includes('RESOURCE_EXHAUSTED');

            console.warn(
                `[summary] ✗ ${modelName} failed${isRetryable ? ' (retryable)' : ' (fatal)'}:`,
                error?.message?.slice(0, 150),
            );

            if (!isRetryable) throw error;
        }
    }

    console.error('[summary] All models exhausted.');
    throw lastError;
}

/**
 * Save generated summary to cache in the subjects table.
 */
async function cacheSummary(subjectId: string, subtopicName: string, text: string) {
    try {
        // Fetch current cache
        const { data } = await supabase
            .from('subjects')
            .select('summary_cache')
            .eq('id', subjectId)
            .single();

        const currentCache = (data?.summary_cache as Record<string, string>) || {};
        currentCache[subtopicName] = text;

        await supabase
            .from('subjects')
            .update({ summary_cache: currentCache })
            .eq('id', subjectId);

        console.log(`[summary] Cached summary for "${subtopicName}"`);
    } catch (err) {
        console.warn('[summary] Failed to cache summary:', err);
    }
}

export async function POST(req: Request) {
    try {
        const { subtopicName, topicName, subjectId, forceRegenerate } = await req.json();

        if (!subjectId) {
            return new Response('subjectId is required', { status: 400 });
        }

        const cacheKey = subtopicName || 'general';

        // ── Check cache first ───────────────────────────────────────────
        if (!forceRegenerate) {
            const { data } = await supabase
                .from('subjects')
                .select('summary_cache')
                .eq('id', subjectId)
                .single();

            const cached = (data?.summary_cache as Record<string, string> | null)?.[cacheKey];
            if (cached) {
                console.log(`[summary] Returning cached summary for "${cacheKey}"`);
                return new Response(cached, {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                });
            }
        }

        // ── Generate fresh summary ──────────────────────────────────────
        const searchQuery = subtopicName
            ? `Topic: ${topicName || ''}. Subtopic: ${subtopicName}. Summarize key concepts.`
            : 'General course summary';

        const context = await getContext(searchQuery, subjectId, subtopicName || undefined);

        const subtopicLabel = subtopicName || 'this topic';
        const topicLabel = topicName ? ` under the topic "${topicName}"` : '';

        const systemPrompt = `You are an academic summarization assistant. Generate clear, well-structured summaries from course notes.`;

        const prompt = `Based on the following course notes, generate a comprehensive "Markdown Cheatsheet" for the subtopic "${subtopicLabel}"${topicLabel}.

Include the following sections:
1. **Key Definitions** (Bulleted list)
2. **Core Formulas** (Use LaTeX for math, e.g. $$x^2$$)
3. **Important Concepts Explained** (Brief 2-3 sentence explanations)
4. **Common Mistakes** (Use > Callout boxes)

${context ? `### Course Notes:\n${context}` : '### Note:\nNo specific notes were found for this subtopic. Generate a helpful summary based on common academic knowledge of this topic.'}`;

        const { response, getFullText } = await streamWithFallback({ system: systemPrompt, prompt });

        // Cache the summary after the response is sent
        // We need to tee the response so we can both send it and read it
        const [clientStream, cacheStream] = response.body!.tee();

        // Read the cache stream in the background to save to DB
        (async () => {
            const reader = cacheStream.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    fullText += decoder.decode(value, { stream: true });
                }
                if (fullText) {
                    await cacheSummary(subjectId, cacheKey, fullText);
                }
            } catch (err) {
                console.warn('[summary] Cache stream read error:', err);
            }
        })();

        return new Response(clientStream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error) {
        console.error('Summary endpoint error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal Server Error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}
