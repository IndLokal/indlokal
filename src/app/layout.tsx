import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import './globals.css';
import '@/lib/env'; // Runtime env validation — fail fast on missing vars
import { siteConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/session';
import { PostHogProvider } from '@/components/PostHogProvider';
import { PostHogIdentify } from '@/components/PostHogIdentify';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

/**
 * Lightweight user ID resolution for analytics identity.
 * Avoids the full getSessionUser() include to keep the root layout fast.
 */
async function getAnalyticsUserId(): Promise<string | null> {
  try {
    const jar = await cookies();
    const token = jar.get('lp_session')?.value;
    if (!token) return null;
    const hashed = await hashToken(token);
    const user = await db.user.findUnique({
      where: { sessionToken: hashed },
      select: { id: true, sessionTokenExpiry: true },
    });
    if (!user?.sessionTokenExpiry || user.sessionTokenExpiry < new Date()) return null;
    return user.id;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await getAnalyticsUserId();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#4f46e5" />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <PostHogProvider>
          <PostHogIdentify userId={userId} />
          <Suspense>{children}</Suspense>
        </PostHogProvider>
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            strategy="afterInteractive"
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
      </body>
    </html>
  );
}
