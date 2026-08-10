import { getDatabase } from '@/db/client';
import { getParkingById, latestSnapshots, listReports, recentReports } from '@/db/repository';
import { resolveAvailability } from '@/domain/availability';
import { estimateFee } from '@/domain/pricing';
import { checkVehicleFit } from '@/domain/vehicle';
import { parseEstimateQuery } from '@/lib/search-params';
import { badRequest, jsonResponse, notFound } from '@/server/responses';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const url = new URL(request.url);

  const parsed = parseEstimateQuery(url.searchParams);
  if (!parsed.ok) return badRequest(parsed.message, parsed.issues);

  const db = await getDatabase();
  const parking = await getParkingById(db, id);
  if (!parking) return notFound('parking not found');

  const now = new Date();
  const [official, reports, history] = await Promise.all([
    latestSnapshots(db, [id]),
    recentReports(db, [id], now),
    listReports(db, id),
  ]);

  return jsonResponse({
    parking,
    availability: resolveAvailability({
      official: official.get(id) ?? null,
      reports: reports.get(id) ?? [],
      now,
    }),
    fit: parsed.value.vehicle ? checkVehicleFit(parking.limits, parsed.value.vehicle) : null,
    fee: estimateFee(parking.feeSchedule, {
      arrival: parsed.value.arrival,
      durationMinutes: parsed.value.durationMinutes,
    }),
    reports: history,
  });
}
