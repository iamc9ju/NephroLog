import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ success: true, user: session });
  } catch (error: any) {
    console.error('Auth check error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
