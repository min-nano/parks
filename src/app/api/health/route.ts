import { isDemoMode } from '@/db/client';
import { jsonResponse } from '@/server/responses';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return jsonResponse({ status: 'ok', demoMode: isDemoMode() });
}
