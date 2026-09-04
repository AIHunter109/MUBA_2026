"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeJson = writeJson;
exports.writeApiError = writeApiError;
function writeJson(response, statusCode, body, requestId) {
    response.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-headers': 'content-type, authorization, x-request-id',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-origin': '*',
        'x-request-id': requestId,
    });
    response.end(JSON.stringify(body));
}
function writeApiError(response, statusCode, code, message, requestId) {
    writeJson(response, statusCode, {
        error: { code, message, requestId },
    }, requestId);
}
