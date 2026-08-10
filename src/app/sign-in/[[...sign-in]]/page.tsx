import { SignIn } from '@clerk/nextjs';

import { readPublicConfig } from '@/lib/env';

export default function SignInPage() {
  if (!readPublicConfig().clerkEnabled) {
    return (
      <main className="auth-page">
        <p>認証が未設定です。Clerk の環境変数を設定するとサインインできます。</p>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <SignIn />
    </main>
  );
}
