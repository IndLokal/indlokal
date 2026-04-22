'use server';

import { redirect } from 'next/navigation';
import { clearSessionCookie } from '@/lib/session';

export async function signOut() {
  await clearSessionCookie();
  redirect('/');
}
