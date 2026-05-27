import { redirect } from 'next/navigation';

export const metadata = { title: 'Community Links - Organizer' };

export default function ChannelsRedirectPage() {
  redirect('/organizer/links');
}
