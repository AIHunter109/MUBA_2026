/**
 * Pull a JSON object out of raw model text. Gonka's reasoning models can wrap
 * output in <think> blocks or markdown fences even when told not to, so this is
 * deliberately forgiving. Returns null when nothing parses.
 */
export function extractJsonObject(raw: string): unknown | null {
  if (!raw) {
    return null;
  }

  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    text = fence[1].trim();
  }

  const direct = tryParse(text);
  if (direct !== undefined) {
    return direct;
  }

  // Fall back to the first balanced { ... } span.
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return tryParse(text.slice(start, i + 1)) ?? null;
      }
    }
  }
  return null;
}

function tryParse(candidate: string): unknown | undefined {
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}
