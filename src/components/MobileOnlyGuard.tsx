'use client';

import React, { useState, useEffect } from 'react';
import styles from './MobileOnlyGuard.module.css';

export default function MobileOnlyGuard({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkViewport = () => {
      // Standard mobile breakpoint: block if screen width is greater than 500px
      setIsDesktop(window.innerWidth > 500);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  if (!mounted) {
    // Render children initially on server-side to prevent hydration mismatches
    return <>{children}</>;
  }

  if (isDesktop) {
    return (
      <div className={styles.guardContainer}>
        <div className={styles.guardCard}>
          <div className={styles.phoneIconWrapper}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={styles.phoneIcon}>
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <h1 className={styles.guardTitle}>กรุณาใช้งานบนมือถือเท่านั้น</h1>
          <p className={styles.guardText}>
            ขออภัยในความไม่สะดวก ระบบ <strong>NephroLog</strong> ออกแบบมาเพื่อใช้งานบนหน้าจอโทรศัพท์มือถือเป็นหลัก เพื่อให้สะดวกต่อการบันทึกข้อมูลรอบการล้างไต
          </p>
          <div className={styles.instructionBox}>
            <p className={styles.instructionText}>
              <strong>วิธีเข้าใช้งานจากคอมพิวเตอร์ของคุณ:</strong>
            </p>
            <ol className={styles.instructionList}>
              <li>ปรับลดขนาดความกว้างหน้าต่างเบราว์เซอร์ให้แคบลง (น้อยกว่า 500px)</li>
              <li>หรือ กดปุ่ม <strong>F12</strong> บนคีย์บอร์ด เลือกโหมด <strong>Toggle Device Toolbar</strong> (Mobile View) เพื่อทดสอบจำลองเป็นหน้าจอมือถือ</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
