import { getDatabase } from '@/db/client';
import { getVehicleProfile, saveVehicleProfile } from '@/db/repository';
import { parseVehicleProfileBody } from '@/lib/search-params';
import { currentUserId } from '@/server/auth';
import { badRequest, jsonResponse, readJsonBody, unauthorized } from '@/server/responses';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const userId = await currentUserId();
  if (userId === null) return unauthorized();

  const db = await getDatabase();
  return jsonResponse({ profile: await getVehicleProfile(db, userId) });
}

export async function PUT(request: Request): Promise<Response> {
  const userId = await currentUserId();
  if (userId === null) return unauthorized();

  const parsed = parseVehicleProfileBody(await readJsonBody(request));
  if (!parsed.ok) return badRequest(parsed.message, parsed.issues);

  const db = await getDatabase();
  const profile = await saveVehicleProfile(db, {
    userId,
    name: parsed.value.name,
    lengthMm: parsed.value.lengthMm,
    widthMm: parsed.value.widthMm,
    heightMm: parsed.value.heightMm,
    weightKg: parsed.value.weightKg,
    tireWidthMm: parsed.value.tireWidthMm ?? null,
  });

  return jsonResponse({ profile });
}
