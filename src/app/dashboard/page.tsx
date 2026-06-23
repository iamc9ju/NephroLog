'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';

interface Patient {
  id: string;
  hn: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  bloodGroup: string | null;
  createdAt: string;
}

interface Session {
  id: string;
  patientId: string;
  patient: Patient;
  nurseName: string;
  cycleNumber: number;
  status: string;
  preWeight: number | null;
  netUf: number | null;
  createdAt: string;
}

export default function NurseDashboard() {
  const router = useRouter();
  const [nurseName, setNurseName] = useState('พยาบาล');
  
  // Data lists
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // New Patient Form
  const [hn, setHn] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [bloodGroup, setBloodGroup] = useState('A');
  const [formError, setFormError] = useState('');
  const [submittingPatient, setSubmittingPatient] = useState(false);

  // Load Dashboard Data
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get current session for name
      const userRes = await fetch('/api/auth/login', { method: 'GET' }).catch(() => null);
      // Wait, we can get user identity from cookie, let's decode or pull from a profile endpoint. Since we set it in jwt, we can fetch it. Let's make a simple client decode or assume default nurse name, or extract from session. Let's create an API endpoint `/api/auth/me` to get the logged-in user details. That is the cleanest!
      // In this code, let's call the endpoints:
      const pRes = await fetch('/api/patients');
      const sActiveRes = await fetch('/api/sessions?active=true');
      const sAllRes = await fetch('/api/sessions');

      if (pRes.ok) {
        const pData = await pRes.json();
        setPatients(pData.patients || []);
      }
      if (sActiveRes.ok) {
        const sActiveData = await sActiveRes.json();
        setActiveSessions(sActiveData.sessions || []);
      }
      if (sAllRes.ok) {
        const sAllData = await sAllRes.json();
        setAllSessions(sAllData.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Fetch profile details
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setNurseName(data.user.name);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmittingPatient(true);

    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hn, firstName, lastName, birthDate, bloodGroup }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ล้มเหลวในการบันทึกข้อมูลคนไข้');
      }

      // Success
      setShowRegisterModal(false);
      // Reset form
      setHn('');
      setFirstName('');
      setLastName('');
      setBirthDate('');
      setBloodGroup('A');
      
      // Reload lists
      loadData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmittingPatient(false);
    }
  };


  // Filter patients by search query
  const filteredPatients = patients.filter((patient) => {
    const q = searchQuery.toLowerCase();
    return (
      patient.hn.toLowerCase().includes(q) ||
      patient.firstName.toLowerCase().includes(q) ||
      patient.lastName.toLowerCase().includes(q)
    );
  });

  // Calculate statistics
  const todaySessions = allSessions.filter((s) => {
    const today = new Date().toDateString();
    return new Date(s.createdAt).toDateString() === today;
  });

  const completedToday = todaySessions.filter((s) => s.status === 'COMPLETED');
  
  // Calculate average Net UF
  const netUfSum = completedToday.reduce((sum, s) => sum + (s.netUf || 0), 0);
  const avgNetUf = completedToday.length > 0 ? Math.round(netUfSum / completedToday.length) : 0;

  return (
    <div className={styles.container}>
      {/* Navigation Header */}
      <header className={`${styles.header} glass`}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="currentColor"/>
            </svg>
            <span>NephroLog</span>
          </div>
          <span className={styles.divider}>|</span>
          <span className={styles.nurseIdentity}>พยาบาลผู้บันทึก: <strong>{nurseName}</strong></span>
        </div>
        <button onClick={handleLogout} className={`${styles.logoutBtn} btn btn-secondary`}>
          ออกจากระบบ
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </header>

      {/* Main Content Layout */}
      <main className={styles.main}>
        {/* Stats Section */}
        <section className={styles.statsGrid}>
          <div className={`${styles.statCard} card`}>
            <div className={styles.statIcon} style={{ backgroundColor: 'transparent', padding: 0 }}>
              <img src="/logo.png" alt="โลโก้น้ำยาฟอกไต" width="52" height="52" style={{ objectFit: 'contain', borderRadius: '50%' }} />
            </div>
            <div className={styles.statInfo}>
              <h3>รายการเปลี่ยนน้ำยาวันนี้</h3>
              <p className={styles.statValue}>{todaySessions.length} <span>รอบ</span></p>
              <span className={styles.statSubText}>เสร็จสิ้นแล้ว {completedToday.length} รอบ</span>
            </div>
          </div>
          <div className={`${styles.statCard} card`}>
            <div className={styles.statIcon} style={{ backgroundColor: 'transparent', padding: 0 }}>
              <img src="/logo-active.png" alt="โลโก้กำลังฟอกไต" width="52" height="52" style={{ objectFit: 'contain', borderRadius: '50%' }} />
            </div>
            <div className={styles.statInfo}>
              <h3>กำลังฟอกไตอยู่ในขณะนี้</h3>
              <p className={styles.statValue}>{activeSessions.length} <span>เตียง</span></p>
              <span className={styles.statSubText}>กำลังบันทึกเวลาขั้นตอน</span>
            </div>
          </div>
          <div className={`${styles.statCard} card`}>
            <div className={styles.statIcon} style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div className={styles.statInfo}>
              <h3>ค่าเฉลี่ย Net UF วันนี้</h3>
              <p className={styles.statValue} style={{ color: avgNetUf >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {avgNetUf > 0 ? `+${avgNetUf}` : avgNetUf} <span>mL</span>
              </p>
              <span className={styles.statSubText}>เป้าหมายเฉลี่ยเป็นค่าบวก</span>
            </div>
          </div>
        </section>

        <div className={styles.dashboardSplit}>
          {/* Patients Directory */}
          <section className={styles.patientsSection}>
            <div className={styles.sectionHeader}>
              <h2>ทำเนียบคนไข้ฟอกไต ({patients.length})</h2>
              <button onClick={() => setShowRegisterModal(true)} className={styles.registerBtn}>
                <span>ลงทะเบียน</span>
              </button>
            </div>

            <div className={styles.searchBar}>
              <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input
                type="text"
                placeholder="ค้นหาคนไข้ ด้วย HN, ชื่อ หรือนามสกุล..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>HN</th>
                    <th>ชื่อ - นามสกุล</th>
                    <th>กลุ่มเลือด</th>
                    <th>การทำงาน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={styles.noDataCell}>ไม่พบข้อมูลคนไข้ตามคำค้นหา</td>
                    </tr>
                  ) : (
                    filteredPatients.map((patient) => {
                      const isPatientActive = activeSessions.some(as => as.patientId === patient.id);
                      return (
                        <tr key={patient.id}>
                          <td className={styles.hnCell}>{patient.hn}</td>
                          <td>
                            <div className={styles.patientNameCol}>
                              <strong>{patient.firstName} {patient.lastName}</strong>
                              <span>เกิด: {new Date(patient.birthDate).toLocaleDateString('th-TH')}</span>
                            </div>
                          </td>
                          <td><span className={styles.bloodTag}>{patient.bloodGroup || 'ไม่ระบุ'}</span></td>
                          <td>
                            <div className={styles.actionCell}>
                              <button
                                onClick={() => router.push(`/patients/${patient.id}`)}
                                className={styles.historyBtn}
                              >
                                <span>ดูประวัติ</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Register Patient Modal */}
      {showRegisterModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} card fade-in`}>
            <div className={styles.modalHeader}>
              <h2>ลงทะเบียนผู้ป่วยล้างไตรายใหม่</h2>
              <button onClick={() => setShowRegisterModal(false)} className={styles.closeBtn}>&times;</button>
            </div>
            
            {formError && (
              <div className={`${styles.alert} badge-danger`} style={{ marginBottom: '16px' }}>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterPatient} className={styles.modalForm}>
              <div className={styles.modalFormGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="modalHn">HN (เลขประจำตัวผู้ป่วย)*</label>
                  <input
                    id="modalHn"
                    type="text"
                    placeholder="เช่น HN001"
                    value={hn}
                    onChange={(e) => setHn(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="modalBlood">กลุ่มโลหิต (Blood Group)</label>
                  <select
                    id="modalBlood"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="O">O</option>
                    <option value="AB">AB</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="modalFirstName">ชื่อจริง*</label>
                  <input
                    id="modalFirstName"
                    type="text"
                    placeholder="ภาษาไทย"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="modalLastName">นามสกุล*</label>
                  <input
                    id="modalLastName"
                    type="text"
                    placeholder="ภาษาไทย"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                  <label htmlFor="modalDob">วัน/เดือน/ปีเกิด*</label>
                  <input
                    id="modalDob"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="btn btn-secondary"
                  disabled={submittingPatient}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingPatient}
                >
                  {submittingPatient ? 'กำลังบันทึก...' : 'บันทึกข้อมูลคนไข้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
