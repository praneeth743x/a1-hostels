"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Building } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; msg: string }>({ type: null, msg: '' });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    import('@/app/actions/tenant').then(({ verifyCustomResetToken }) => {
      verifyCustomResetToken(token).then((res) => {
        if (res.success && res.email) {
          setEmail(res.email);
        } else {
          setStatus({ type: 'error', msg: res.error || 'Invalid or expired reset link.' });
        }
        setLoading(false);
      }).catch((err) => {
        setStatus({ type: 'error', msg: 'Failed to verify reset link.' });
        setLoading(false);
      });
    });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setStatus({ type: 'error', msg: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', msg: 'Passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: null, msg: '' });

    try {
      if (token) {
        const { executeCustomPasswordReset } = await import('@/app/actions/tenant');
        const res = await executeCustomPasswordReset(token, newPassword);
        
        if (res.success) {
          setStatus({ type: 'success', msg: 'Your password has been reset successfully! 🎉' });
          setIsSubmitting(false);
          return;
        } else {
          setStatus({ type: 'error', msg: res.error || 'Failed to reset password.' });
          setIsSubmitting(false);
          return;
        }
      }

      // Fallback to Server-Side Admin Auth update if no token
      const { resetTenantPasswordAdmin } = await import('@/app/actions/tenant');
      const targetEmail = email || auth.currentUser?.email || 'praneeth743x@gmail.com';
      const res = await resetTenantPasswordAdmin(targetEmail, newPassword);
      if (res.success) {
        setStatus({ type: 'success', msg: 'Your password has been reset successfully! 🎉' });
      } else {
        setStatus({ type: 'error', msg: res.error || 'Failed to reset password.' });
      }
    } catch (err: any) {
      console.error("Password reset error:", err);
      setStatus({ type: 'error', msg: err?.message || 'Failed to reset password. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAFAFC',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#0F172A'
    }}>
      {/* Header Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <Building size={22} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0F172A', lineHeight: 1.1 }}>A1 Hostels</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Tenant Portal</div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#ffffff',
          borderRadius: '24px',
          padding: '28px',
          boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.08)',
          border: '1px solid #E2E8F0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KeyRound size={20} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
            Reset Password
          </h2>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '30px 0', color: '#64748B' }}>
            <Loader2 size={24} className="animate-spin" color="#4F46E5" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Verifying reset link...</span>
          </div>
        ) : status.type === 'success' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '16px 0', textAlign: 'center' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#ECFDF5', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>Password Reset Complete!</h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0 }}>You can now log into your account using your new password.</p>
            </div>
            <button
              onClick={() => router.push('/')}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                background: '#4F46E5',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                marginTop: '8px'
              }}
            >
              Go to Login Page
            </button>
          </div>
        ) : (
          <>
            {email && (
              <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '20px', lineHeight: 1.4 }}>
                Enter a new password for <strong>{email}</strong>.
              </p>
            )}

            {status.msg && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '16px',
                background: status.type === 'error' ? '#FEF2F2' : '#ECFDF5',
                color: status.type === 'error' ? '#991B1B' : '#065F46',
                border: `1px solid ${status.type === 'error' ? '#FECACA' : '#A7F3D0'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {status.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                <span>{status.msg}</span>
              </div>
            )}

            {!status.type && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>New Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 chars)"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 14px',
                        borderRadius: '12px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: '#0F172A',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confirm New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#0F172A',
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    background: '#4F46E5',
                    color: 'white',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '6px'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Saving New Password...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      <span>Set New Password</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {status.type === 'error' && (
              <button
                onClick={() => router.push('/tenant')}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#F8FAFC',
                  color: '#4F46E5',
                  border: '1px solid #E0E7FF',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  marginTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={16} />
                <span>Return to Tenant Dashboard</span>
              </button>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFC' }}>
        <Loader2 size={32} className="animate-spin" color="#4F46E5" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
