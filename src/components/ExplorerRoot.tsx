'use client';

import { useAuth } from '@clerk/nextjs';

import { ParkingExplorer, type ParkingExplorerProps } from './ParkingExplorer';

type RootProps = Omit<ParkingExplorerProps, 'isSignedIn'> & { clerkEnabled: boolean };

function ClerkExplorer(props: Omit<ParkingExplorerProps, 'isSignedIn'>) {
  const { isSignedIn } = useAuth();
  return <ParkingExplorer {...props} isSignedIn={isSignedIn === true} />;
}

/**
 * Chooses the auth-aware tree.
 *
 * Clerk's hooks throw without a provider, so when no publishable key is
 * configured we render the explorer directly as a signed-out visitor instead of
 * mounting anything Clerk-related. That keeps `npm run dev` working on a fresh
 * clone with no secrets.
 */
export function ExplorerRoot({ clerkEnabled, ...props }: RootProps) {
  if (!clerkEnabled) return <ParkingExplorer {...props} isSignedIn={false} />;
  return <ClerkExplorer {...props} />;
}
