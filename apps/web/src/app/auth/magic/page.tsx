'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function buildAppMagicUrl(token: string | null): string | null {
  if (!token) return null;
  const url = new URL('indlokal://auth/magic');
  url.searchParams.set('token', token);
  return url.toString();
}

export default function MagicLinkBridgePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const appUrl = useMemo(() => buildAppMagicUrl(token), [token]);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!appUrl) return;

    const timeout = window.setTimeout(() => {
      setShowFallback(true);
    }, 1400);

    window.location.replace(appUrl);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [appUrl]);

  if (!token) {
    return (
      <main style={styles.main}>
        <section style={styles.card}>
          <h1 style={styles.title}>Invalid login link</h1>
          <p style={styles.copy}>This magic link is missing a token. Please request a new one.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <h1 style={styles.title}>Opening IndLokal app...</h1>
        <p style={styles.copy}>If the app does not open automatically, use the button below.</p>
        {showFallback ? (
          <>
            <a href={appUrl ?? undefined} style={styles.button}>
              Open in app
            </a>
            <p style={styles.smallCopy}>
              Still not working? Open the email on your phone where the IndLokal app is installed.
            </p>
          </>
        ) : null}
        <p style={styles.smallCopy}>
          Looking for organizer login instead?{' '}
          <Link href="/organizer/login">Go to organizer login</Link>
        </p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    background: 'linear-gradient(180deg, #F6F7FB 0%, #FFFFFF 100%)',
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    border: '1px solid #E7E9F2',
    borderRadius: '16px',
    background: '#fff',
    padding: '24px',
    boxShadow: '0 10px 30px rgba(21, 35, 75, 0.08)',
  },
  title: {
    margin: '0 0 12px',
    fontSize: '24px',
    lineHeight: 1.2,
  },
  copy: {
    margin: 0,
    color: '#4B5563',
  },
  button: {
    display: 'inline-block',
    marginTop: '18px',
    background: '#4F46E5',
    color: '#FFFFFF',
    textDecoration: 'none',
    borderRadius: '10px',
    padding: '12px 16px',
    fontWeight: 600,
  },
  smallCopy: {
    marginTop: '14px',
    marginBottom: 0,
    color: '#6B7280',
    fontSize: '14px',
  },
};
