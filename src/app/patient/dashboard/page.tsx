'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './patient.module.css';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Patient {
  id: string;
  hn: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  bloodGroup: string | null;
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
  preBpSys?: number | null;
  preBpDia?: number | null;
  prePulse?: number | null;
  preTemp?: number | null;
  postBpSys?: number | null;
  postBpDia?: number | null;
  postPulse?: number | null;
  postTemp?: number | null;
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


export default function PatientDashboard() {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarSrc, setAvatarSrc] = useState('/avatar-boy.png');

  // Redesign history states
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeType, setDateRangeType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [drainColorFilter, setDrainColorFilter] = useState('all');

  // Load avatar from localStorage when patient state is set
  useEffect(() => {
    if (patient?.id) {
      const savedAvatar = localStorage.getItem(`patient_avatar_${patient.id}`);
      if (savedAvatar) {
        setAvatarSrc(savedAvatar);
      } else {
        setAvatarSrc('/avatar-boy.png');
      }
    }
  }, [patient]);


  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch profile
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      
      if (!meRes.ok || !meData.success) {
        router.push('/login');
        return;
      }
      
      // Since logged in as Patient, meData.user has patient profile info
      const patientId = meData.user.id;
      
      // Fetch patient profile details
      const sRes = await fetch(`/api/sessions?patientId=${patientId}`);
      if (sRes.ok) {
        const sData = await sRes.json();
        const completedSessions = (sData.sessions || []).filter((s: Session) => s.status === 'COMPLETED');
        setSessions(completedSessions);
      }

      // Set profile info
      setPatient({
        id: patientId,
        hn: meData.user.hn,
        firstName: meData.user.firstName || meData.user.name.split(' ')[0],
        lastName: meData.user.lastName || meData.user.name.split(' ')[1] || '',
        birthDate: meData.user.birthDate || '',
        bloodGroup: meData.user.bloodGroup || null
      });
    } catch (err) {
      console.error('Failed to load patient dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('ขนาดรูปภาพต้องไม่เกิน 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAvatarSrc(base64String);
        if (patient?.id) {
          localStorage.setItem(`patient_avatar_${patient.id}`, base64String);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    loadData();
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

  const startNewSession = async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถเริ่มบันทึกรอบล้างไตได้');
      }

      router.push(`/tracker/${data.session.id}`);
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    }
  };

  if (loading) {
    return <div className={styles.loadingContainer}>กำลังโหลดข้อมูลประวัติของคุณ...</div>;
  }

  // Render SVG Trend Chart for Net UF (limit to last 7 completed sessions, in chronological order)
  const chartSessions = [...sessions].slice(0, 7).reverse();
  const maxUf = Math.max(...chartSessions.map(s => Math.abs(s.netUf || 0)), 500);
  
  // Chart dimensions
  const width = 500;
  const height = 180;
  const padding = 30;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Compute points
  const points = chartSessions.map((s, idx) => {
    const x = padding + (idx / (chartSessions.length - 1 || 1)) * chartWidth;
    // Map netUf from [-maxUf, maxUf] to [height-padding, padding]
    const y = padding + chartHeight / 2 - ((s.netUf || 0) / maxUf) * (chartHeight / 2);
    return { x, y, val: s.netUf || 0, date: new Date(s.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Calculate statistics from the complete list of sessions
  const totalCompleted = sessions.length;
  const totalNetUf = sessions.reduce((sum, s) => sum + (s.netUf || 0), 0);
  const avgNetUf = totalCompleted > 0 ? Math.round(totalNetUf / totalCompleted) : 0;
  const normalDrainCount = sessions.filter(s => s.drainColor === 'Clear').length;

  const toggleExpand = (sessionId: string) => {
    setExpandedSessionIds(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

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

  const expandAll = () => {
    const allIds: Record<string, boolean> = {};
    filteredSessions.forEach(s => {
      allIds[s.id] = true;
    });
    setExpandedSessionIds(allIds);
  };

  const collapseAll = () => {
    setExpandedSessionIds({});
  };

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
      {/* Navigation Header */}
      <header className={`${styles.header} glass`}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>NephroLog (สำหรับคนไข้)</span>
          </div>
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

      <main className={styles.main}>
        {/* Profile Card */}
        {/* Redesigned Profile Card */}
        <section className={styles.newProfileCard}>
          <div className={styles.profileMainContent}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatarContainer}>
                <img src={avatarSrc} alt="คนไข้" className={styles.avatarImg} />
                <label htmlFor="avatar-upload" className={styles.editBtn} title="อัพโหลดรูปโปรไฟล์">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </label>
                <input 
                  id="avatar-upload" 
                  type="file" 
                  accept="image/*" 
                  onChange={handleAvatarChange} 
                  className={styles.hiddenInput} 
                />
              </div>
            </div>
            
            <div className={styles.profileDetails}>
              <h2 className={styles.profileName}>คุณ{patient?.firstName} {patient?.lastName}</h2>
              
              <div className={styles.heartDivider}>
                <span className={styles.dividerLine}></span>
                <svg className={styles.heartIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span className={styles.dividerLine}></span>
              </div>
              
              <div className={styles.metaRow}>
                {/* HN Section */}
                <div className={styles.metaBox}>
                  <div className={styles.metaIconBlue}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
                      <line x1="7" y1="8" x2="17" y2="8"></line>
                      <line x1="7" y1="12" x2="17" y2="12"></line>
                      <line x1="7" y1="16" x2="13" y2="16"></line>
                    </svg>
                  </div>
                  <div className={styles.metaText}>
                    <span className={styles.metaLabel}>เลข HN ประจำตัว</span>
                    <strong className={styles.metaVal}>{patient?.hn}</strong>
                  </div>
                </div>
                
                <div className={styles.verticalSeparator}></div>
                
                {/* Treatment Section */}
                <div className={styles.metaBox}>
                  <div className={styles.metaIconGreen}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      <line x1="12" y1="8" x2="12" y2="16"></line>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                  </div>
                  <div className={styles.metaText}>
                    <span className={styles.metaLabel}>การรักษา</span>
                    <strong className={styles.metaVal}>ล้างไตช่องท้อง (CAPD)</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className={styles.profileActionRow}>
            <button onClick={startNewSession} className={styles.startSessionBtn}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px' }}>
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              เริ่มบันทึกรอบล้างไตใหม่
            </button>
          </div>
        </section>

        {/* Chart & History Split */}
        <div className={styles.dashboardSplit}>
          
          {/* Trend Chart Panel */}
          <section className={styles.chartPanelSection}>
            <div className="sectionHeader">
              <h2 className={styles.panelTitle}>แนวโน้มปริมาณน้ำเสียส่วนเกินที่ดึงออกได้ (Net UF Trend)</h2>
            </div>
            
            <div className={`${styles.chartCard} card`}>
              {chartSessions.length < 2 ? (
                <div className={styles.chartEmpty}>
                  <p>ต้องการข้อมูลบันทึกสำเร็จอย่างน้อย 2 รอบขึ้นไปเพื่อพล็อตกราฟแนวโน้ม</p>
                </div>
              ) : (
                <div className={styles.chartWrapper}>
                  <svg className={styles.svgChart} viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
                    {/* Zero baseline */}
                    <line
                      x1={padding}
                      y1={padding + chartHeight / 2}
                      x2={width - padding}
                      y2={padding + chartHeight / 2}
                      stroke="var(--surface-border)"
                      strokeWidth="1.5"
                      strokeDasharray="4"
                    />
                    
                    {/* Main Line path */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* Node points */}
                    {points.map((p, idx) => (
                      <g key={idx}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="6"
                          fill="var(--surface)"
                          stroke={p.val >= 0 ? 'var(--success)' : 'var(--danger)'}
                          strokeWidth="3.5"
                        />
                        {/* Tooltip value */}
                        <text
                          x={p.x}
                          y={p.y - 12}
                          fontSize="11"
                          fontWeight="700"
                          textAnchor="middle"
                          fill={p.val >= 0 ? 'var(--success)' : 'var(--danger)'}
                          fontFamily="var(--font-outfit)"
                        >
                          {p.val > 0 ? `+${p.val}` : p.val}
                        </text>
                        {/* X-axis date labels */}
                        <text
                          x={p.x}
                          y={height - 8}
                          fontSize="10"
                          textAnchor="middle"
                          fill="var(--text-secondary)"
                        >
                          {p.date}
                        </text>
                      </g>
                    ))}
                  </svg>
                  <div className={styles.chartLegends}>
                    <span className={styles.legendPos}>+ ดึงน้ำส่วนเกินสำเร็จ</span>
                    <span className={styles.legendNeg}>- น้ำคั่งสะสมในช่องท้อง</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Dialysis Log History */}
          <section className={styles.historySection}>
            <h2 className={styles.panelTitle}>ประวัติล้างไตย้อนหลัง ({sessions.length} รายการ)</h2>

            {/* Statistics KPI Grid */}
            <div className={styles.statsGrid}>
              <div className={styles.statsCard}>
                <div className={styles.statsIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                </div>
                <div className={styles.statsData}>
                  <span className={styles.statsLabel}>รอบบันทึกทั้งหมด</span>
                  <strong className={styles.statsValue}>{sessions.length} รอบ</strong>
                </div>
              </div>
              
              <div className={styles.statsCard}>
                <div className={styles.statsIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z" />
                  </svg>
                </div>
                <div className={styles.statsData}>
                  <span className={styles.statsLabel}>ค่าเฉลี่ย Net UF</span>
                  <strong className={`${styles.statsValue} ${avgNetUf >= 0 ? styles.textSuccess : styles.textDanger}`}>
                    {avgNetUf >= 0 ? `+${avgNetUf}` : avgNetUf} mL
                  </strong>
                </div>
              </div>

              <div className={styles.statsCard}>
                <div className={styles.statsIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div className={styles.statsData}>
                  <span className={styles.statsLabel}>น้ำยาออกใสปกติ</span>
                  <strong className={styles.statsValue}>
                    {sessions.length > 0 ? `${Math.round((normalDrainCount / sessions.length) * 100)}%` : '0%'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className={styles.filterSection}>
              <div className={styles.filterRow}>
                <div className={styles.searchBox}>
                  <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

                <div className={styles.bulkActions}>
                  <button onClick={expandAll} className={`${styles.actionLinkBtn} btn btn-secondary`}>
                    ขยายทั้งหมด
                  </button>
                  <button onClick={collapseAll} className={`${styles.actionLinkBtn} btn btn-secondary`}>
                    ยุบทั้งหมด
                  </button>
                </div>
              </div>

              <div className={styles.filterGrid}>
                <div className={styles.filterField}>
                  <label>ช่วงเวลา</label>
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
                      <label>ตั้งแต่วันที่</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={handleStartDateChange}
                        className={styles.filterInput}
                      />
                    </div>
                    <div className={styles.filterField}>
                      <label>ถึงวันที่</label>
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
                  <label>สีน้ำยาปล่อยออก</label>
                  <select value={drainColorFilter} onChange={handleColorFilterChange} className={styles.filterSelect}>
                    <option value="all">ทั้งหมด</option>
                    <option value="Clear">ใส</option>
                    <option value="Cloudy">ขุ่นมีตะกอน</option>
                    <option value="Bloody">มีเลือดปน</option>
                    <option value="Fibrin">มีใยโปรตีน</option>
                  </select>
                </div>

                <div className={styles.filterField}>
                  <label>แสดงรายการ</label>
                  <select value={pageSize} onChange={handlePageSizeChange} className={styles.filterSelect}>
                    <option value={5}>5 รายการต่อหน้า</option>
                    <option value={10}>10 รายการต่อหน้า</option>
                    <option value={20}>20 รายการต่อหน้า</option>
                    <option value={50}>50 รายการต่อหน้า</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Accordion History List */}
            <div className={styles.historyList}>
              {filteredSessions.length === 0 ? (
                <div className={`${styles.emptyHistory} card`}>
                  <p>ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหาของคุณ</p>
                </div>
              ) : (
                paginatedSessions.map((session) => (
                  <div key={session.id} className={`${styles.accordionCard} card`}>
                    <div
                      className={`${styles.accordionHeader} ${expandedSessionIds[session.id] ? styles.accordionHeaderActive : ''}`}
                      onClick={() => toggleExpand(session.id)}
                    >
                      <div className={styles.accordionHeaderLeft}>
                        <div className={styles.accordionTitleContainer}>
                          <span className={styles.accordionCycleTitle}>รอบที่ {session.cycleNumber}</span>
                          <span className={styles.accordionDateText}>
                            {new Date(session.createdAt).toLocaleDateString('th-TH', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className={styles.accordionQuickInfo}>
                          <span>ออก: {session.drainVolume} mL</span>
                          <span className={styles.accordionQuickDivider}>|</span>
                          <span>เข้า: {session.fillVolume} mL ({session.dextrosePct}%)</span>
                        </div>
                      </div>
                      <div className={styles.accordionHeaderRight}>
                        <div className={`${styles.netUfTag} ${(session.netUf || 0) >= 0 ? styles.ufPos : styles.ufNeg}`}>
                          Net UF: {(session.netUf || 0) >= 0 ? '+' : ''}{session.netUf} mL
                        </div>
                        <span className={`${styles.accordionArrow} ${expandedSessionIds[session.id] ? styles.accordionArrowRotate : ''}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </span>
                      </div>
                    </div>

                    {expandedSessionIds[session.id] && (
                      <div className={styles.accordionBody}>
                        <div className={styles.bodyGrid}>
                          <div>
                            <span>น้ำยาปล่อยออก (Drain):</span>
                            <strong>
                              {session.drainVolume} mL ({session.drainColor === 'Clear' ? 'ใส' :
                                                        session.drainColor === 'Cloudy' ? 'ขุ่นมีตะกอน' :
                                                        session.drainColor === 'Bloody' ? 'มีเลือดปน' : 'มีใยโปรตีน'})
                            </strong>
                            {session.drainStartTime && session.drainEndTime && (
                              <span className={styles.timeMeta}>
                                เวลา: {formatTimeOnly(session.drainStartTime)} - {formatTimeOnly(session.drainEndTime)} ({calculateDurationMinutes(session.drainStartTime, session.drainEndTime)} นาที)
                              </span>
                            )}
                          </div>
                          <div>
                            <span>ล้างสาย (Flush):</span>
                            <strong>ทำขั้นตอนล้างสายสำเร็จ</strong>
                            {session.flushTime && (
                              <span className={styles.timeMeta}>
                                เวลา: {formatTimeSeconds(session.flushTime)}
                              </span>
                            )}
                          </div>
                          <div>
                            <span>น้ำยาเติมเข้า (Fill):</span>
                            <strong>{session.fillVolume} mL ({session.dextrosePct}%)</strong>
                            {session.fillStartTime && session.fillEndTime && (
                              <span className={styles.timeMeta}>
                                เวลา: {formatTimeOnly(session.fillStartTime)} - {formatTimeOnly(session.fillEndTime)} ({calculateDurationMinutes(session.fillStartTime, session.fillEndTime)} นาที)
                              </span>
                            )}
                          </div>
                          <div>
                            <span>การเปลี่ยนแปลงน้ำหนัก:</span>
                            <strong>{session.preWeight || '-'} ➔ {session.postWeight || '-'} kg</strong>
                          </div>
                          <div>
                            <span>สัญญาณชีพก่อนเริ่ม (Pre-Check):</span>
                            <strong>
                              BP: {session.preBpSys || '-'}/{session.preBpDia || '-'} mmHg | P: {session.prePulse || '-'} bpm | T: {session.preTemp || '-'} °C
                            </strong>
                          </div>
                          <div>
                            <span>สัญญาณชีพหลังเสร็จ (Post-Check):</span>
                            <strong>
                              BP: {session.postBpSys || '-'}/{session.postBpDia || '-'} mmHg | P: {session.postPulse || '-'} bpm | T: {session.postTemp || '-'} °C
                            </strong>
                          </div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <span>ผู้บันทึก:</span>
                            <strong>{session.nurseName}</strong>
                          </div>
                        </div>
                        
                        {session.symptoms && (
                          <div className={styles.symptomNote}>
                            <span>บันทึกอาการ:</span>
                            <p>{session.symptoms}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
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

        </div>
      </main>
    </div>
  );
}
