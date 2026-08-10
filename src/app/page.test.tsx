// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FALLBACK_CENTER, FALLBACK_MAP_ID } from '@/lib/env';

import HomePage from './page';

vi.mock('@/components/ExplorerRoot', () => ({
  ExplorerRoot: (props: Record<string, unknown>) => (
    <div data-testid="explorer-root">{JSON.stringify(props)}</div>
  ),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('HomePage', () => {
  it('passes the demo-mode defaults to the explorer', () => {
    render(<HomePage />);

    expect(JSON.parse(screen.getByTestId('explorer-root').textContent ?? '')).toEqual({
      clerkEnabled: false,
      googleMapsApiKey: null,
      mapId: FALLBACK_MAP_ID,
      initialCenter: FALLBACK_CENTER,
    });
  });

  it('passes the configured environment through', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'key-123');
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_x');

    render(<HomePage />);

    expect(JSON.parse(screen.getByTestId('explorer-root').textContent ?? '')).toMatchObject({
      clerkEnabled: true,
      googleMapsApiKey: 'key-123',
    });
  });
});
