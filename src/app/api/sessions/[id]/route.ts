import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;

    const dialysisSession = await db.session.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!dialysisSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Patients can only see their own sessions
    if (sessionUser.role === 'PATIENT' && dialysisSession.patientId !== sessionUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ success: true, session: dialysisSession });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;
    
    // Find session to verify ownership
    const currentSession = await db.session.findUnique({
      where: { id },
    });

    if (!currentSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Patient can only update their own sessions
    if (sessionUser.role === 'PATIENT' && currentSession.patientId !== sessionUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Dynamically build data payload
    const updateData: any = {};
    const allowedKeys = [
      'status',
      'preWeight',
      'preBpSys',
      'preBpDia',
      'prePulse',
      'preTemp',
      'drainStartTime',
      'drainEndTime',
      'drainVolume',
      'drainColor',
      'flushTime',
      'fillStartTime',
      'fillEndTime',
      'fillVolume',
      'dextrosePct',
      'postWeight',
      'postBpSys',
      'postBpDia',
      'postPulse',
      'postTemp',
      'symptoms',
      'netUf'
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        if (key.endsWith('Time') && body[key] !== null) {
          updateData[key] = new Date(body[key]);
        } else {
          updateData[key] = body[key];
        }
      }
    }

    // If session is completed, calculate Net UF automatically
    if (body.status === 'COMPLETED' || updateData.status === 'COMPLETED') {
      const currentSession = await db.session.findUnique({
        where: { id },
      });
      if (currentSession) {
        const dVol = updateData.drainVolume !== undefined ? updateData.drainVolume : currentSession.drainVolume;
        const fVol = updateData.fillVolume !== undefined ? updateData.fillVolume : currentSession.fillVolume;
        if (dVol !== null && fVol !== null) {
          updateData.netUf = dVol - fVol;
        }
      }
    }

    const updatedSession = await db.session.update({
      where: { id },
      data: updateData,
      include: { patient: true },
    });

    return NextResponse.json({ success: true, session: updatedSession });
  } catch (error: any) {
    console.error('Update session error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
