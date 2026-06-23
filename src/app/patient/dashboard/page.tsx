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

  // Chart dimensions matching mockup exactly
  const width = 600;
  const height = 300;
  const paddingLeft = 55;
  const paddingRight = 30;
  const paddingTop = 40;
  const paddingBottom = 45;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const rawVals = chartSessions.map(s => s.netUf || 0);
  const minRaw = Math.min(...rawVals, -600);
  const maxRaw = Math.max(...rawVals, 200);

  // Round min/max bounds to nice 200 multiples (default to range [-1000, 0] if min/max is within it)
  const minVal = Math.min(Math.floor(minRaw / 200) * 200, -1000);
  const maxVal = Math.max(Math.ceil(maxRaw / 200) * 200, 0);
  const range = maxVal - minVal || 1000;
  
  const ticks = [];
  const tickStep = range / 5;
  for (let i = 0; i <= 5; i++) {
    ticks.push(minVal + i * tickStep);
  }

  // Compute points
  const points = chartSessions.map((s, idx) => {
    const x = paddingLeft + (idx / (chartSessions.length - 1 || 1)) * chartWidth;
    const y = paddingTop + chartHeight - (((s.netUf || 0) - minVal) / range) * chartHeight;
    return { 
      x, 
      y, 
      val: s.netUf || 0, 
      date: new Date(s.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) 
    };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const gradientPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

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
      <header className={`${styles.header} patientHeader glass`}>
        <div className={styles.headerLeft}>
          <div className={styles.logoCircleWrapper}>
            <div className={styles.logoCircle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1875FF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
            <div className={styles.sparkle1}>✦</div>
            <div className={styles.sparkle2}>✦</div>
          </div>
          <div className={styles.logoTexts}>
            <span className={styles.logoTitle}>NephroLog</span>
            <span className={styles.logoSubtitle}>สำหรับคนไข้</span>
          </div>
        </div>
        <div className={styles.dotsGrid}></div>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          ออกจากระบบ
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
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
                <div className={styles.imageClip}>
                  <img src={avatarSrc} alt="คนไข้" className={styles.avatarImg} />
                </div>
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
            <div className={`${styles.chartCard} card`}>
              <div className={styles.chartHeader}>
                <div className={styles.chartHeaderIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.dropIcon}>
                    <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z" />
                  </svg>
                  <div className={styles.plusBadge}>+</div>
                </div>
                <div className={styles.chartHeaderTexts}>
                  <h3 className={styles.chartHeaderTitle}>ค่าเฉลี่ย Net UF วันนี้</h3>
                  <span className={styles.chartHeaderSubtitle}>ติดตามปริมาณน้ำส่วนเกินจากการฟอกไต</span>
                </div>
              </div>

              {chartSessions.length < 2 ? (
                <div className={styles.chartEmpty}>
                  <p>ต้องการข้อมูลบันทึกสำเร็จอย่างน้อย 2 รอบขึ้นไปเพื่อพล็อตกราฟแนวโน้ม</p>
                </div>
              ) : (
                <div className={styles.chartWrapper}>
                  <svg className={styles.svgChart} viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
                    <defs>
                      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.06" />
                      </filter>
                      <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Y-axis mL label */}
                    <text
                      x={paddingLeft - 12}
                      y={paddingTop - 15}
                      fontSize="12"
                      fontWeight="500"
                      textAnchor="end"
                      fill="#94a3b8"
                      fontFamily="var(--font-anuphan)"
                    >
                      mL
                    </text>

                    {/* Horizontal tick lines & labels */}
                    {ticks.map((tick) => {
                      const y = paddingTop + chartHeight - ((tick - minVal) / range) * chartHeight;
                      return (
                        <g key={tick}>
                          <line
                            x1={paddingLeft}
                            y1={y}
                            x2={width - paddingRight}
                            y2={y}
                            stroke={tick === 0 ? "#e2e8f0" : "rgba(228, 228, 231, 0.5)"}
                            strokeWidth={tick === 0 ? "1.5" : "1.2"}
                            strokeDasharray={tick === 0 ? "0" : "4 4"}
                          />
                          <text
                            x={paddingLeft - 12}
                            y={y + 4}
                            fontSize="12"
                            fontWeight="500"
                            textAnchor="end"
                            fill="#94a3b8"
                            fontFamily="var(--font-anuphan)"
                          >
                            {tick}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bottom X-axis baseline */}
                    <line
                      x1={paddingLeft}
                      y1={paddingTop + chartHeight}
                      x2={width - paddingRight}
                      y2={paddingTop + chartHeight}
                      stroke="#e2e8f0"
                      strokeWidth="1.5"
                    />
                    <circle cx={paddingLeft} cy={paddingTop + chartHeight} r="3" fill="#cbd5e1" />
                    <circle cx={width - paddingRight} cy={paddingTop + chartHeight} r="3" fill="#cbd5e1" />

                    {/* Date labels at bottom */}
                    {points.map((p, idx) => (
                      <text
                        key={idx}
                        x={p.x}
                        y={paddingTop + chartHeight + 22}
                        fontSize="12"
                        fontWeight="500"
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontFamily="var(--font-anuphan)"
                      >
                        {p.date}
                      </text>
                    ))}

                    {/* Gradient Fill under line */}
                    {points.length > 1 && (
                      <path
                        d={gradientPath}
                        fill="url(#chart-gradient)"
                      />
                    )}

                    {/* Main Blue Line path */}
                    {points.length > 1 && (
                      <path
                        d={linePath}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Node points (white circles with green/red stroke) */}
                    {points.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r="6"
                        fill="white"
                        stroke={p.val >= 0 ? '#10b981' : '#ef4444'}
                        strokeWidth="3.5"
                      />
                    ))}

                    {/* Tooltip balloons */}
                    {points.map((p, idx) => {
                      const x0 = p.x;
                      const y0 = p.y - 15 - 12; // Position above the node
                      const left = x0 - 36;
                      const right = x0 + 36;
                      const top = y0 - 13;
                      const bottom = y0 + 13;
                      const balloonPath = `M ${left + 6} ${top} L ${right - 6} ${top} A 6 6 0 0 1 ${right} ${top + 6} L ${right} ${bottom - 6} A 6 6 0 0 1 ${right - 6} ${bottom} L ${x0 + 5} ${bottom} L ${x0} ${bottom + 6} L ${x0 - 5} ${bottom} L ${left + 6} ${bottom} A 6 6 0 0 1 ${left} ${bottom - 6} L ${left} ${top + 6} A 6 6 0 0 1 ${left + 6} ${top} Z`;

                      return (
                        <g key={idx}>
                          <path
                            d={balloonPath}
                            fill="white"
                            stroke={p.val >= 0 ? '#bbf7d0' : '#fecaca'}
                            strokeWidth="1.5"
                            filter="url(#shadow)"
                          />
                          <text
                            x={x0}
                            y={y0 + 4}
                            fontSize="12"
                            textAnchor="middle"
                            fontFamily="var(--font-anuphan)"
                          >
                            <tspan fill={p.val >= 0 ? '#10b981' : '#ef4444'} fontWeight="bold">
                              {p.val >= 0 ? `+${p.val}` : p.val}
                            </tspan>
                            <tspan fill="#64748b" fontSize="10" fontWeight="500" dx="3">
                              mL
                            </tspan>
                          </text>
                        </g>
                      );
                    })}
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
              {/* Card 1: รอบบันทึกทั้งหมด */}
              <div className={`${styles.statsCard} ${styles.statsCardBlue}`}>
                <div className={styles.statsIconBlueCircle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                </div>
                <div className={styles.statsData}>
                  <span className={styles.statsLabel}>รอบบันทึกทั้งหมด</span>
                  <strong className={styles.statsValue}>
                    {sessions.length} <span className={styles.statsUnit}>รอบ</span>
                  </strong>
                </div>
                {/* Clipboard 3D Illust SVG */}
                <svg width="72" height="72" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.statsCardBgIllust}>
                  <defs>
                    <linearGradient id="clipboard-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                    <linearGradient id="shadow-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M10 50 C 20 20, 80 15, 90 40 C 95 60, 75 90, 45 85 C 20 80, 5 70, 10 50 Z" fill="#eff6ff" opacity="0.6"/>
                  <rect x="26" y="24" width="48" height="58" rx="8" fill="url(#shadow-grad)" transform="translate(4, 4)"/>
                  <rect x="26" y="24" width="48" height="58" rx="8" fill="#ffffff" stroke="#dbeafe" strokeWidth="2"/>
                  <rect x="40" y="16" width="20" height="12" rx="4" fill="url(#clipboard-grad)" />
                  <circle cx="50" cy="22" r="3" fill="#ffffff"/>
                  <g transform="translate(34, 38)">
                    <path d="M 0 4 L 4 8 L 12 0" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="18" y1="5" x2="36" y2="5" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
                    <g transform="translate(0, 14)">
                      <path d="M 0 4 L 4 8 L 12 0" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="18" y1="5" x2="36" y2="5" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
                    </g>
                    <g transform="translate(0, 28)">
                      <path d="M 0 4 L 4 8 L 12 0" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="18" y1="5" x2="30" y2="5" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
                    </g>
                  </g>
                  <path d="M 15 20 L 17 25 L 22 27 L 17 29 L 15 34 L 13 29 L 8 27 L 13 25 Z" fill="#93c5fd" opacity="0.8"/>
                  <circle cx="82" cy="30" r="3" fill="#60a5fa" opacity="0.6"/>
                  <circle cx="20" cy="75" r="4" fill="#93c5fd" opacity="0.5"/>
                </svg>
              </div>
              
              {/* Card 2: ค่าเฉลี่ย Net UF */}
              <div className={`${styles.statsCard} ${styles.statsCardRed}`}>
                <div className={styles.statsIconRedCircle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z" />
                  </svg>
                </div>
                <div className={styles.statsData}>
                  <span className={styles.statsLabel}>ค่าเฉลี่ย Net UF</span>
                  <strong className={`${styles.statsValue} ${avgNetUf >= 0 ? styles.textSuccess : styles.textDanger}`}>
                    {avgNetUf >= 0 ? `+${avgNetUf}` : avgNetUf} <span className={styles.statsUnit}>mL</span>
                  </strong>
                </div>
                {/* Dialysate Bag 3D Illust SVG */}
                <svg width="72" height="72" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.statsCardBgIllust}>
                  <defs>
                    <linearGradient id="fluid-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fca5a5" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                    <linearGradient id="bag-outline-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#fee2e2" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>
                  <path d="M12 45 C 22 15, 78 20, 88 45 C 92 65, 80 88, 50 82 C 25 78, 8 68, 12 45 Z" fill="#fef2f2" opacity="0.6"/>
                  <rect x="28" y="20" width="44" height="54" rx="10" fill="#cbd5e1" opacity="0.15" transform="translate(3, 3)"/>
                  <path d="M 42 20 L 58 20 L 54 13 L 46 13 Z" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.5"/>
                  <circle cx="50" cy="16" r="3" fill="#ffffff" stroke="#fca5a5" strokeWidth="1.5"/>
                  <rect x="28" y="20" width="44" height="54" rx="10" fill="url(#bag-outline-grad)" stroke="#fca5a5" strokeWidth="2" strokeOpacity="0.8"/>
                  <rect x="32" y="38" width="36" height="32" rx="6" fill="url(#fluid-grad)" />
                  <g stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.6" transform="translate(36, 42)">
                    <line x1="0" y1="0" x2="6" y2="0" />
                    <line x1="0" y1="6" x2="4" y2="6" />
                    <line x1="0" y1="12" x2="6" y2="12" />
                    <line x1="0" y1="18" x2="4" y2="18" />
                    <line x1="0" y1="24" x2="6" y2="24" />
                  </g>
                  <path d="M 50 74 L 50 82 A 8 8 0 0 0 58 90 M 46 80 L 46 84" stroke="#fca5a5" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="46" cy="85" r="2" fill="#ef4444"/>
                  <path d="M 82 25 L 84 30 L 89 32 L 84 34 L 82 39 L 80 34 L 75 32 L 80 30 Z" fill="#fca5a5" opacity="0.8"/>
                  <circle cx="18" cy="32" r="3" fill="#ef4444" opacity="0.5"/>
                </svg>
              </div>
              
              {/* Card 3: น้ำยาออกใสปกติ */}
              <div className={`${styles.statsCard} ${styles.statsCardGreen}`}>
                <div className={styles.statsIconGreenCircle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div className={styles.statsData}>
                  <span className={styles.statsLabel}>น้ำยาออกใสปกติ</span>
                  <strong className={styles.statsValue} style={{ color: '#16a34a' }}>
                    {sessions.length > 0 ? `${Math.round((normalDrainCount / sessions.length) * 100)}%` : '0%'}
                  </strong>
                </div>
                {/* Shield 3D Illust SVG */}
                <svg width="72" height="72" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.statsCardBgIllust}>
                  <defs>
                    <linearGradient id="shield-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                    <filter id="shield-glow" x="-10%" y="-10%" width="120%" height="120%">
                      <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.2" />
                    </filter>
                  </defs>
                  <path d="M15 48 C 22 20, 75 12, 85 38 C 90 58, 80 85, 52 88 C 28 90, 10 72, 15 48 Z" fill="#eff6ff" opacity="0.6"/>
                  <path d="M 30 22 C 42 22, 50 16, 50 16 C 50 16, 58 22, 70 22 C 70 42, 66 64, 50 78 C 34 64, 30 42, 30 22 Z" fill="url(#shield-grad)" stroke="#93c5fd" strokeWidth="2.5" filter="url(#shield-glow)"/>
                  <path d="M 34 26 C 44 26, 50 21, 50 21 C 50 21, 56 26, 66 26 C 66 42, 62 60, 50 72 C 38 60, 34 42, 34 26 Z" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.4"/>
                  <path d="M 42 46 L 47 51 L 58 39" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="82" cy="72" r="5" fill="#3b82f6" opacity="0.4"/>
                  <circle cx="20" cy="25" r="3" fill="#60a5fa" opacity="0.5"/>
                  <circle cx="85" cy="22" r="3" fill="#93c5fd" opacity="0.7"/>
                </svg>
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
