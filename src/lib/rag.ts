import { getEmbeddingModel } from './llm';
import { supabase } from './supabase';
import { embed } from 'ai';

export async function getContext(query: string, subjectId: string, subtopicName?: string) {
    try {
        // 1. Embed the query
        const { embedding } = await embed({
            model: getEmbeddingModel(),
            value: query,
        });

        // 2. Search in Supabase
        // We assume a 'match_documents' RPC function exists for vector similarity search
        const filter: any = { subject_id: subjectId };
        if (subtopicName) {
            filter.subtopic_name = subtopicName;
        }

        const { data: chunks, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.5, // Adjust as needed
            match_count: 5,
            filter: filter
        });

        if (error) {
            console.error('Error searching documents:', error);
            return "";
        }

        if (!chunks || chunks.length === 0) {
            return "";
        }

        // 3. Return combined text, preserving document type context
        return chunks.map((chunk: any) => {
            const sourceInfo = chunk.material_type ? `[Source: ${chunk.material_type}] ` : '';
            return `${sourceInfo}${chunk.content}`;
        }).join('\n\n');

    } catch (error) {
        console.error('Error in getContext:', error);
        return "";
    }
}
