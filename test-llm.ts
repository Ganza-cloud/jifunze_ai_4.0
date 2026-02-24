import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { generateText } from 'ai';
import { getLLM } from './src/lib/llm';

async function main() {
    console.log("Testing getLLM() execution...");
    try {
        const model = getLLM();
        const result = await generateText({
            model,
            prompt: 'Say hello world and explicitly tell me what model you are currently running as.',
        });
        console.log("\n=====================");
        console.log("RESULT:");
        console.log(result.text);
        console.log("=====================\n");
    } catch (err) {
        console.error("Error:", err);
    }
}
main();
