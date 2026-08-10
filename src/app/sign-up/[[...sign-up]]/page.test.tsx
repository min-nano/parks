// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SignUpPage from './page';

vi.mock('@clerk/nextjs', () => ({ SignUp: () => <div data-testid="clerk-sign-up" /> }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SignUpPage', () => {
  it('explains that registration is unavailable in demo mode', () => {
    render(<SignUpPage />);

    expect(screen.getByText(/認証が未設定です/)).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-sign-up')).not.toBeInTheDocument();
  });

  it('renders the Clerk widget once configured', () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_x');

    render(<SignUpPage />);

    expect(screen.getByTestId('clerk-sign-up')).toBeInTheDocument();
  });
});
