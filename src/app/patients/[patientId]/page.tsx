'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from './patientDetail.module.css';
import ConfirmDialog from '@/components/ConfirmDialog';
import Navbar from '@/components/Navbar';

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
  nurseName: string;
  cycleNumber: number;
  status: string;
  preWeight: number | null;
  postWeight: number | null;
  drainVolume: number | null;
  fillVolume: number | null;
  drainColor: string | null;
  dextrosePct: number | null;
  netUf: number | null;
  symptoms: string | null;
  createdAt: string;
  drainStartTime: string | null;
  drainEndTime: string | null;
  flushTime: string | null;
  fillStartTime: string | null;
  fillEndTime: string | null;
}

const formatTimeOnly = (dateStr: string | null) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};

const formatTimeSeconds = (dateStr: string | null) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const calculateDurationMinutes = (startStr: string | null, endStr: string | null) => {
  if (!startStr || !endStr) return 0;
  const diff = new Date(endStr).getTime() - new Date(startStr).getTime();
  return Math.round(diff / 60000);
};

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.patientId as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Redesign history states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeType, setDateRangeType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [drainColorFilter, setDrainColorFilter] = useState('all');


  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch patient details by retrieving patient list and filtering
      // Since our GET /api/patients returns all patients, we can filter or fetch directly
      const pRes = await fetch('/api/patients');
      if (!pRes.ok) throw new Error('ไม่สามารถดึงข้อมูลคนไข้ได้');
      const pData = await pRes.json();
      
      const foundPatient = (pData.patients || []).find((p: Patient) => p.id === patientId);
      if (!foundPatient) {
        throw new Error('ไม่พบข้อมูลคนไข้รายนี้ในระบบ');
      }
      setPatient(foundPatient);

      // Fetch sessions for this patient
      const sRes = await fetch(`/api/sessions?patientId=${patientId}`);
      if (!sRes.ok) throw new Error('ไม่สามารถดึงประวัติการฟอกไตได้');
      const sData = await sRes.json();
      setSessions(sData.sessions || []);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);



  if (loading) {
    return <div className={styles.loadingContainer}>กำลังโหลดข้อมูลคนไข้...</div>;
  }

  if (error || !patient) {
    return (
      <div className={styles.errorContainer}>
        <h2>เกิดข้อผิดพลาด</h2>
        <p>{error || 'ไม่พบข้อมูลคนไข้'}</p>
        <button onClick={() => router.push('/dashboard')} className="btn btn-primary">กลับไปหน้าแดชบอร์ด</button>
      </div>
    );
  }

  const completedSessions = sessions.filter(s => s.status === 'COMPLETED');
  const totalCycles = completedSessions.length;
  const netUfSum = completedSessions.reduce((sum, s) => sum + (s.netUf || 0), 0);
  const avgNetUf = totalCycles > 0 ? Math.round(netUfSum / totalCycles) : 0;

  // 1. Search Query & Filters
  const filteredSessions = sessions.filter(session => {
    // Search Query (symptom, cycleNumber, nurseName)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cycleMatch = `รอบที่ ${session.cycleNumber}`.toLowerCase().includes(q) || session.cycleNumber.toString().includes(q);
      const symptomMatch = session.symptoms?.toLowerCase().includes(q) || false;
      const nurseMatch = session.nurseName?.toLowerCase().includes(q) || false;
      if (!cycleMatch && !symptomMatch && !nurseMatch) {
        return false;
      }
    }

    // Date Range Filter
    const createdDate = new Date(session.createdAt);
    const now = new Date();
    if (dateRangeType === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      if (createdDate < sevenDaysAgo) return false;
    } else if (dateRangeType === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      if (createdDate < thirtyDaysAgo) return false;
    } else if (dateRangeType === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      if (createdDate < startOfMonth) return false;
    } else if (dateRangeType === 'custom') {
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (createdDate < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (createdDate > eDate) return false;
      }
    }

    // Drain Color Filter
    if (drainColorFilter !== 'all') {
      if (session.drainColor !== drainColorFilter) return false;
    }

    return true;
  });

  // Reset page handlers when filters change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };
  const handleDateRangeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateRangeType(e.target.value);
    setCurrentPage(1);
  };
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
    setCurrentPage(1);
  };
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
    setCurrentPage(1);
  };
  const handleColorFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDrainColorFilter(e.target.value);
    setCurrentPage(1);
  };
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalFiltered = filteredSessions.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedSessions = filteredSessions.slice(startIndex, startIndex + pageSize);

  return (

    <div className={styles.container}>
      <Navbar
        role="nurse"
        pageType="patientDetail"
      />

      <main className={styles.main}>
        {/* Profile Details */}
        <section className={`${styles.profileCard} card`}>
          <div className={styles.avatar}>
            <span>{patient.firstName.charAt(0)}</span>
          </div>
          <div className={styles.info}>
            <div className={styles.nameHeader}>
              <h2>คุณ{patient.firstName} {patient.lastName}</h2>
              <span className={styles.hnBadge}>HN: {patient.hn}</span>
            </div>
            <div className={styles.metaGrid}>
              <div>
                <span>วันเกิด:</span>
                <strong>{new Date(patient.birthDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
              </div>
              <div>
                <span>กรุ๊ปเลือด:</span>
                <strong>{patient.bloodGroup || 'ไม่ระบุ'}</strong>
              </div>
              <div>
                <span>วันที่ขึ้นทะเบียน:</span>
                <strong>{new Date(patient.createdAt).toLocaleDateString('th-TH')}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className={styles.statsGrid}>
          <div className={`${styles.statCard} card`}>
            <h3>จำนวนการฟอกไตสำเร็จสะสม</h3>
            <p className={styles.statVal}>{totalCycles} <span>รอบ</span></p>
          </div>
          <div className={`${styles.statCard} card`}>
            <h3>ค่าเฉลี่ย Net UF ที่ดึงออกได้</h3>
            <p className={styles.statVal} style={{ color: avgNetUf >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {avgNetUf > 0 ? `+${avgNetUf}` : avgNetUf} <span>mL</span>
            </p>
          </div>
        </section>

        {/* Sessions History Table */}
        <section className={styles.historySection}>
          <div className={styles.historyHeader}>
            <h2>ประวัติการทำรายการล้างไตทั้งหมด ({sessions.length} รายการ)</h2>
            <button onClick={() => window.print()} className="btn btn-secondary" style={{ display: 'inline-flex', gap: '8px', fontSize: '13px', padding: '6px 14px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              พิมพ์ / บันทึกรายงาน PDF
            </button>
          </div>
          
          <div className={styles.filterSection}>
            <div className={styles.filterRow}>
              <div className={styles.searchBox}>
                <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1875FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="ค้นหารอบที่, อาการ หรือผู้บันทึก..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }} className={styles.clearSearchBtn}>
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className={styles.filterGrid}>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1875FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.labelIcon}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  ช่วงเวลา
                </label>
                <select value={dateRangeType} onChange={handleDateRangeTypeChange} className={styles.filterSelect}>
                  <option value="all">ทั้งหมด</option>
                  <option value="7days">7 วันล่าสุด</option>
                  <option value="30days">30 วันล่าสุด</option>
                  <option value="thisMonth">เดือนนี้</option>
                  <option value="custom">ระบุช่วงเวลาเอง</option>
                </select>
              </div>

              {dateRangeType === 'custom' && (
                <>
                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1875FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.labelIcon}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      ตั้งแต่วันที่
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={handleStartDateChange}
                      className={styles.filterInput}
                    />
                  </div>
                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1875FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.labelIcon}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      ถึงวันที่
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={handleEndDateChange}
                      className={styles.filterInput}
                    />
                  </div>
                </>
              )}

              <div className={styles.filterField}>
                <label className={styles.filterLabel}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1875FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.labelIcon}>
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                  </svg>
                  สีน้ำยาปล่อยออก
                </label>
                <select value={drainColorFilter} onChange={handleColorFilterChange} className={styles.filterSelect}>
                  <option value="all">ทั้งหมด</option>
                  <option value="Clear">ใส</option>
                  <option value="Cloudy">ขุ่นมีตะกอน</option>
                  <option value="Bloody">มีเลือดปน</option>
                  <option value="Fibrin">มีใยโปรตีน</option>
                </select>
              </div>

              <div className={styles.filterField}>
                <label className={styles.filterLabel}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1875FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.labelIcon}>
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                  แสดงรายการ
                </label>
                <select value={pageSize} onChange={handlePageSizeChange} className={styles.filterSelect}>
                  <option value={5}>5 รายการต่อหน้า</option>
                  <option value={10}>10 รายการต่อหน้า</option>
                  <option value={20}>20 รายการต่อหน้า</option>
                  <option value={50}>50 รายการต่อหน้า</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>วันที่/เวลาเริ่ม</th>
                  <th>รอบที่</th>
                  <th>ปล่อยน้ำออก (Drain)</th>
                  <th>ล้างสาย (Flush)</th>
                  <th>เติมน้ำยา (Fill)</th>
                  <th>สีน้ำยาออก</th>
                  <th>Net UF</th>
                  <th>ผู้บันทึก</th>
                  <th>อาการและบันทึก</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={styles.noDataCell}>ไม่พบรายการบันทึกที่ตรงตามเงื่อนไขที่ค้นหา</td>
                  </tr>
                ) : (
                  paginatedSessions.map((session) => (
                    <tr key={session.id}>
                      <td className={styles.dateCell}>
                        {new Date(session.createdAt).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className={styles.centerText}><strong>{session.cycleNumber}</strong></td>
                      <td>
                        {session.drainVolume !== null ? (
                          <>
                            <strong>{session.drainVolume} mL</strong>
                            {session.drainStartTime && session.drainEndTime && (
                              <span className={styles.timeMeta}>
                                {formatTimeOnly(session.drainStartTime)} - {formatTimeOnly(session.drainEndTime)} ({calculateDurationMinutes(session.drainStartTime, session.drainEndTime)} นาที)
                              </span>
                            )}
                          </>
                        ) : (
                          session.drainStartTime ? (
                            <span className={styles.timeMeta}>เริ่ม: {formatTimeOnly(session.drainStartTime)} (กำลังปล่อยน้ำ...)</span>
                          ) : '-'
                        )}
                      </td>
                      <td>
                        {session.flushTime ? (
                          <>
                            <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 6px' }}>สำเร็จ</span>
                            <span className={styles.timeMeta}>
                              เวลา: {formatTimeSeconds(session.flushTime)}
                            </span>
                          </>
                        ) : (
                          session.status === 'FLUSHING' ? (
                            <span className={styles.timeMeta}>กำลังล้างสาย...</span>
                          ) : '-'
                        )}
                      </td>
                      <td>
                        {session.fillVolume !== null ? (
                          <>
                            <strong>{session.fillVolume} mL ({session.dextrosePct}%)</strong>
                            {session.fillStartTime && session.fillEndTime && (
                              <span className={styles.timeMeta}>
                                {formatTimeOnly(session.fillStartTime)} - {formatTimeOnly(session.fillEndTime)} ({calculateDurationMinutes(session.fillStartTime, session.fillEndTime)} นาที)
                              </span>
                            )}
                          </>
                        ) : (
                          session.fillStartTime ? (
                            <span className={styles.timeMeta}>เริ่ม: {formatTimeOnly(session.fillStartTime)} (กำลังเติมน้ำ...)</span>
                          ) : (
                            session.status !== 'COMPLETED' ? (
                              <span className="badge badge-warning">ไม่เสร็จสิ้น</span>
                            ) : '-'
                          )
                        )}
                      </td>
                      <td>
                        {session.status === 'COMPLETED' ? (
                          <span className={`badge ${
                            session.drainColor === 'Clear' ? 'badge-success' :
                            session.drainColor === 'Cloudy' ? 'badge-danger' : 'badge-warning'
                          }`}>
                            {session.drainColor === 'Clear' ? 'ใส' :
                             session.drainColor === 'Cloudy' ? 'ขุ่น' :
                             session.drainColor === 'Bloody' ? 'มีเลือด' : 'มีใยโปรตีน'}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {session.status === 'COMPLETED' ? (
                          <span className={styles.netUfText} style={{ color: (session.netUf || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {(session.netUf || 0) >= 0 ? '+' : ''}{session.netUf} mL
                          </span>
                        ) : '-'}
                      </td>
                      <td>{session.nurseName}</td>
                      <td className={styles.symptomsCell} title={session.symptoms || ''}>
                        {session.symptoms || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Hidden print-only view for window.print() representing all matching records */}
          <div className={styles.printOnlyView}>
            <div className={styles.printHeader}>
              <h1>รายงานบันทึกประวัติการฟอกไตผู้ป่วย (NephroLog Report)</h1>
              <div className={styles.printMetaInfo}>
                <p>HN: <strong>{patient.hn}</strong></p>
                <p>ชื่อ-นามสกุล: <strong>คุณ{patient.firstName} {patient.lastName}</strong></p>
                <p>วันเกิด: <strong>{new Date(patient.birthDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
                <p>กลุ่มเลือด: <strong>{patient.bloodGroup || 'ไม่ระบุ'}</strong></p>
                <p>พิมพ์เมื่อวันที่: <strong>{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></p>
              </div>
            </div>

            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>วันที่/เวลาเริ่ม</th>
                  <th>รอบที่</th>
                  <th>ปล่อยออก (Drain)</th>
                  <th>ล้างสาย (Flush)</th>
                  <th>เติมเข้า (Fill)</th>
                  <th>สีน้ำยาออก</th>
                  <th>Net UF</th>
                  <th>ผู้บันทึก</th>
                  <th>อาการและบันทึก</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '16px' }}>ไม่พบรายการบันทึกตามช่วงเวลาที่กำหนด</td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => (
                    <tr key={`print-${session.id}`}>
                      <td>
                        {new Date(session.createdAt).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ textAlign: 'center' }}>{session.cycleNumber}</td>
                      <td>
                        {session.drainVolume !== null ? `${session.drainVolume} mL` : '-'}
                        {session.drainColor && ` (${session.drainColor === 'Clear' ? 'ใส' :
                                                 session.drainColor === 'Cloudy' ? 'ขุ่น' :
                                                 session.drainColor === 'Bloody' ? 'มีเลือด' : 'มีใยโปรตีน'})`}
                        {session.drainStartTime && session.drainEndTime && (
                          <span style={{ fontSize: '9px', display: 'block', color: '#555' }}>
                            ({calculateDurationMinutes(session.drainStartTime, session.drainEndTime)} นาที)
                          </span>
                        )}
                      </td>
                      <td>
                        {session.flushTime ? 'สำเร็จ' : '-'}
                      </td>
                      <td>
                        {session.fillVolume !== null ? `${session.fillVolume} mL (${session.dextrosePct}%)` : '-'}
                        {session.fillStartTime && session.fillEndTime && (
                          <span style={{ fontSize: '9px', display: 'block', color: '#555' }}>
                            ({calculateDurationMinutes(session.fillStartTime, session.fillEndTime)} นาที)
                          </span>
                        )}
                      </td>
                      <td>
                        {session.drainColor === 'Clear' ? 'ใส' :
                         session.drainColor === 'Cloudy' ? 'ขุ่น' :
                         session.drainColor === 'Bloody' ? 'มีเลือด' : session.drainColor ? 'มีใยโปรตีน' : '-'}
                      </td>
                      <td style={{ fontWeight: 'bold' }}>
                        {(session.netUf || 0) >= 0 ? '+' : ''}{session.netUf} mL
                      </td>
                      <td>{session.nurseName}</td>
                      <td>{session.symptoms || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>



          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button 
                onClick={() => setCurrentPage(1)} 
                disabled={safeCurrentPage === 1}
                className={styles.pageBtn}
              >
                «
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={safeCurrentPage === 1}
                className={styles.pageBtn}
              >
                ‹
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => {
                  return Math.abs(p - safeCurrentPage) <= 2 || p === 1 || p === totalPages;
                })
                .map((p, idx, arr) => {
                  const elements = [];
                  if (idx > 0 && p - arr[idx - 1] > 1) {
                    elements.push(<span key={`ellipsis-${p}`} className={styles.paginationEllipsis}>...</span>);
                  }
                  elements.push(
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`${styles.pageBtn} ${safeCurrentPage === p ? styles.pageBtnActive : ''}`}
                    >
                      {p}
                    </button>
                  );
                  return elements;
                })
              }
              
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={safeCurrentPage === totalPages}
                className={styles.pageBtn}
              >
                ›
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={safeCurrentPage === totalPages}
                className={styles.pageBtn}
              >
                »
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
