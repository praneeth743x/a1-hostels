"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, ChevronRight } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface TenantDispatchResult {
  tenantName: string;
  tenantPhone?: string;
  success: boolean;
  error?: string;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  results?: TenantDispatchResult[];
}

interface BulletNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  onClickToast?: (toast: ToastMessage) => void;
}

export const BulletNotification: React.FC<BulletNotificationProps> = ({ toasts, onDismiss, onClickToast }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        pointerEvents: 'none',
        width: '90%',
        maxWidth: '480px'
      }}
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';
          const hasResults = Boolean(toast.results && toast.results.length > 0);

          const bgColor = isSuccess
            ? 'linear-gradient(135deg, #064e3b, #047857)'
            : isError
            ? 'linear-gradient(135deg, #881337, #be123c)'
            : isWarning
            ? 'linear-gradient(135deg, #1e293b, #334155)'
            : 'linear-gradient(135deg, #0f172a, #1e293b)';

          const border = isSuccess
            ? '1px solid #10b981'
            : isError
            ? '1px solid #f43f5e'
            : isWarning
            ? '1px solid #38bdf8'
            : '1px solid #38bdf8';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -25, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={() => {
                if (hasResults && onClickToast) {
                  onClickToast(toast);
                }
              }}
              style={{
                pointerEvents: 'auto',
                background: bgColor,
                border,
                borderRadius: '9999px',
                padding: '10px 16px 10px 14px',
                color: '#ffffff',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                cursor: hasResults ? 'pointer' : 'default',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)'
              }}
            >
              {/* Bullet Icon Badge */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {isSuccess && <CheckCircle2 size={20} color="#ffffff" />}
                {isError && <XCircle size={20} color="#ffffff" />}
                {isWarning && <Info size={20} color="#38bdf8" />}
                {!isSuccess && !isError && !isWarning && <Info size={20} color="#ffffff" />}
              </div>

              {/* Toast Text Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.2px' }}>
                  {toast.title}
                </div>
                {toast.description && (
                  <div style={{ fontSize: '0.76rem', opacity: 0.9, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {toast.description}
                  </div>
                )}
              </div>

              {/* Tap for details indicator */}
              {hasResults && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '12px' }}>
                  <span>Report</span>
                  <ChevronRight size={14} />
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(toast.id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'color 0.2s ease'
                }}
              >
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
