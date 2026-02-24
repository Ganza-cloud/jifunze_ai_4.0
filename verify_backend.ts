import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// Dynamic imports moved to main() to ensure env vars are loaded first

// Verify standard imports are used for types if needed, but here we just run logic.
// import { getLLM, getEmbeddingModel } from './src/lib/llm';
// import { supabase } from './src/lib/supabase';
import { generateText, embed } from 'ai';

async function main() {
    // Dynamically import local modules after env vars are set
    const { getLLM, getEmbeddingModel } = await import('./src/lib/llm');
    const { supabase } = await import('./src/lib/supabase');

    console.log('Starting Backend Verification...');

    // 1. Test LLM
    try {
        console.log('Testing LLM (OpenRouter)...');
        const { text } = await generateText({
            model: getLLM(),
            prompt: 'Say "Hello, World!" and nothing else.',
        });
        console.log('LLM Result:', text);
    } catch (error) {
        console.error('LLM Test Failed:', error);
    }

    // 2. Test Embeddings
    try {
        console.log('Testing Embeddings...');
        const { embedding } = await embed({
            model: getEmbeddingModel(),
            value: 'Hello, World!',
        });
        console.log('Embedding Generated, length:', embedding.length);
    } catch (error) {
        console.error('Embedding Test Failed:', error);
    }

    // 3. Test Supabase Connection
    try {
        console.log('Testing Supabase Connection...');
        const { data, count, error } = await supabase.from('documents').select('*', { count: 'exact', head: true });
        if (error) {
            // It's possible the table doesn't exist yet, which is expected usage error, but connection works if we get a specific error
            console.log('Supabase Query Result (Error expected if table missing):', error.message);
        } else {
            console.log('Supabase Connection Successful. Document count:', count);
        }
    } catch (error) {
        console.error('Supabase Test Failed:', error);
    }
}

main().catch(console.error);
