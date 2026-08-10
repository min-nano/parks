// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { useAuth } from '@clerk/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExplorerRoot } from './ExplorerRoot';

vi.mock('@clerk/nextjs', () => ({ useAuth: vi.fn() }));

vi.mock('./ParkingExplorer', () => ({
  ParkingExplorer: ({ isSignedIn }: { isSignedIn: boolean }) => (
    <div data-testid="explorer">{isSignedIn ? 'signed-in' : 'signed-out'}</div>
  ),
}));

const useAuthMock = vi.mocked(useAuth);

const props = {
  googleMapsApiKey: null,
  mapId: 'DEMO_MAP_ID',
  initialCenter: { lat: 35.658, lng: 139.7016 },
};

beforeEach(() => {
  useAuthMock.mockReset();
});

describe('ExplorerRoot', () => {
  it('renders a signed-out explorer without touching Clerk when auth is off', () => {
    render(<ExplorerRoot clerkEnabled={false} {...props} />);

    expect(screen.getByTestId('explorer')).toHaveTextContent('signed-out');
    expect(useAuthMock).not.toHaveBeenCalled();
  });

  it('passes the Clerk session state through when auth is on', () => {
    useAuthMock.mockReturnValue({ isSignedIn: true } as never);

    render(<ExplorerRoot clerkEnabled {...props} />);

    expect(screen.getByTestId('explorer')).toHaveTextContent('signed-in');
  });

  it('treats an undetermined Clerk session as signed out', () => {
    useAuthMock.mockReturnValue({ isSignedIn: undefined } as never);

    render(<ExplorerRoot clerkEnabled {...props} />);

    expect(screen.getByTestId('explorer')).toHaveTextContent('signed-out');
  });
});
