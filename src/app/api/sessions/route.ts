import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// GET active or history sessions
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') === 'true';
    const patientId = searchParams.get('patientId');

    // Build query conditions
    const where: any = {};
    if (activeOnly) {
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    }
    if (patientId) {
      where.patientId = patientId;
    }

    // Patients can only view their own sessions
    if (sessionUser.role === 'PATIENT') {
      where.patientId = sessionUser.id;
    }

    const sessions = await db.session.findMany({
      where,
      include: {
        patient: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, sessions });
  } catch (error: any) {
    console.error('Get sessions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create session
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let patientId = '';
    let recorderName = '';

    if (sessionUser.role === 'PATIENT') {
      patientId = sessionUser.id;
      recorderName = 'คนไข้บันทึกด้วยตนเอง';
    } else {
      const body = await req.json().catch(() => ({}));
      patientId = body.patientId;
      recorderName = sessionUser.name;
    }

    if (!patientId) {
      return NextResponse.json({ error: 'กรุณาระบุคนไข้' }, { status: 400 });
    }

    // Count today's cycles for this patient to compute cycleNumber
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const countToday = await db.session.count({
      where: {
        patientId,
        createdAt: {
          gte: today,
        },
      },
    });

    const cycleNumber = countToday + 1;

    const newSession = await db.session.create({
      data: {
        patientId,
        nurseName: recorderName,
        cycleNumber,
        status: 'PREPARATION',
      },
    });

    return NextResponse.json({ success: true, session: newSession });
  } catch (error: any) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
