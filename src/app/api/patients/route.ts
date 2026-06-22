import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// GET all patients
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== 'NURSE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const patients = await db.patient.findMany({
      where: {
        OR: [
          { hn: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, patients });
  } catch (error: any) {
    console.error('Get patients error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create patient
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== 'NURSE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { hn, firstName, lastName, birthDate, bloodGroup } = body;

    if (!hn || !firstName || !lastName || !birthDate) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' }, { status: 400 });
    }

    // Check if HN already exists
    const existingPatient = await db.patient.findUnique({
      where: { hn: hn.trim() },
    });

    if (existingPatient) {
      return NextResponse.json({ error: `รหัส HN ${hn} นี้ลงทะเบียนในระบบแล้ว` }, { status: 400 });
    }

    const patient = await db.patient.create({
      data: {
        hn: hn.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: new Date(birthDate),
        bloodGroup: bloodGroup || null,
      },
    });

    return NextResponse.json({ success: true, patient });
  } catch (error: any) {
    console.error('Create patient error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
