export type ApiErrorBody = {
  error: string;
  issues?: { path: string; message: string }[];
};

export const jsonResponse = (data: unknown, status = 200): Response =>
  Response.json(data, { status });

export const badRequest = (
  message: string,
  issues: { path: string; message: string }[] = [],
): Response => jsonResponse({ error: message, issues } satisfies ApiErrorBody, 400);

export const unauthorized = (): Response =>
  jsonResponse({ error: 'sign in required' } satisfies ApiErrorBody, 401);

export const notFound = (message = 'not found'): Response =>
  jsonResponse({ error: message } satisfies ApiErrorBody, 404);

/** Bodies arrive from the network, so a malformed payload must not throw. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
