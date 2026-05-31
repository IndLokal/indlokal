import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Pass-through boundary for the whole /organizer tree. The community-organizer
 * chrome now lives in the (community) route group and the event-host chrome in
 * host/layout.tsx, so neither portal renders inside the other's shell (which
 * previously produced a double header on /organizer/host). Auth pages
 * (login/verify) under /organizer render chrome-free.
 */
export default function OrganizerRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
