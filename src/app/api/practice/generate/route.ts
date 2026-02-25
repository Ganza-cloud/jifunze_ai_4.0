import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getModelChain } from '@/lib/llm';
import { getContext } from '@/lib/rag';

export const maxDuration = 60;

// Schema for Multiple Choice Questions
const mcqSchema = z.object({
    questions: z.array(z.object({
        question: z.string(),
        options: z.array(z.string()).length(4),
        correctIndex: z.number().min(0).max(3),
        explanation: z.string(),
    }))
});

// Schema for Exam Style Questions
const examSchema = z.object({
    questions: z.array(z.object({
        question: z.string(),
        solutionStepByStep: z.string(),
    }))
});

export async function POST(req: NextRequest) {
    try {
        const { subjectId, subtopicNames, type, count } = await req.json();

        if (!subjectId || !subtopicNames || !type || !count) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Gather context
        const contextPromises = subtopicNames.map((name: string) =>
            getContext(`Core concepts and problems for ${name}`, subjectId, name)
        );
        const contexts = await Promise.all(contextPromises);
        const combinedContext = contexts.filter(Boolean).join('\n\n---\n\n');

        const systemPrompt = `You are a strict University Professor. Generate ${count} practice questions based on the provided notes. Make sure the questions test actual understanding, not just trivial recall.`;

        const prompt = `Generate ${count} ${type === 'mcq' ? 'multiple choice' : 'exam style'} questions for the following subtopics: ${subtopicNames.join(', ')}.

### Course Notes:
${combinedContext || 'No specific notes found. Generate questions based on general academic knowledge of these topics.'}
`;

        const models = getModelChain();
        let lastError: unknown;
        let generatedQuestions = null;

        for (const model of models) {
            try {
                console.log(`[practice] Trying model: ${(model as any).modelId || 'unknown'}`);
                const { object } = await generateObject({
                    model,
                    system: systemPrompt,
                    prompt,
                    schema: type === 'mcq' ? mcqSchema : examSchema,
                });

                generatedQuestions = object.questions;
                console.log(`[practice] ✓ Success with: ${(model as any).modelId || 'unknown'}`);
                break;
            } catch (error: any) {
                lastError = error;
                console.warn(`[practice] ✗ Model failed:`, error?.message?.slice(0, 150));
            }
        }

        if (!generatedQuestions) {
            throw lastError || new Error('All models failed to generate questions');
        }

        return NextResponse.json({ questions: generatedQuestions });

    } catch (error: any) {
        console.error('Practice Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate practice questions' }, { status: 500 });
    }
}
