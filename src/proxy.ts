import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Define public paths
  const isPublicPath = path === '/login' || path === '/api/seed';
  const isApiRoute = path.startsWith('/api/');

  // Get session token
  const token = req.cookies.get('session')?.value;
  let session = null;

  if (token) {
    session = await verifyToken(token);
  }

  // If path is API route, let it handle its own auth or check session
  if (isApiRoute) {
    if (path.startsWith('/api/auth')) {
      return NextResponse.next();
    }
    // Protected API routes
    if (!session && !isPublicPath) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login page
  if (!session && !isPublicPath && path !== '/') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // If user is logged in, redirect away from login page
  if (session && isPublicPath) {
    if (session.role === 'NURSE') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    } else {
      return NextResponse.redirect(new URL('/patient/dashboard', req.url));
    }
  }

  // Redirect index page / to dashboard or login
  if (path === '/') {
    if (session) {
      if (session.role === 'NURSE') {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      } else {
        return NextResponse.redirect(new URL('/patient/dashboard', req.url));
      }
    } else {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Role-based routing checks
  if (session) {
    // Nurses shouldn't go to patient dashboard
    if (session.role === 'NURSE' && path.startsWith('/patient/')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    // Patients shouldn't go to nurse dashboards
    if (session.role === 'PATIENT' && (path.startsWith('/dashboard') || path.startsWith('/patients'))) {
      return NextResponse.redirect(new URL('/patient/dashboard', req.url));
    }
  }

  return NextResponse.next();
}

// Config to match all routes except static assets
export const config = {
  matcher: [
    '/',
    '/login',
    '/dashboard/:path*',
    '/patient/:path*',
    '/patients/:path*',
    '/tracker/:path*',
    '/api/patients/:path*',
    '/api/sessions/:path*',
  ],
};
