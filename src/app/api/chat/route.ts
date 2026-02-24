import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { getModelChain } from '@/lib/llm';
import { getContext } from '@/lib/rag';

export const maxDuration = 60;

/**
 * Extract the text content from a UIMessage.
 * v6 UIMessages use `parts` array instead of `content` string.
 */
function getTextFromMessage(msg: UIMessage): string {
    if (msg.parts && Array.isArray(msg.parts)) {
        return msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
    }
    if (typeof (msg as any).content === 'string') {
        return (msg as any).content;
    }
    return '';
}

/**
 * Stream with model fallback.
 *
 * The problem: streamText() returns synchronously. The actual API call only
 * fires when the stream is consumed. A try/catch around streamText() never
 * catches a 429 error — it occurs during read, after the Response is already
 * returned to the client.
 *
 * The fix: read the FIRST chunk from each model's textStream. This forces the
 * API handshake. If it throws (429, etc.), catch it and try the next model.
 * Once a model produces a first chunk, build a Response that emits that chunk
 * plus the rest of the stream.
 */
async function streamWithFallback(options: {
    system: string;
    messages: any[];
}): Promise<Response> {
    const models = getModelChain();
    let lastError: unknown;
    const encoder = new TextEncoder();

    for (const model of models) {
        const modelName = (model as any).modelId || 'unknown';
        try {
            console.log(`[chat] Trying model: ${modelName}`);

            const result = streamText({
                model,
                system: options.system,
                messages: options.messages,
                maxRetries: 0, // Fail fast — we do our own fallback
            });

            // Force the API call by reading the first chunk.
            // If the model is rate-limited, this will throw.
            const reader = result.textStream[Symbol.asyncIterator]();
            const firstChunk = await reader.next();

            if (firstChunk.done) {
                 const err = new Error('Model returned empty stream (possibly rate limited or filtered)');
                 (err as any).isRetryable = true;
                 throw err;
            }

            console.log(`[chat] ✓ Stream started with: ${modelName}`);

            // Model works! Build a Response that includes the buffered first chunk
            // plus the remaining stream from the same iterator.
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        if (!firstChunk.done && firstChunk.value) {
                            controller.enqueue(encoder.encode(firstChunk.value));
                        }
                        // Continue from where the iterator left off
                        let next = await reader.next();
                        while (!next.done) {
                            if (next.value) {
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

            return new Response(stream, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        } catch (error: any) {
            lastError = error;
            const isRetryable =
                error?.statusCode === 429 ||
                error?.isRetryable ||
                error?.name === 'AI_RetryError' ||
                error?.reason === 'maxRetriesExceeded' ||
                String(error?.message || '').includes('RESOURCE_EXHAUSTED');

            console.warn(
                `[chat] ✗ ${modelName} failed${isRetryable ? ' (retryable — trying next)' : ' (fatal)'}:`,
                error?.message?.slice(0, 150),
            );

            if (!isRetryable) throw error;
        }
    }

    console.error('[chat] All models exhausted.');
    throw lastError;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, subjectId, subtopicId, subjectName, conceptName, subtopicName } = body;

        console.log('[chat] Received request:', {
            messageCount: messages?.length,
            subjectId,
            subtopicId,
            subjectName,
            conceptName,
            subtopicName,
            lastMessageRole: messages?.[messages?.length - 1]?.role,
        });

        if (!messages || messages.length === 0) {
            return new Response('Missing messages', { status: 400 });
        }

        const latestMessage = messages[messages.length - 1];
        let queryText = '';
        if (latestMessage.role === 'user') {
            queryText = getTextFromMessage(latestMessage);
        }

        let context = '';
        const idToUse = subjectId || subtopicId;

        if (queryText && idToUse) {
            const enrichedSearchQuery = `Subject: ${subjectName || ''}. Topic/Concept: ${conceptName || subtopicName || ''}. Query: ${queryText}`;
            const contextQuery = messages.length >= 3
                ? `${getTextFromMessage(messages[messages.length - 2])} ${enrichedSearchQuery}`
                : enrichedSearchQuery;

            console.log('[chat] Computed Query for RAG:', contextQuery?.slice(0, 150));

            try {
                context = await getContext(contextQuery, idToUse, subtopicName);
                console.log("Retrieved Context:", context?.substring(0, 150) + "...");
            } catch (ragError) {
                console.error('[chat] RAG retrieval failed:', ragError);
            }
        } else {
            console.log('[chat] Skipping RAG. Query:', !!queryText, 'ID:', !!idToUse);
        }

        const systemPrompt = `You are an expert AI Tutor helping a university student with the course: "${subjectName || 'Unknown Course'}". 
The current topic of focus is: "${conceptName || 'General Topic'}".

COURSE NOTES CONTEXT:
${context ? context : "No specific notes retrieved for this exact query, but rely on the course name and topic to guide the user."}

INSTRUCTIONS:
1. Always prioritize answering using the COURSE NOTES CONTEXT.
2. If the user greets you or asks a vague question, use the course name and topic to guide them (e.g., "I'm ready to help you with ${conceptName || 'this topic'}!"). Do NOT say you lack notes unless they ask for a highly specific formula that isn't in the context.
3. Use LaTeX for math.`;

        const coreMessages = await convertToModelMessages(messages);

        return await streamWithFallback({
            system: systemPrompt,
            messages: coreMessages,
        });

    } catch (err: any) {
        console.error('[chat] Endpoint error:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'Internal Server Error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}
