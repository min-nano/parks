import { getDatabase } from '@/db/client';
import { createReport, getParkingById, listReports } from '@/db/repository';
import { parseReportBody } from '@/lib/search-params';
import { currentUserId } from '@/server/auth';
import { badRequest, jsonResponse, notFound, readJsonBody, unauthorized } from '@/server/responses';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const db = await getDatabase();
  const reports = await listReports(db, id);
  return jsonResponse({ parkingId: id, count: reports.length, reports });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await currentUserId();
  if (userId === null) return unauthorized();

  const { id } = await context.params;
  const parsed = parseReportBody(await readJsonBody(request));
  if (!parsed.ok) return badRequest(parsed.message, parsed.issues);

  const db = await getDatabase();
  // Guarded explicitly so a bad id is a 404 rather than a foreign-key 500.
  const parking = await getParkingById(db, id);
  if (!parking) return notFound('parking not found');

  const report = await createReport(db, {
    parkingId: id,
    userId,
    status: parsed.value.status,
    vacantCount: parsed.value.vacantCount ?? null,
    note: parsed.value.note ?? null,
  });

  return jsonResponse({ report }, 201);
}
