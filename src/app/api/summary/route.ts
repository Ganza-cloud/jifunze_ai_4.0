import { generateText } from 'ai';
import { withFallback } from '@/lib/llm';
import { getContext } from '@/lib/rag';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const { subtopicId, query, subjectId } = await req.json();

        const effectiveQuery = query || subtopicId || '';

        if (!effectiveQuery || !subjectId) {
            return NextResponse.json({ error: 'Query/SubtopicId and SubjectId are required' }, { status: 400 });
        }

        // Retrieve context
        const context = await getContext(effectiveQuery, subjectId);

        if (!context) {
            return NextResponse.json({ summary: 'No relevant content found to summarize.' });
        }

        const prompt = `Based on the following notes, generate a "Markdown Cheatsheet" for the topic "${effectiveQuery}".
Include the following sections:
1. **Key Definitions** (Bulleted list)
2. **Core Formulas** (Use LaTeX for math, e.g. $$x^2$$)
3. **Common Mistakes** (Use > Callout boxes)

### Notes:
${context}
`;

        const { text } = await withFallback((model) =>
            generateText({ model, prompt })
        );

        return NextResponse.json({ summary: text });
    } catch (error) {
        console.error('Summary endpoint error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
