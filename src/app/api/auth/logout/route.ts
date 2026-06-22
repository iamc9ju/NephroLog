import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
  
  // Set expired session cookie to delete it
  response.cookies.set('session', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  
  return response;
}

export async function GET() {
  const response = NextResponse.redirect('/login');
  response.cookies.set('session', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  return response;
}
