// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { useAuth } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SiteHeader } from './SiteHeader';

vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
  UserButton: () => <div data-testid="user-button" />,
  SignInButton: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const useAuthMock = vi.mocked(useAuth);

beforeEach(() => {
  useAuthMock.mockReset();
});

describe('SiteHeader', () => {
  it('always links back to the map', () => {
    render(<SiteHeader clerkEnabled={false} />);

    expect(screen.getByRole('link', { name: /Parks/ })).toHaveAttribute('href', '/');
  });

  it('says auth is unavailable when Clerk is not configured', () => {
    render(<SiteHeader clerkEnabled={false} />);

    expect(screen.getByText('認証未設定（閲覧のみ）')).toBeInTheDocument();
    expect(useAuthMock).not.toHaveBeenCalled();
  });

  it('renders nothing until Clerk has loaded', () => {
    useAuthMock.mockReturnValue({ isLoaded: false, isSignedIn: false } as never);

    render(<SiteHeader clerkEnabled />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers sign-in and sign-up to visitors', () => {
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: false } as never);

    render(<SiteHeader clerkEnabled />);

    expect(screen.getByRole('button', { name: 'サインイン' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新規登録' })).toBeInTheDocument();
  });

  it('shows the account menu once signed in', () => {
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: true } as never);

    render(<SiteHeader clerkEnabled />);

    expect(screen.getByTestId('user-button')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'サインイン' })).not.toBeInTheDocument();
  });
});
