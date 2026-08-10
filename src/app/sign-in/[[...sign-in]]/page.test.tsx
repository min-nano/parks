// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SignInPage from './page';

vi.mock('@clerk/nextjs', () => ({ SignIn: () => <div data-testid="clerk-sign-in" /> }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SignInPage', () => {
  it('explains that auth is unavailable in demo mode', () => {
    render(<SignInPage />);

    expect(screen.getByText(/認証が未設定です/)).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });

  it('renders the Clerk widget once configured', () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_x');

    render(<SignInPage />);

    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
  });
});
