"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, Receipt, Check, ArrowRight } from 'lucide-react';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    amount: number;
    tenantName: string;
    roomNumber?: string;
    paymentMethod: string;
    feeType?: string;
    date?: string;
    notes?: string;
    discountAmount?: number;
  } | null;
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  if (!isOpen || !data) return null;

  const formattedDate = data.date || new Date().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '380px',
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            padding: '28px 24px 24px 24px',
            textAlign: 'center',
            position: 'relative'
          }}
        >
          {/* Close Icon */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={18} />
          </button>

          {/* Animated Success Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', damping: 15, stiffness: 200 }}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#ffffff'
            }}
          >
            <Check size={40} strokeWidth={3} />
          </motion.div>

          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
            Payment Collected!
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#64748b' }}>
            Transaction recorded successfully
          </p>

          {/* Amount Badge */}
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            border: '1px solid #a7f3d0',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Amount Received
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#065f46' }}>
                ₹{data.amount.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '14px 16px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Tenant</span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>{data.tenantName}</span>
            </div>
            {data.roomNumber && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Room</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>Room {data.roomNumber}</span>
              </div>
            )}
            {data.feeType && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: '#f0fdf4', padding: '6px 8px', borderRadius: '8px', margin: '2px -4px' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Fee Collected</span>
                <span style={{ color: '#15803d', fontWeight: 700, maxWidth: '200px', textAlign: 'right' }}>{data.feeType}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Method</span>
              <span style={{ color: '#10b981', fontWeight: 700 }}>{data.paymentMethod}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Date & Time</span>
              <span style={{ color: '#475569', fontWeight: 600 }}>{formattedDate}</span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.3)'
            }}
          >
            <span>Done</span>
            <ArrowRight size={18} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
