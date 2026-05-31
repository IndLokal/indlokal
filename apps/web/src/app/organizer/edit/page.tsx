import { redirect } from 'next/navigation';

export const metadata = { title: 'Community Profile - Organizer' };

export default function EditProfileRedirectPage() {
  redirect('/organizer/profile');
}
