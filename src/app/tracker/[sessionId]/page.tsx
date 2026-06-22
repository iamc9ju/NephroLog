'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from './tracker.module.css';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Patient {
  hn: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  bloodGroup: string | null;
}

interface Session {
  id: string;
  patientId: string;
  patient: Patient;
  nurseName: string;
  cycleNumber: number;
  status: string;
  
  // Step 1
  preWeight: number | null;
  preBpSys: number | null;
  preBpDia: number | null;
  prePulse: number | null;
  preTemp: number | null;
  
  // Step 2
  drainStartTime: string | null;
  drainEndTime: string | null;
  drainVolume: number | null;
  drainColor: string | null;
  
  // Step 3
  flushTime: string | null;
  
  // Step 4
  fillStartTime: string | null;
  fillEndTime: string | null;
  fillVolume: number | null;
  dextrosePct: number | null;
  
  // Step 5
  postWeight: number | null;
  postBpSys: number | null;
  postBpDia: number | null;
  postPulse: number | null;
  postTemp: number | null;
  symptoms: string | null;
  netUf: number | null;
}

export default function TrackerPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Live Timer State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Flush countdown timer
  const [flushCountdown, setFlushCountdown] = useState(10);
  const flushIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Wizard state inputs (tied to each step)
  // Step 1: Prep
  const [preWeight, setPreWeight] = useState('');
  const [preBpSys, setPreBpSys] = useState('');
  const [preBpDia, setPreBpDia] = useState('');
  const [prePulse, setPrePulse] = useState('');
  const [preTemp, setPreTemp] = useState('');

  // Step 2: Drain
  const [drainVolume, setDrainVolume] = useState('2000');
  const [drainColor, setDrainColor] = useState('Clear');

  // Step 4: Fill
  const [fillVolume, setFillVolume] = useState('2000');
  const [dextrosePct, setDextrosePct] = useState('1.5');

  // Step 5: Post-Checks
  const [postWeight, setPostWeight] = useState('');
  const [postBpSys, setPostBpSys] = useState('');
  const [postBpDia, setPostBpDia] = useState('');
  const [postPulse, setPostPulse] = useState('');
  const [postTemp, setPostTemp] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch session details on mount/refresh
  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถดึงข้อมูลรายการฟอกไตได้');
      }
      
      const s = data.session as Session;
      setSession(s);

      // Pre-fill form fields if values exist
      if (s.preWeight) setPreWeight(s.preWeight.toString());
      if (s.preBpSys) setPreBpSys(s.preBpSys.toString());
      if (s.preBpDia) setPreBpDia(s.preBpDia.toString());
      if (s.prePulse) setPrePulse(s.prePulse.toString());
      if (s.preTemp) setPreTemp(s.preTemp.toString());

      if (s.drainVolume) setDrainVolume(s.drainVolume.toString());
      if (s.drainColor) setDrainColor(s.drainColor);

      if (s.fillVolume) setFillVolume(s.fillVolume.toString());
      if (s.dextrosePct) setDextrosePct(s.dextrosePct.toString());

      if (s.postWeight) setPostWeight(s.postWeight.toString());
      if (s.postBpSys) setPostBpSys(s.postBpSys.toString());
      if (s.postBpDia) setPostBpDia(s.postBpDia.toString());
      if (s.postPulse) setPostPulse(s.postPulse.toString());
      if (s.postTemp) setPostTemp(s.postTemp.toString());
      if (s.symptoms) setSymptoms(s.symptoms);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  // Handle live ticking timer for Draining and Filling
  useEffect(() => {
    // Clear any existing interval
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (!session) return;

    let startTimeString: string | null = null;
    let endTimeString: string | null = null;

    if (session.status === 'DRAINING') {
      startTimeString = session.drainStartTime;
      endTimeString = session.drainEndTime;
    } else if (session.status === 'FILLING') {
      startTimeString = session.fillStartTime;
      endTimeString = session.fillEndTime;
    }

    if (startTimeString) {
      const startTime = new Date(startTimeString).getTime();
      
      const tick = () => {
        const now = endTimeString ? new Date(endTimeString).getTime() : Date.now();
        const diff = Math.max(0, Math.floor((now - startTime) / 1000));
        setElapsedSeconds(diff);
      };

      tick(); // run once immediately

      // If active (no end time yet), tick every second
      if (!endTimeString) {
        timerIntervalRef.current = setInterval(tick, 1000);
      }
    } else {
      setElapsedSeconds(0);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [session?.status, session?.drainStartTime, session?.drainEndTime, session?.fillStartTime, session?.fillEndTime]);

  // Handle Flush countdown timer
  useEffect(() => {
    if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);

    if (session?.status === 'FLUSHING') {
      setFlushCountdown(10);
      flushIntervalRef.current = setInterval(() => {
        setFlushCountdown((prev) => {
          if (prev <= 1) {
            if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
    };
  }, [session?.status]);

  // Helper: Format duration to mm:ss
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Validation functions
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!preWeight) {
      newErrors.preWeight = 'กรุณากรอกน้ำหนักตัวก่อนทำ';
    } else {
      const val = parseFloat(preWeight);
      if (isNaN(val) || val < 30 || val > 150) {
        newErrors.preWeight = 'น้ำหนักควรอยู่ระหว่าง 30 ถึง 150 กิโลกรัม';
      }
    }

    if (preTemp) {
      const val = parseFloat(preTemp);
      if (isNaN(val) || val < 34 || val > 42) {
        newErrors.preTemp = 'อุณหภูมิร่างกายควรอยู่ระหว่าง 34.0 ถึง 42.0 °C';
      }
    }

    if (preBpSys) {
      const val = parseInt(preBpSys);
      if (isNaN(val) || val < 60 || val > 240) {
        newErrors.preBpSys = 'ค่าความดันตัวบน (SYS) ควรอยู่ระหว่าง 60 ถึง 240 mmHg';
      }
    }

    if (preBpDia) {
      const val = parseInt(preBpDia);
      if (isNaN(val) || val < 30 || val > 150) {
        newErrors.preBpDia = 'ค่าความดันตัวล่าง (DIA) ควรอยู่ระหว่าง 30 ถึง 150 mmHg';
      }
    }

    if (prePulse) {
      const val = parseInt(prePulse);
      if (isNaN(val) || val < 30 || val > 200) {
        newErrors.prePulse = 'ชีพจรควรอยู่ระหว่าง 30 ถึง 200 bpm';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!drainVolume) {
      newErrors.drainVolume = 'กรุณากรอกปริมาณน้ำยาปล่อยออก';
    } else {
      const val = parseFloat(drainVolume);
      if (isNaN(val) || val < 0 || val > 5000) {
        newErrors.drainVolume = 'ปริมาณน้ำยาปล่อยออกควรอยู่ระหว่าง 0 ถึง 5000 mL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = () => {
    const newErrors: Record<string, string> = {};
    if (!fillVolume) {
      newErrors.fillVolume = 'กรุณากรอกปริมาณน้ำยาเติมเข้า';
    } else {
      const val = parseFloat(fillVolume);
      if (isNaN(val) || val < 500 || val > 4000) {
        newErrors.fillVolume = 'ปริมาณน้ำยาเติมเข้าควรอยู่ระหว่าง 500 ถึง 4000 mL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep5 = () => {
    const newErrors: Record<string, string> = {};
    if (postWeight) {
      const val = parseFloat(postWeight);
      if (isNaN(val) || val < 30 || val > 150) {
        newErrors.postWeight = 'น้ำหนักควรอยู่ระหว่าง 30 ถึง 150 กิโลกรัม';
      }
    }

    if (postTemp) {
      const val = parseFloat(postTemp);
      if (isNaN(val) || val < 34 || val > 42) {
        newErrors.postTemp = 'อุณหภูมิร่างกายควรอยู่ระหว่าง 34.0 ถึง 42.0 °C';
      }
    }

    if (postBpSys) {
      const val = parseInt(postBpSys);
      if (isNaN(val) || val < 60 || val > 240) {
        newErrors.postBpSys = 'ค่าความดันตัวบน (SYS) ควรอยู่ระหว่าง 60 ถึง 240 mmHg';
      }
    }

    if (postBpDia) {
      const val = parseInt(postBpDia);
      if (isNaN(val) || val < 30 || val > 150) {
        newErrors.postBpDia = 'ค่าความดันตัวล่าง (DIA) ควรอยู่ระหว่าง 30 ถึง 150 mmHg';
      }
    }

    if (postPulse) {
      const val = parseInt(postPulse);
      if (isNaN(val) || val < 30 || val > 200) {
        newErrors.postPulse = 'ชีพจรควรอยู่ระหว่าง 30 ถึง 200 bpm';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // State transitions triggers
  // 1. Start Draining
  const startDraining = async () => {
    if (!validateStep1()) return;
    try {
      const payload = {
        status: 'DRAINING',
        drainStartTime: new Date().toISOString(),
        preWeight: preWeight ? parseFloat(preWeight) : null,
        preBpSys: preBpSys ? parseInt(preBpSys) : null,
        preBpDia: preBpDia ? parseInt(preBpDia) : null,
        prePulse: prePulse ? parseInt(prePulse) : null,
        preTemp: preTemp ? parseFloat(preTemp) : null,
      };

      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการเริ่มขั้นตอน Drain');
      const data = await res.json();
      setSession(data.session);
      setErrors({});
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 2. Start Flushing (End Draining)
  const startFlushing = async () => {
    if (!validateStep2()) return;
    try {
      const payload = {
        status: 'FLUSHING',
        drainEndTime: new Date().toISOString(),
        drainVolume: drainVolume ? parseFloat(drainVolume) : null,
        drainColor,
        flushTime: new Date().toISOString(),
      };

      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการหยุดขั้นตอน Drain');
      const data = await res.json();
      setSession(data.session);
      setErrors({});
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 3. Start Filling
  const startFilling = async () => {
    try {
      const payload = {
        status: 'FILLING',
        fillStartTime: new Date().toISOString(),
      };

      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการเริ่มขั้นตอน Fill');
      const data = await res.json();
      setSession(data.session);
      setErrors({});
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 4. End Filling (Move to Post-Exchange checks stage locally in UI)
  const endFilling = async () => {
    if (!validateStep4()) return;
    try {
      const payload = {
        status: 'POST_CHECK', // We will temporarily use this state locally
        fillEndTime: new Date().toISOString(),
        fillVolume: fillVolume ? parseFloat(fillVolume) : null,
        dextrosePct: dextrosePct ? parseFloat(dextrosePct) : null,
      };

      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการเสร็จสิ้นขั้นตอน Fill');
      const data = await res.json();
      setSession({
        ...data.session,
        status: 'POST_CHECK' // Set status locally in state for UI display
      });
      setErrors({});

      // Default fill postWeight to preWeight if empty
      if (!postWeight && data.session.preWeight) {
        setPostWeight(data.session.preWeight.toString());
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 5. Save & Complete Session
  const saveAndComplete = async () => {
    if (!validateStep5()) return;
    try {
      const dVol = session?.drainVolume || parseFloat(drainVolume);
      const fVol = parseFloat(fillVolume);
      const netUf = dVol - fVol;

      const payload = {
        status: 'COMPLETED',
        postWeight: postWeight ? parseFloat(postWeight) : null,
        postBpSys: postBpSys ? parseInt(postBpSys) : null,
        postBpDia: postBpDia ? parseInt(postBpDia) : null,
        postPulse: postPulse ? parseInt(postPulse) : null,
        postTemp: postTemp ? parseFloat(postTemp) : null,
        symptoms: symptoms || null,
        netUf,
      };

      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการบันทึกข้อมูลเสร็จสิ้น');
      setErrors({});
      
      router.push('/');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Cancel Session
  const cancelSession = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = async () => {
    setShowCancelConfirm(false);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });

      if (!res.ok) throw new Error('ไม่สามารถยกเลิกรายการได้');
      router.push('/');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className={styles.loadingContainer}>กำลังโหลดข้อมูลกระบวนการล้างไต...</div>;
  }

  if (error || !session) {
    return (
      <div className={styles.errorContainer}>
        <h2>เกิดข้อผิดพลาด</h2>
        <p>{error || 'ไม่พบรายการฟอกไต'}</p>
        <button onClick={() => router.push('/')} className="btn btn-primary">กลับไปแดชบอร์ด</button>
      </div>
    );
  }

  // Determine current active step index (1 to 5)
  const getStepIndex = (status: string) => {
    switch (status) {
      case 'PREPARATION': return 1;
      case 'DRAINING': return 2;
      case 'FLUSHING': return 3;
      case 'FILLING': return 4;
      case 'POST_CHECK': return 5;
      case 'COMPLETED': return 5;
      default: return 1;
    }
  };

  const currentStep = getStepIndex(session.status);

  return (
    <div className={styles.container}>
      {/* Mini Header */}
      <header className={`${styles.header} glass`}>
        <button onClick={() => router.push('/')} className={styles.backBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
          แดชบอร์ด
        </button>
        <div className={styles.patientBanner}>
          <span>คนไข้:</span>
          <strong>{session.patient.firstName} {session.patient.lastName}</strong>
          <span className={styles.patientHn}>HN: {session.patient.hn}</span>
          <span className={styles.cycleBadge}>รอบที่ {session.cycleNumber}</span>
        </div>
        <button onClick={cancelSession} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '13px' }}>
          ยกเลิกรอบฟอกไต
        </button>
      </header>

      {/* Progress Bar Visualizer */}
      <section className={styles.progressContainer}>
        <div className={styles.progressHeader}>
          <span className={styles.progressText}>
            ขั้นตอนที่ <strong>{currentStep}</strong> จาก 5: <strong>{
              currentStep === 1 ? 'การเตรียมอุปกรณ์และสัญญาณชีพ' :
              currentStep === 2 ? 'ปล่อยน้ำออก (Drain)' :
              currentStep === 3 ? 'ล้างสาย (Flush)' :
              currentStep === 4 ? 'เติมน้ำยาใหม่ (Fill)' :
              'บันทึกผลการทำหลังเปลี่ยนถ่าย'
            }</strong>
          </span>
          <span className={styles.progressPercent}>{currentStep * 20}%</span>
        </div>
        <div className={styles.progressBarBg}>
          <div className={styles.progressBarFill} style={{ width: `${currentStep * 20}%` }} />
        </div>
      </section>

      {/* Main Stepper Panels */}
      <main className={styles.mainContent}>
        <div className={`${styles.cardPanel} card fade-in`}>
          
          {/* STEP 1: PREPARATION */}
          {session.status === 'PREPARATION' && (
            <div className={styles.stepContent}>
              <div className={styles.stepHeader}>
                <h2>ขั้นตอนที่ 1: การเตรียมอุปกรณ์และสัญญาณชีพคนไข้</h2>
                <p>บันทึกค่าวัดพื้นฐานของคนไข้และล้างมือก่อนเริ่มดำเนินการ</p>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="preWeight">น้ำหนักตัวก่อนทำ (kg) *</label>
                  <input
                    id="preWeight"
                    type="number"
                    step="0.01"
                    placeholder="เช่น 60.5"
                    value={preWeight}
                    onChange={(e) => {
                      setPreWeight(e.target.value);
                      if (errors.preWeight) setErrors(prev => ({ ...prev, preWeight: '' }));
                    }}
                    required
                  />
                  {errors.preWeight && <span className={styles.errorText}>{errors.preWeight}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="preTemp">อุณหภูมิร่างกาย (°C)</label>
                  <input
                    id="preTemp"
                    type="number"
                    step="0.1"
                    placeholder="เช่น 36.5"
                    value={preTemp}
                    onChange={(e) => {
                      setPreTemp(e.target.value);
                      if (errors.preTemp) setErrors(prev => ({ ...prev, preTemp: '' }));
                    }}
                  />
                  {errors.preTemp && <span className={styles.errorText}>{errors.preTemp}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="preBpSys">ความดันโลหิตตัวบน SYS (mmHg)</label>
                  <input
                    id="preBpSys"
                    type="number"
                    placeholder="เช่น 120"
                    value={preBpSys}
                    onChange={(e) => {
                      setPreBpSys(e.target.value);
                      if (errors.preBpSys) setErrors(prev => ({ ...prev, preBpSys: '' }));
                    }}
                  />
                  {errors.preBpSys && <span className={styles.errorText}>{errors.preBpSys}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="preBpDia">ความดันโลหิตตัวล่าง DIA (mmHg)</label>
                  <input
                    id="preBpDia"
                    type="number"
                    placeholder="เช่น 80"
                    value={preBpDia}
                    onChange={(e) => {
                      setPreBpDia(e.target.value);
                      if (errors.preBpDia) setErrors(prev => ({ ...prev, preBpDia: '' }));
                    }}
                  />
                  {errors.preBpDia && <span className={styles.errorText}>{errors.preBpDia}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="prePulse">ชีพจร / อัตราการเต้นของหัวใจ (bpm)</label>
                  <input
                    id="prePulse"
                    type="number"
                    placeholder="เช่น 78"
                    value={prePulse}
                    onChange={(e) => {
                      setPrePulse(e.target.value);
                      if (errors.prePulse) setErrors(prev => ({ ...prev, prePulse: '' }));
                    }}
                  />
                  {errors.prePulse && <span className={styles.errorText}>{errors.prePulse}</span>}
                </div>
              </div>

              <div className={styles.actionsBar}>
                <div></div>
                <button onClick={startDraining} className="btn btn-primary btn-lg">
                  เริ่มปล่อยน้ำยาเก่าออก (Start Drain)
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: DRAINING */}
          {session.status === 'DRAINING' && (
            <div className={styles.stepContent}>
              <div className={styles.stepHeader}>
                <h2>ขั้นตอนที่ 2: ปล่อยน้ำยาเก่าออกจากช่องท้อง (Draining)</h2>
                <p>เปิดสายล้างไตและปล่อยให้น้ำยาล้างไตไหลลงถุงรองรับจนหมด</p>
              </div>

              {/* Running Timer */}
              <div className={`${styles.timerBox} fade-in`}>
                <span className={styles.timerTitle}>กำลังบันทึกเวลา Drain...</span>
                <span className={styles.timerValue}>{formatTime(elapsedSeconds)}</span>
                <span className={styles.timerStartText}>เริ่มเวลา: {new Date(session.drainStartTime!).toLocaleTimeString('th-TH')}</span>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="drainVol">ปริมาณน้ำยาเก่าที่ไหลออก (mL) *</label>
                  <input
                    id="drainVol"
                    type="number"
                    placeholder="เช่น 2100"
                    value={drainVolume}
                    onChange={(e) => {
                      setDrainVolume(e.target.value);
                      if (errors.drainVolume) setErrors(prev => ({ ...prev, drainVolume: '' }));
                    }}
                    required
                  />
                  {errors.drainVolume && <span className={styles.errorText}>{errors.drainVolume}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="drainCol">ลักษณะสีและความใสของน้ำยา *</label>
                  <select id="drainCol" value={drainColor || 'Clear'} onChange={(e) => setDrainColor(e.target.value)}>
                    <option value="Clear">ใสไม่มีตะกอน (Clear)</option>
                    <option value="Cloudy">ขุ่นมีตะกอน (Cloudy) - เฝ้าระวัง Peritonitis</option>
                    <option value="Bloody">มีเลือดปน (Bloody / Pinkish)</option>
                    <option value="Fibrin">มีใยโปรตีน / ลิ่มเลือดปน (Fibrin)</option>
                  </select>
                </div>
              </div>

              <div className={styles.actionsBar}>
                <div></div>
                <button onClick={startFlushing} className="btn btn-primary btn-lg">
                  หยุดปล่อยน้ำยา & เริ่มล้างสาย (Flush)
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FLUSHING */}
          {session.status === 'FLUSHING' && (
            <div className={styles.stepContent}>
              <div className={styles.stepHeader}>
                <h2>ขั้นตอนที่ 3: การล้างสายสั้น (Flushing)</h2>
                <p>ปล่อยน้ำยาใหม่จากถุงใหม่ไหลเข้าช่องเก็บน้ำเสียโดยตรงประมาณ 5-10 วินาที เพื่อล้างคราบสกปรกที่ข้อต่อสายสั้น</p>
              </div>

              {/* Countdown Timer */}
              <div className={styles.countdownWrapper}>
                <div className={`${styles.countdownCircle} ${flushCountdown === 0 ? styles.countdownCompleted : ''}`}>
                  <span className={styles.countdownNumber}>{flushCountdown}</span>
                  <span className={styles.countdownLabel}>วินาที</span>
                </div>
                <p className={styles.countdownText}>
                  {flushCountdown > 0 ? 'กำลังนับถอยหลังในการล้างสาย...' : 'การล้างสายเสร็จสมบูรณ์! สามารถปล่อยน้ำยาใหม่เข้าช่องท้องได้'}
                </p>
              </div>

              <div className={styles.actionsBar}>
                <div></div>
                <button
                  onClick={startFilling}
                  className={`btn btn-lg ${flushCountdown === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ animation: flushCountdown === 0 ? 'pulseBorder 2s infinite' : 'none' }}
                >
                  เริ่มใส่ตู้น้ำยาใหม่ (Start Fill)
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: FILLING */}
          {session.status === 'FILLING' && (
            <div className={styles.stepContent}>
              <div className={styles.stepHeader}>
                <h2>ขั้นตอนที่ 4: เติมน้ำยาใหม่เข้าสู่ช่องท้อง (Filling)</h2>
                <p>ปล่อยน้ำยาตัวใหม่ไหลเข้าช่องท้องตามปริมาณสเปกที่ต้องการแช่</p>
              </div>

              {/* Running Timer */}
              <div className={`${styles.timerBox} fade-in`} style={{ background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.1) 0%, rgba(2, 132, 199, 0) 100%)' }}>
                <span className={styles.timerTitle} style={{ color: 'var(--secondary)' }}>กำลังบันทึกเวลา Fill...</span>
                <span className={styles.timerValue} style={{ color: 'var(--secondary)' }}>{formatTime(elapsedSeconds)}</span>
                <span className={styles.timerStartText}>เริ่มเวลา: {new Date(session.fillStartTime!).toLocaleTimeString('th-TH')}</span>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="fillVol">ปริมาณน้ำยาใหม่ที่ใส่เข้า (mL) *</label>
                  <input
                    id="fillVol"
                    type="number"
                    placeholder="เช่น 2000"
                    value={fillVolume}
                    onChange={(e) => {
                      setFillVolume(e.target.value);
                      if (errors.fillVolume) setErrors(prev => ({ ...prev, fillVolume: '' }));
                    }}
                    required
                  />
                  {errors.fillVolume && <span className={styles.errorText}>{errors.fillVolume}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="dextrose">ชนิดความเข้มข้นน้ำตาล (% Dextrose) *</label>
                  <select id="dextrose" value={dextrosePct} onChange={(e) => setDextrosePct(e.target.value)}>
                    <option value="1.5">1.5% Dextrose (สีเหลือง)</option>
                    <option value="2.5">2.5% Dextrose (สีเขียว)</option>
                    <option value="4.25">4.25% Dextrose (สีแดง)</option>
                  </select>
                </div>
              </div>

              <div className={styles.actionsBar}>
                <div></div>
                <button onClick={endFilling} className="btn btn-primary btn-lg">
                  เสร็จสิ้นการเติมน้ำยา & ตรวจร่างกายหลังทำ
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: POST-CHECKS / SUMMARY */}
          {session.status === 'POST_CHECK' && (
            <div className={styles.stepContent}>
              <div className={styles.stepHeader}>
                <h2>ขั้นตอนสุดท้าย: บันทึกข้อมูลและสรุปผลหลังเสร็จสิ้นกระบวนการ</h2>
                <p>บันทึกน้ำหนักตัวคนไข้หลังล้าง สัญญาณชีพ และตรวจสอบปริมาณน้ำยาที่แลกเปลี่ยน</p>
              </div>

              {/* Summary Stats Badges */}
              <div className={styles.summaryStatsBox}>
                <div className={styles.summaryCard}>
                  <span>น้ำยาออก (Drain)</span>
                  <strong>{session.drainVolume} mL</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>น้ำยาเข้า (Fill)</span>
                  <strong>{session.fillVolume} mL</strong>
                </div>
                <div className={`${styles.summaryCard} ${styles.ufSummaryCard}`} style={{
                  backgroundColor: ((session.drainVolume || 0) - (session.fillVolume || 0)) >= 0 ? 'var(--success-light)' : 'var(--danger-light)'
                }}>
                  <span>ยอดน้ำส่วนเกินที่ดึงออก (Net UF)</span>
                  <strong style={{
                    color: ((session.drainVolume || 0) - (session.fillVolume || 0)) >= 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {((session.drainVolume || 0) - (session.fillVolume || 0)) >= 0 ? '+' : ''}
                    {(session.drainVolume || 0) - (session.fillVolume || 0)} mL
                  </strong>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="postWeight">น้ำหนักตัวหลังล้างไตเสร็จ (kg)</label>
                  <input
                    id="postWeight"
                    type="number"
                    step="0.01"
                    placeholder="เช่น 60.3"
                    value={postWeight}
                    onChange={(e) => {
                      setPostWeight(e.target.value);
                      if (errors.postWeight) setErrors(prev => ({ ...prev, postWeight: '' }));
                    }}
                  />
                  {errors.postWeight && <span className={styles.errorText}>{errors.postWeight}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="postTemp">อุณหภูมิร่างกายหลังทำ (°C)</label>
                  <input
                    id="postTemp"
                    type="number"
                    step="0.1"
                    placeholder="เช่น 36.4"
                    value={postTemp}
                    onChange={(e) => {
                      setPostTemp(e.target.value);
                      if (errors.postTemp) setErrors(prev => ({ ...prev, postTemp: '' }));
                    }}
                  />
                  {errors.postTemp && <span className={styles.errorText}>{errors.postTemp}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="postBpSys">ความดันโลหิตหลังทำ SYS (mmHg)</label>
                  <input
                    id="postBpSys"
                    type="number"
                    placeholder="เช่น 118"
                    value={postBpSys}
                    onChange={(e) => {
                      setPostBpSys(e.target.value);
                      if (errors.postBpSys) setErrors(prev => ({ ...prev, postBpSys: '' }));
                    }}
                  />
                  {errors.postBpSys && <span className={styles.errorText}>{errors.postBpSys}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="postBpDia">ความดันโลหิตหลังทำ DIA (mmHg)</label>
                  <input
                    id="postBpDia"
                    type="number"
                    placeholder="เช่น 76"
                    value={postBpDia}
                    onChange={(e) => {
                      setPostBpDia(e.target.value);
                      if (errors.postBpDia) setErrors(prev => ({ ...prev, postBpDia: '' }));
                    }}
                  />
                  {errors.postBpDia && <span className={styles.errorText}>{errors.postBpDia}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="postPulse">ชีพจรหลังทำ (bpm)</label>
                  <input
                    id="postPulse"
                    type="number"
                    placeholder="เช่น 76"
                    value={postPulse}
                    onChange={(e) => {
                      setPostPulse(e.target.value);
                      if (errors.postPulse) setErrors(prev => ({ ...prev, postPulse: '' }));
                    }}
                  />
                  {errors.postPulse && <span className={styles.errorText}>{errors.postPulse}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="symptoms">อาการข้างเคียงหรือบันทึกเพิ่มเติม (ถ้ามี)</label>
                  <textarea
                    id="symptoms"
                    rows={3}
                    placeholder="เช่น ปกติดี ไม่มีอาการปวดท้อง แน่นหน้าอก หรือตะคริว"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.actionsBar}>
                <div></div>
                <button onClick={saveAndComplete} className="btn btn-success btn-lg">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  บันทึกสำเร็จและเสร็จสิ้นกระบวนการ (Complete)
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
      <ConfirmDialog
        isOpen={showCancelConfirm}
        message="ต้องการยกเลิกรอบฟอกไตนี้และลบข้อมูลรายการนี้ ใช่หรือไม่? (ไม่สามารถกู้คืนได้)"
        onConfirm={handleConfirmCancel}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}
