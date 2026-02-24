import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { streamText } from 'ai';
import { getLLM } from './src/lib/llm';

async function main() {
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    try {
        console.log("Trying model...");
        const model = getLLM();
        const result = streamText({
            model,
            prompt: 'Hello! I need a very long essay about quantum physics.',
            maxRetries: 0
        });
        
        // Listen to onError if available?
        // result.textStream is an AsyncIterable.

        const reader = result.textStream[Symbol.asyncIterator]();
        try {
            console.log("Waiting for first chunk...");
            const firstChunk = await reader.next();
            console.log("First Chunk:", firstChunk);
            
            if (firstChunk.done) {
                 console.log("Stream finished immediately (possibly failed?)");
            }

        } catch (innerError) {
             console.log("Caught in inner catch block!", innerError);
        }
       
    } catch (e) {
        console.log("Caught in outer catch block!", e);
    }
}

main();