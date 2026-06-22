'use client';

import React from 'react';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmDialog({
  isOpen,
  title = 'ข้อความจาก localhost:3000',
  message,
  onConfirm,
  onCancel,
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={`${styles.dialog} fade-in`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button onClick={onConfirm} className={styles.confirmBtn}>
            {confirmText}
          </button>
          <button onClick={onCancel} className={styles.cancelBtn}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
