import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const { subjectId } = await req.json();

        if (!subjectId) {
            return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
        }

        console.log(`[delete] Deleting subject: ${subjectId}`);

        // 1. Delete all vector documents for this subject
        const { error: docsError } = await supabase
            .from('documents')
            .delete()
            .eq('subject_id', subjectId);

        if (docsError) {
            console.error('[delete] Error deleting documents:', docsError);
            // Continue anyway — subject should still be deletable
        }

        // 2. Delete the subject itself
        const { error: subjectError } = await supabase
            .from('subjects')
            .delete()
            .eq('id', subjectId);

        if (subjectError) {
            console.error('[delete] Error deleting subject:', subjectError);
            return NextResponse.json({ error: subjectError.message }, { status: 500 });
        }

        console.log(`[delete] Successfully deleted subject: ${subjectId}`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[delete] Endpoint error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
