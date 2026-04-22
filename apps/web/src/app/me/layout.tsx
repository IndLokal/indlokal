import { AppShell } from '@/components/layout';

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
