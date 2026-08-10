import { SignUp } from '@clerk/nextjs';

import { readPublicConfig } from '@/lib/env';

export default function SignUpPage() {
  if (!readPublicConfig().clerkEnabled) {
    return (
      <main className="auth-page">
        <p>認証が未設定です。Clerk の環境変数を設定すると新規登録できます。</p>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <SignUp />
    </main>
  );
}
