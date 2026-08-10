import type { Config } from '@netlify/functions';

/**
 * Scheduled trigger for the operator-feed ingest.
 *
 * The work itself lives in the Next.js route so it shares the repository and
 * normalisation code; this function only calls it on a schedule. Keeping the
 * function free of imports from `src/` means it bundles without needing the
 * app's TypeScript path aliases.
 */
export async function triggerIngest(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: 'ingest is disabled: CRON_SECRET is not set' },
      { status: 503 },
    );
  }

  // `URL` is the site's primary address; `DEPLOY_URL` covers branch deploys.
  const base = env.URL ?? env.DEPLOY_URL;
  if (!base) {
    return Response.json({ error: 'no site URL available' }, { status: 500 });
  }

  let response: Response;
  try {
    response = await fetchImpl(`${base}/api/cron/ingest`, {
      headers: { authorization: `Bearer ${secret}` },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `ingest request failed: ${message}` }, { status: 502 });
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    return Response.json(
      { error: `ingest returned HTTP ${response.status}`, body },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, summary: body });
}

const scheduledIngest = (): Promise<Response> => triggerIngest();

export default scheduledIngest;

export const config: Config = {
  schedule: '*/10 * * * *',
};
