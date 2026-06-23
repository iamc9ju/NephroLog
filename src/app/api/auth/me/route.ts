import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    let userDetails: any = { ...session };
    if (session.role === 'PATIENT') {
      const patient = await db.patient.findUnique({
        where: { id: session.id },
      });
      if (patient) {
        userDetails = {
          ...session,
          name: `${patient.firstName} ${patient.lastName}`,
          hn: patient.hn,
          firstName: patient.firstName,
          lastName: patient.lastName,
          birthDate: patient.birthDate.toISOString(),
          bloodGroup: patient.bloodGroup,
        };
      }
    }

    return NextResponse.json({ success: true, user: userDetails });
  } catch (error: any) {
    console.error('Auth check error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
