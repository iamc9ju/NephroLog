/* src/components/Navbar.tsx */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Navbar.module.css';

interface NavbarProps {
  role: 'patient' | 'nurse';
  pageType: 'dashboard' | 'tracker' | 'patientDetail';
  patientHn?: string;
  nurseName?: string;
  onCancelSession?: () => void;
  onLogout?: () => void;
}

export default function Navbar({
  role,
  pageType,
  patientHn,
  nurseName,
  onCancelSession,
  onLogout,
}: NavbarProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleDefaultLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  // 1. Details page for Nurse (back button layout)
  if (pageType === 'patientDetail') {
    return (
      <header className={`${styles.header} ${styles.headerPatient} patientHeader glass`}>
        <button
          onClick={() => router.push('/dashboard')}
          className={styles.backBtn}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          กลับไปแดชบอร์ด
        </button>
      </header>
    );
  }

  // 2. Dashboards (Patient, Nurse) and Tracker page
  return (
    <header
      className={`${styles.header} ${styles.headerPatient} ${
        isMenuOpen ? styles.headerMenuOpen : ''
      } patientHeader glass`}
      ref={menuRef}
    >
      <div className={styles.headerLeft}>
        <img
          src="/logo-waterdrop.png"
          alt="NephroLog Logo"
          className={styles.logoImg}
        />
        <span className={`${styles.logoTitle} ${styles.logoTitlePatient}`}>
          NephroLog
        </span>
      </div>
      <div className={styles.menuWrapper}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={
            isMenuOpen ? styles.menuToggleBtnActive : styles.menuToggleBtn
          }
          title="เมนูการใช้งาน"
        >
          {isMenuOpen ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1875FF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <div className={styles.threeLinesMenu}>
              <span className={styles.menuLine}></span>
              <span className={styles.menuLine}></span>
              <span className={styles.menuLine}></span>
            </div>
          )}
        </button>
      </div>

      {isMenuOpen && (
        <div className={styles.dropdownMenuExpanded}>
          <button
            onClick={() => {
              router.push(role === 'nurse' ? '/dashboard' : '/');
              setIsMenuOpen(false);
            }}
            className={styles.expandedDropdownItem}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={styles.expandedItemIcon}
            >
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            <span className={styles.expandedItemText}>หน้าแรก</span>
          </button>

          <button
            onClick={() => {
              alert('ฟังก์ชันแนะนำการใช้งานกำลังอยู่ระหว่างการพัฒนา');
              setIsMenuOpen(false);
            }}
            className={styles.expandedDropdownItem}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.expandedItemIcon}
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span className={styles.expandedItemText}>คู่มือการใช้งาน</span>
          </button>

          {role === 'patient' && pageType === 'tracker' && onCancelSession && (
            <button
              onClick={() => {
                onCancelSession();
                setIsMenuOpen(false);
              }}
              className={styles.expandedDropdownItem}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.expandedItemIcon}
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              <span className={styles.logoutBtnIcon}>ยกเลิกรอบฟอกไต</span>
            </button>
          )}

          <div className={styles.expandedDivider}></div>

          {role !== 'nurse' && (
            <button
              onClick={() => {
                router.push('/patient/dashboard');
                setIsMenuOpen(false);
              }}
              className={styles.expandedDashboardBtn}
            >
              <span className={styles.lockIcon}>🔓</span>
              <span>
                {`${patientHn || 'chxcmj3'} — แดชบอร์ด`}
              </span>
            </button>
          )}

          <button
            onClick={handleDefaultLogout}
            className={styles.expandedLogoutBtn}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.logoutBtnIcon}
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      )}
    </header>
  );
}
