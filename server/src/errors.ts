import type { ServerResponse } from 'node:http';

export function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  requestId: string,
): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-headers': 'content-type, authorization, x-request-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-origin': '*',
    'x-request-id': requestId,
  });
  response.end(JSON.stringify(body));
}

export function writeApiError(
  response: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
): void {
  writeJson(response, statusCode, {
    error: { code, message, requestId },
  }, requestId);
}
