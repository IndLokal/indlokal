import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Internal access - IndLokal',
  robots: { index: false },
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
