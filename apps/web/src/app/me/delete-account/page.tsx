import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { deleteMyAccount } from '@/app/me/actions';
import { ConfirmSubmitButton } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Delete account - IndLokal',
  robots: { index: false },
};

export default async function DeleteAccountPage() {
  const user = await getSessionUser();
  if (!user) redirect('/me/login');

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="card-base space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Delete account</h1>
        <p className="text-muted text-sm">
          This permanently deletes your account and associated profile-linked data. This action
          cannot be undone.
        </p>

        <ul className="text-muted list-disc space-y-1 pl-5 text-sm">
          <li>Your profile and saved items will be removed.</li>
          <li>Your active refresh tokens will be revoked.</li>
          <li>You will be signed out on web after completion.</li>
        </ul>

        <div className="border-border bg-muted-bg rounded-[var(--radius-card)] border p-3">
          <p className="text-foreground text-sm font-medium">Recommended first step</p>
          <p className="text-muted mt-1 text-sm">If needed, export your data before deletion.</p>
          <Link
            href="/me/export"
            className="text-brand-600 mt-2 inline-block text-sm font-medium hover:underline"
          >
            Export my data (JSON)
          </Link>
        </div>

        <form action={deleteMyAccount} className="pt-2">
          <ConfirmSubmitButton
            triggerLabel="Permanently delete my account"
            title="Permanently delete your account?"
            description="This action cannot be undone. Your profile and account-linked data will be deleted and you will be signed out."
            confirmLabel="Yes, delete permanently"
            tone="danger"
            triggerClassName="w-full rounded-[var(--radius-button)] border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
          />
        </form>

        <Link href="/me" className="text-muted hover:text-foreground inline-block text-sm">
          Cancel and go back
        </Link>
      </div>
    </div>
  );
}
