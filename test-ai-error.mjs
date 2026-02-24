import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { streamText } from 'ai';
import { getLLM } from './src/lib/llm.js';

async function main() {
    try {
        console.log("Trying model...");
        const result = streamText({
            model: getLLM(), // gemini-3-flash-preview
            prompt: 'Hello! I need a very long essay about quantum physics.',
            maxRetries: 1
        });
        
        const reader = result.textStream[Symbol.asyncIterator]();
        const firstChunk = await reader.next();
        console.log("Stream started!", firstChunk.value);
    } catch (e) {
        console.log("Caught in catch block!", e.name, e.message);
    }
}

// Emulate an unhandled rejection
process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

main();