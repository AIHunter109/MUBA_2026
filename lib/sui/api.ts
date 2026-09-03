import { getApiUrl } from './network';

export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const err = body?.error;
    throw new ApiError(err?.code ?? 'HTTP_ERROR', err?.message ?? `Request failed (${response.status}).`);
  }

  return body as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`);
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the RemitGuard API. Is the server running?');
  }
  return parse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the RemitGuard API. Is the server running?');
  }
  return parse<T>(response);
}
