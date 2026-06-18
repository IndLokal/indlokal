import type { Metadata } from 'next';
import AdminLoginClient from './AdminLoginClient';

export const metadata: Metadata = {
  title: 'Internal access - IndLokal',
  robots: { index: false },
};

export default function AdminLoginPage() {
  return <AdminLoginClient />;
}
