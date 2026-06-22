import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const username = 'Jaae';
    const plainPassword = 'admin';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const existingNurse = await db.nurse.findUnique({
      where: { username },
    });

    let message = '';
    if (!existingNurse) {
      const nurse = await db.nurse.create({
        data: {
          username,
          password: hashedPassword,
          name: 'พยาบาลจ๋า (Nurse Jaae)',
        },
      });
      message = `Created default nurse user: ${nurse.username}`;
    } else {
      message = 'Nurse user Jaae already exists.';
    }

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
