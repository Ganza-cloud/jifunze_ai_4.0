import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModel } from 'ai';

// ── Model Chain Definition ──────────────────────────────────────────────
// Ordered from preferred → last resort. Each model gets one attempt.
const MODEL_CHAIN: { name: string; provider: 'google' | 'openrouter'; label: string }[] = [
    { name: 'gemini-3-flash-preview', provider: 'google', label: 'Gemini 3 Flash' },
    { name: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash' },
    { name: 'gemini-2.5-flash-lite', provider: 'google', label: 'Gemini 2.5 Flash Lite' },
    { name: 'z-ai/glm-4.5-air:free', provider: 'openrouter', label: 'GLM-4.5 Air (free)' },
    { name: 'arcee-ai/trinity-large-preview:free', provider: 'openrouter', label: 'Trinity Large (free)' },
];

// ── Provider Factories (cached) ─────────────────────────────────────────
let _google: ReturnType<typeof createGoogleGenerativeAI> | null = null;
let _openrouter: ReturnType<typeof createOpenAI> | null = null;

function getGoogleProvider() {
    if (!_google) {
        _google = createGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        });
    }
    return _google;
}

function getOpenRouterProvider() {
    if (!_openrouter) {
        _openrouter = createOpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
        });
    }
    return _openrouter;
}

// ── Model Instantiation ─────────────────────────────────────────────────
function createModelFromEntry(entry: (typeof MODEL_CHAIN)[number]): LanguageModel {
    if (entry.provider === 'google') {
        return getGoogleProvider()(entry.name);
    }
    return getOpenRouterProvider()(entry.name);
}

// ── Error Classification ────────────────────────────────────────────────
function isRetryableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as any;

    // 1. HTTP 429 — Rate Limit / Quota Exceeded
    if (err.statusCode === 429) return true;

    // 2. AI SDK wraps retryable errors with `isRetryable: true`
    if (err.isRetryable === true) return true;

    // 3. AI_RetryError from the AI SDK (wraps the actual 429 after max retries)
    if (err.name === 'AI_RetryError' || err.reason === 'maxRetriesExceeded') return true;

    // 4. AI_NoObjectGeneratedError — model returned garbage / wrong format
    if (err.name === 'AI_NoObjectGeneratedError') return true;

    // 5. Check nested cause / lastError
    if (err.lastError && isRetryableError(err.lastError)) return true;
    if (err.cause && isRetryableError(err.cause)) return true;

    // 6. String matching for safety
    const message = String(err.message || '');
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) return true;

    return false;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Executes `fn` with cascading model fallback.
 *
 * Usage:
 * ```ts
 * const { object } = await withFallback(model =>
 *     generateObject({ model, schema, prompt })
 * );
 * ```
 */
export async function withFallback<T>(
    fn: (model: LanguageModel) => Promise<T>,
): Promise<T> {
    let lastError: unknown;

    for (const entry of MODEL_CHAIN) {
        try {
            console.log(`[LLM Fallback] Trying: ${entry.label} (${entry.name})`);
            const result = await fn(createModelFromEntry(entry));
            console.log(`[LLM Fallback] ✓ Success with: ${entry.label}`);
            return result;
        } catch (error) {
            lastError = error;
            const retryable = isRetryableError(error);
            console.warn(
                `[LLM Fallback] ✗ ${entry.label} failed` +
                `${retryable ? ' (retryable — trying next model)' : ' (non-retryable — aborting chain)'}:`,
                (error as any)?.message?.slice(0, 200) || error,
            );
            if (!retryable) throw error; // Non-retryable errors abort immediately
        }
    }

    // All models exhausted
    console.error('[LLM Fallback] All models in chain exhausted.');
    throw lastError;
}

/**
 * Returns the primary LLM model instance (first in chain).
 * Use `withFallback()` instead for automatic retry logic.
 * Kept for backward compat with streamText which needs special handling.
 */
export function getLLM(): LanguageModel {
    return createModelFromEntry(MODEL_CHAIN[0]);
}

/**
 * Returns model instances as an ordered array for manual iteration.
 */
export function getModelChain(): LanguageModel[] {
    return MODEL_CHAIN.map(createModelFromEntry);
}

/**
 * Embedding model — primary: OpenRouter, fallback: Google.
 */
export function getEmbeddingModel() {
    return getOpenRouterProvider().textEmbeddingModel('text-embedding-3-small');
}

/**
 * Returns embedding models in fallback order.
 */
export function getEmbeddingModelChain() {
    return [
        { model: getOpenRouterProvider().textEmbeddingModel('text-embedding-3-small'), label: 'OpenRouter text-embedding-3-small' },
    ];
}

/**
 * Embed with fallback across embedding providers.
 */
export async function embedWithFallback(embedFn: (model: any) => Promise<any>): Promise<any> {
    const chain = getEmbeddingModelChain();
    let lastError: unknown;

    for (const entry of chain) {
        try {
            console.log(`[Embedding Fallback] Trying: ${entry.label}`);
            const result = await embedFn(entry.model);
            console.log(`[Embedding Fallback] ✓ Success with: ${entry.label}`);
            return result;
        } catch (error: any) {
            lastError = error;
            console.warn(`[Embedding Fallback] ✗ ${entry.label} failed:`, error?.message?.slice(0, 200));
        }
    }

    console.error('[Embedding Fallback] All embedding models exhausted.');
    throw lastError;
}

/**
 * Batch-embed multiple texts with fallback.
 * Uses embedMany for efficiency — 1 API call per batch instead of N.
 */
export async function embedManyWithFallback(
    embedFn: (model: any) => Promise<{ embeddings: number[][] }>,
): Promise<{ embeddings: number[][] }> {
    // 1. STRICTLY OpenRouter Only (1536 dims). No Google Fallback.
    const primaryModel = getOpenRouterProvider().textEmbeddingModel('text-embedding-3-small');
    const modelLabel = 'OpenRouter text-embedding-3-small';

    const MAX_RETRIES = 5;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            if (attempt > 0) console.log(`[Batch Embedding] Attempt ${attempt + 1}/${MAX_RETRIES} for ${modelLabel}...`);

            const result = await embedFn(primaryModel);

            console.log(`[Batch Embedding] ✓ Success with: ${modelLabel} (${result.embeddings.length} embeddings)`);
            return result;

        } catch (error: any) {
            attempt++;
            const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.code === 'too_many_requests';

            if (isRateLimit && attempt < MAX_RETRIES) {
                // Exponential Backoff: Wait 2s, then 4s, then 8s, etc.
                const waitTime = Math.pow(2, attempt) * 1000;
                console.warn(`[Batch Embedding] ⚠ Rate Limit (429) hit. Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue; // Retry loop
            }

            // If it's not a rate limit, or we ran out of retries, throw the error
            console.error(`[Batch Embedding] ✗ Failed permanently:`, error?.message?.slice(0, 200));
            throw error;
        }
    }

    throw new Error(`[Batch Embedding] Max retries exceeded for ${modelLabel}`);
}

