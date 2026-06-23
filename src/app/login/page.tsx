'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const [role, setRole] = useState<'NURSE' | 'PATIENT'>('NURSE');
  
  // Nurse credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Patient credential
  const [hn, setHn] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  const router = useRouter();

  // Run auto seed on load just in case database is empty
  useEffect(() => {
    fetch('/api/seed')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.message.includes('Created')) {
          console.log('Seeded database with default nurse user');
        }
      })
      .catch((err) => console.error('Auto seed failed', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload =
        role === 'NURSE'
          ? { role, username, password }
          : { role, hn };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }

      // Refresh page metadata / state and redirect
      if (role === 'NURSE') {
        router.push('/dashboard');
      } else {
        router.push('/patient/dashboard');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'รหัสผ่านหรือข้อมูลไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  const runManualSeed = async () => {
    try {
      setSeedStatus('กำลังทำรายการ...');
      const res = await fetch('/api/seed');
      const data = await res.json();
      if (data.success) {
        setSeedStatus('ตั้งค่าพยาบาลสำเร็จ! (Username: Jaae / Password: admin)');
        setUsername('Jaae');
        setPassword('admin');
      } else {
        setSeedStatus(`ล้มเหลว: ${data.error}`);
      }
    } catch (err: any) {
      setSeedStatus(`ล้มเหลว: ${err.message}`);
    }
    setTimeout(() => setSeedStatus(null), 5000);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.backgroundGlows}>
        <div className={styles.glow1}></div>
        <div className={styles.glow2}></div>
      </div>
      
      <div className={`${styles.loginCard} glass fade-in`}>
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <img src="/logo-login.png" alt="โลโก้บันทึกฟอกไต" width="80" height="80" style={{ objectFit: 'contain', borderRadius: '12px' }} />
          </div>
          <h2>ระบบบันทึกการฟอกไตทางช่องท้อง</h2>
          <p>Continuous Ambulatory Peritoneal Dialysis (CAPD)</p>
        </div>

        {/* Role Selection Tabs */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${role === 'NURSE' ? styles.activeTab : ''}`}
            onClick={() => { setRole('NURSE'); setError(''); }}
          >
            สำหรับพยาบาล
          </button>
          <button
            type="button"
            className={`${styles.tab} ${role === 'PATIENT' ? styles.activeTab : ''}`}
            onClick={() => { setRole('PATIENT'); setError(''); }}
          >
            สำหรับคนไข้
          </button>
        </div>

        {error && (
          <div className={`${styles.alert} badge-danger`}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className={styles.form}>
          {role === 'NURSE' ? (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="username">ชื่อผู้ใช้งาน (Username)</label>
                <input
                  id="username"
                  type="text"
                  placeholder="เช่น Jaae"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="password">รหัสผ่าน (Password)</label>
                <input
                  id="password"
                  type="password"
                  placeholder="เช่น admin"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </>
          ) : (
            <div className={styles.formGroup}>
              <label htmlFor="hn">รหัสประจำตัวผู้ป่วย (HN)</label>
              <input
                id="hn"
                type="text"
                placeholder="กรอกเลข HN เช่น HN001"
                value={hn}
                onChange={(e) => setHn(e.target.value)}
                disabled={loading}
                required
              />
              <span className={styles.hint}>* ใช้หมายเลข HN ที่พยาบาลลงทะเบียนไว้เพื่อความปลอดภัย</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px', height: '48px' }}
            disabled={loading}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className={styles.footer}>
          <button onClick={runManualSeed} className={styles.seedBtn}>
            {seedStatus || 'คลิกที่นี่ เพื่อสร้างบัญชีพยาบาลเริ่มต้น (Jaae / admin)'}
          </button>
        </div>
      </div>
    </div>
  );
}
