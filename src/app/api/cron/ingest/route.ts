import { getDatabase } from '@/db/client';
import { configuredAdapters } from '@/ingest/adapters';
import { runIngest } from '@/ingest/pipeline';
import { jsonResponse, unauthorized } from '@/server/responses';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Pulls every configured operator feed. Wired to a Vercel cron in `vercel.json`.
 *
 * The endpoint stays disabled until `CRON_SECRET` is set, so an unconfigured
 * deployment cannot be driven by anyone who finds the URL. Vercel sends the
 * secret as a bearer token automatically.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return jsonResponse({ error: 'ingest is disabled: CRON_SECRET is not set' }, 503);
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const adapters = configuredAdapters();
  if (adapters.length === 0) {
    return jsonResponse({ skipped: true, reason: 'INGEST_SOURCES is empty' });
  }

  const db = await getDatabase();
  return jsonResponse(await runIngest(db, adapters));
}
