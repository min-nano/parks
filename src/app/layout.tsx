import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/SiteHeader';
import { readPublicConfig } from '@/lib/env';

import './globals.css';

export const metadata: Metadata = {
  title: 'Parks — 近くのコインパーキングを探す',
  description:
    '公式サイトのデータとユーザーの報告から、料金・空き状況・駐車可能な車両サイズで近くのコインパーキングを探せます。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const config = readPublicConfig();

  const content = (
    <>
      <SiteHeader clerkEnabled={config.clerkEnabled} />
      {children}
    </>
  );

  return (
    <html lang="ja">
      <body>{config.clerkEnabled ? <ClerkProvider>{content}</ClerkProvider> : content}</body>
    </html>
  );
}
