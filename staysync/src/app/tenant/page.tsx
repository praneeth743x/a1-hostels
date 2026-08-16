"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getTenantDashboardData } from '@/app/actions/tenant';
import { createRazorpayOrder, verifyRazorpaySignature } from '@/app/actions/razorpay';
import MobileTenantDashboard from './MobileTenantDashboard';
import DesktopTenantDashboard from './DesktopTenantDashboard';

export default function TenantProfileDashboardRouter() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paidDueIds, setPaidDueIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        setLoading(false);
        return;
      }

      const res = await getTenantDashboardData(user.email);
      if (!res.success) {
        if (res.error === 'ACCOUNT_DISABLED' || res.message?.includes('disabled') || res.message?.includes('suspended')) {
          localStorage.clear();
          sessionStorage.clear();
          const { signOut } = await import('firebase/auth');
          await signOut(auth).catch(() => {});
          window.location.href = '/?error=account_disabled';
          return;
        }
      } else {
        setDashboardData(res.data);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handlePayment = async (due: any) => {
    setIsProcessing(true);
    setErrorMsg('');
    
    try {
      const amountPaise = due.amount * 100;
      const res = await createRazorpayOrder(amountPaise, due.id);
      if (!res.success) throw new Error(res.error || 'Failed to create order');

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: res.amount,
        currency: res.currency,
        name: "StaySync",
        description: `${due.month} ${due.type === 'opening-fee' ? 'Opening Balance' : 'Rent Payment'}`,
        order_id: res.order_id,
        handler: async function (response: any) {
          try {
            const verifyRes = await verifyRazorpaySignature(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (verifyRes.success) {
              setPaidDueIds(prev => new Set(prev).add(due.id));
            } else {
              setErrorMsg('Payment verification failed.');
            }
          } catch (err: any) {
            setErrorMsg(err.message || 'Verification error');
          }
        },
        prefill: {
          name: dashboardData?.tenant?.full_name || "Tenant",
          email: auth.currentUser?.email || "",
          contact: dashboardData?.tenant?.mobile || ""
        },
        theme: {
          color: "#4F46E5"
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response: any) {
        setErrorMsg(`Payment failed: ${response.error.description}`);
      });
      
      rzp1.open();
      
    } catch (err: any) {
      setErrorMsg(err.message || 'Checkout failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const commonProps = {
    tenant: dashboardData?.tenant || {},
    payments: dashboardData?.payments || [],
    pendingDues: dashboardData?.pendingDues || [],
    notices: dashboardData?.notices || [],
    tenantPaymentsEnabled: dashboardData?.tenantPaymentsEnabled ?? true,
    activityLogs: dashboardData?.activityLogs || [],
    paidDueIds,
    loading,
    handlePayment,
    isProcessing,
    errorMsg
  };

  if (isDesktop) {
    return (
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loader2 size={32} className="animate-spin" color="#4F46E5" /></div>}>
        <DesktopTenantDashboard {...commonProps} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loader2 size={32} className="animate-spin" color="#4F46E5" /></div>}>
      <MobileTenantDashboard />
    </Suspense>
  );
}

