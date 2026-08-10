import { auth } from '@clerk/nextjs/server';

/**
 * Resolves the signed-in Clerk user, or `null`.
 *
 * Returns `null` instead of throwing when Clerk is not configured (demo mode) or
 * when the request never passed through `clerkMiddleware`, so write endpoints
 * answer 401 rather than 500.
 */
export async function currentUserId(
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;

  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}
