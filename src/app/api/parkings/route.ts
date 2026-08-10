import { getDatabase } from '@/db/client';
import { searchParkings } from '@/db/repository';
import { parseSearchQuery } from '@/lib/search-params';
import { badRequest, jsonResponse } from '@/server/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parseSearchQuery(url.searchParams);
  if (!parsed.ok) return badRequest(parsed.message, parsed.issues);

  const db = await getDatabase();
  const items = await searchParkings(db, { ...parsed.value, now: new Date() });

  return jsonResponse({
    center: parsed.value.center,
    radiusMeters: parsed.value.radiusMeters,
    durationMinutes: parsed.value.durationMinutes,
    count: items.length,
    items,
  });
}
