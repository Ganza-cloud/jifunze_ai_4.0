/**
 * SSE Progress Stream utility for long-running pipelines.
 * Writes structured events to a ReadableStream controller.
 */

export type ProgressEvent = {
    type: 'progress';
    step: string;
    percentage: number;
    details: string;
};

export type CompleteEvent = {
    type: 'complete';
    subjectId: string;
};

export type ErrorEvent = {
    type: 'error';
    message: string;
};

export type SSEEvent = ProgressEvent | CompleteEvent | ErrorEvent;

const encoder = new TextEncoder();

/**
 * Write a single SSE event to the stream controller.
 */
export function sendEvent(controller: ReadableStreamDefaultController, event: SSEEvent) {
    const data = JSON.stringify(event);
    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
}

/**
 * Convenience: send a progress update.
 */
export function sendProgress(
    controller: ReadableStreamDefaultController,
    step: string,
    percentage: number,
    details: string,
) {
    sendEvent(controller, { type: 'progress', step, percentage, details });
}

/**
 * Convenience: send completion with the resulting subjectId.
 */
export function sendComplete(controller: ReadableStreamDefaultController, subjectId: string) {
    sendEvent(controller, { type: 'complete', subjectId });
}

/**
 * Convenience: send an error and close the stream.
 */
export function sendError(controller: ReadableStreamDefaultController, message: string) {
    sendEvent(controller, { type: 'error', message });
}
