import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, username, password, hn } = body;

    if (role === 'NURSE') {
      if (!username || !password) {
        return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' }, { status: 400 });
      }

      // Find nurse
      const nurse = await db.nurse.findUnique({
        where: { username },
      });

      if (!nurse) {
        return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, nurse.password);
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
      }

      // Sign JWT
      const token = await signToken({
        id: nurse.id,
        role: 'NURSE',
        name: nurse.name,
        username: nurse.username,
      });

      const response = NextResponse.json({
        success: true,
        user: { id: nurse.id, username: nurse.username, name: nurse.name, role: 'NURSE' },
      });

      // Set cookie
      response.cookies.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    } else if (role === 'PATIENT') {
      if (!hn) {
        return NextResponse.json({ error: 'กรุณากรอกเลข HN ของคนไข้' }, { status: 400 });
      }

      // Find patient by HN
      const patient = await db.patient.findUnique({
        where: { hn: hn.trim() },
      });

      if (!patient) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลคนไข้รหัส HN นี้ในระบบ' }, { status: 404 });
      }

      // Sign JWT
      const token = await signToken({
        id: patient.id,
        role: 'PATIENT',
        name: `${patient.firstName} ${patient.lastName}`,
        hn: patient.hn,
      });

      const response = NextResponse.json({
        success: true,
        user: { id: patient.id, hn: patient.hn, name: `${patient.firstName} ${patient.lastName}`, role: 'PATIENT' },
      });

      // Set cookie
      response.cookies.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: 'ข้อมูลบทบาทไม่ถูกต้อง' }, { status: 400 });
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' }, { status: 500 });
  }
}
