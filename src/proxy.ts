import { clerkMiddleware } from '@clerk/nextjs/server';
import type { NextMiddleware } from 'next/server';

/**
 * Every route is public — anyone can browse the map without an account. This
 * only attaches the Clerk session so `currentUserId()` can identify the reporter
 * on write endpoints.
 *
 * With no Clerk keys configured it is a pass-through, so the app still boots on
 * a fresh clone with no secrets.
 */
const passthrough: NextMiddleware = () => undefined;

export default (
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? clerkMiddleware() : passthrough
) as NextMiddleware;

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/api/(.*)'],
};
