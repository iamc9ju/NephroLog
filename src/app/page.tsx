import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function IndexPage() {
  const session = await getSession();

  if (session) {
    if (session.role === 'NURSE') {
      redirect('/dashboard');
    } else {
      redirect('/patient/dashboard');
    }
  } else {
    redirect('/login');
  }
}
