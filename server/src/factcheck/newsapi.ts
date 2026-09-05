import type { ClaimEvidence } from '../../../shared/contracts';
import type { Environment } from '../config';

const NEWSAPI_BASE_URL = 'https://newsapi.org/v2/everything';

/**
 * Retrieves real, independently-published news evidence for a claim. This is
 * the ONLY source of "what is actually true" the fact-checker uses - Gonka
 * models never answer from their own memory (proven unreliable: the same
 * model gave a confident, wrong answer about live events on a second try with
 * no live data behind it). Zero results here means the claim is
 * UNVERIFIABLE, full stop, regardless of what any model says afterwards.
 */
export async function retrieveEvidence(
  env: Environment,
  claim: string,
): Promise<{ evidence: ClaimEvidence[]; error: string | null }> {
  if (!env.NEWSAPI_KEY) {
    return { evidence: [], error: 'NEWSAPI_KEY is not configured' };
  }

  const query = claim.trim().slice(0, 400);
  if (!query) {
    return { evidence: [], error: 'Empty claim' };
  }

  const url = new URL(NEWSAPI_BASE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('language', 'en');
  url.searchParams.set('sortBy', 'publishedAt');
  url.searchParams.set('pageSize', '5');

  try {
    const response = await fetch(url.toString(), {
      headers: { 'X-Api-Key': env.NEWSAPI_KEY },
    });
    const payload = (await response.json().catch(() => null)) as
      | { status?: string; message?: string; articles?: NewsApiArticle[] }
      | null;

    if (!response.ok || payload?.status !== 'ok') {
      return { evidence: [], error: payload?.message ?? `NewsAPI request failed (${response.status})` };
    }

    const evidence = (payload.articles ?? [])
      .filter((a): a is NewsApiArticle & { title: string; url: string } => Boolean(a.title && a.url))
      .slice(0, 5)
      .map(
        (a): ClaimEvidence => ({
          title: a.title,
          source: a.source?.name ?? 'Unknown source',
          url: a.url,
          publishedAt: a.publishedAt ?? null,
          snippet: (a.description || a.content || '').slice(0, 500),
        }),
      );

    return { evidence, error: null };
  } catch (error) {
    return { evidence: [], error: error instanceof Error ? error.message : 'NewsAPI network error' };
  }
}

type NewsApiArticle = {
  title?: string;
  url?: string;
  description?: string;
  content?: string;
  publishedAt?: string;
  source?: { name?: string };
};
