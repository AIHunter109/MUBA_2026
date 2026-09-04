import type { Environment } from '../config';

export class GonkaError extends Error {
  status: number | null;
  requestId: string | null;

  constructor(message: string, status: number | null = null, requestId: string | null = null) {
    super(message);
    this.name = 'GonkaError';
    this.status = status;
    this.requestId = requestId;
  }
}

export type GonkaCallInput = {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
};

export type GonkaCallResult = {
  text: string;
  model: string;
  requestId: string | null;
  latencyMs: number;
  stopReason: string | null;
  usage: { input_tokens?: number; output_tokens?: number } | null;
};

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; type?: string };
};

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Low-level Gonka Router call over the Anthropic Messages API. Never logs prompt
 * or completion text, and never logs the API key. Callers get raw model text
 * plus provenance (request id, latency, token usage).
 */
export async function callGonka(
  env: Environment,
  input: GonkaCallInput,
): Promise<GonkaCallResult> {
  if (!env.GONKA_API_KEY) {
    throw new GonkaError('GONKA_API_KEY is not configured');
  }

  const body = JSON.stringify({
    model: input.model,
    max_tokens: input.maxTokens ?? 900,
    system: input.system,
    messages: [{ role: 'user', content: input.user }],
  });

  let lastError: GonkaError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.GONKA_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.GONKA_BASE_URL}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': env.GONKA_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;
      const requestId = response.headers.get('x-request-id');
      const fallback = response.headers.get('x-gonka-fallback');
      const payload = (await response.json().catch(() => null)) as AnthropicResponse | null;

      console.log(
        `[gonka] model=${input.model} status=${response.status} ${latencyMs}ms req=${requestId ?? '-'}` +
          (fallback ? ` fallback=${fallback}` : ''),
      );

      if (!response.ok) {
        const message = payload?.error?.message ?? `Gonka call failed (${response.status})`;
        const error = new GonkaError(message, response.status, requestId);
        if (RETRYABLE_STATUS.has(response.status) && attempt === 0) {
          lastError = error;
          await sleep(600 + attempt * 400);
          continue;
        }
        throw error;
      }

      const text = (payload?.content ?? [])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('')
        .trim();

      return {
        text,
        model: input.model,
        requestId,
        latencyMs,
        stopReason: payload?.stop_reason ?? null,
        usage: payload?.usage ?? null,
      };
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof GonkaError) {
        if (lastError && attempt === 1) {
          throw lastError;
        }
        throw error;
      }
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const wrapped = new GonkaError(
        isAbort ? `Gonka call timed out after ${env.GONKA_TIMEOUT_MS}ms` : 'Gonka network error',
      );
      if (attempt === 0) {
        lastError = wrapped;
        await sleep(600);
        continue;
      }
      throw wrapped;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new GonkaError('Gonka call failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
