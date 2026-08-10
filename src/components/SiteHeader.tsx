'use client';

import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/nextjs';
import Link from 'next/link';

/** Split out so `useAuth` is only ever called when a ClerkProvider is mounted. */
function ClerkNav() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;

  if (isSignedIn) return <UserButton />;

  return (
    <>
      <SignInButton mode="modal">
        <button type="button">サインイン</button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button type="button">新規登録</button>
      </SignUpButton>
    </>
  );
}

export function SiteHeader({ clerkEnabled }: { clerkEnabled: boolean }) {
  return (
    <header className="site-header">
      <Link className="site-header__brand" href="/">
        Parks<span>近くのコインパーキングを探す</span>
      </Link>

      <nav className="site-header__nav">
        {clerkEnabled ? (
          <ClerkNav />
        ) : (
          <span className="site-header__note">認証未設定（閲覧のみ）</span>
        )}
      </nav>
    </header>
  );
}
