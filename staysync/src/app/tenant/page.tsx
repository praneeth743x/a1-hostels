"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, IndianRupee } from 'lucide-react';
import { AnimatedButton } from '@/components/AnimatedButton';
import Script from 'next/script';
import { createRazorpayOrder, verifyRazorpaySignature, sendWhatsAppReceipt } from '@/app/actions/razorpay';
import styles from './tenant.module.css';

// Type declaration for window.Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function TenantPaymentHub() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paid, setPaid] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  const handlePayment = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    
    try {
      const amountPaise = 8500 * 100; // 8500 INR in paise
      
      // 1. Create order on backend
      const res = await createRazorpayOrder(amountPaise, `rcpt_${Date.now()}`);
      
      if (!res.success) {
        throw new Error(res.error || 'Failed to create order');
      }

      // 2. Open Razorpay modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
        amount: res.amount,
        currency: res.currency,
        name: "StaySync",
        description: "November Rent Payment",
        order_id: res.order_id,
        handler: async function (response: any) {
          try {
            // 3. Verify signature on backend
            const verifyRes = await verifyRazorpaySignature(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (verifyRes.success) {
              setPaid(true);
              // Trigger WhatsApp receipt asynchronously
              sendWhatsAppReceipt('+919876543210', 8500, 'Rahul');
            } else {
              setErrorMsg('Payment verification failed.');
            }
          } catch (err: any) {
            setErrorMsg(err.message || 'Verification error');
          }
        },
        prefill: {
          name: "Rahul Sharma",
          email: "rahul@example.com",
          contact: "9876543210"
        },
        theme: {
          color: "#3F51B5"
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response: any) {
        console.error("Payment failed:", response.error);
        setErrorMsg(`Payment failed: ${response.error.description}`);
      });
      
      rzp1.open();
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Checkout failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Hi, Rahul 👋</h1>
      </header>

      {/* Active Bill Card */}
      <motion.div 
        className={styles.activeBillCard}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className={styles.billHeader}>
          <span className={styles.billTitle}>November Rent</span>
          <span className={styles.billStatus} style={{ backgroundColor: paid ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.2)' }}>
            {paid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
        
        <div className={styles.billAmount}>
          <span className={styles.currency}>₹</span>
          {paid ? '0' : '8,500'}
        </div>

        {!paid && (
          <div className={styles.payNowWrapper}>
            <AnimatedButton 
              className="pulse-ring" 
              style={{ backgroundColor: 'white', color: 'var(--primary-indigo)' }}
              onClick={handlePayment}
              isLoading={isProcessing}
            >
              Pay Now via Razorpay
            </AnimatedButton>
          </div>
        )}
        
        {errorMsg && !paid && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="text-sm font-medium mt-2 text-danger-red"
            style={{ color: '#F44336', backgroundColor: 'rgba(244, 67, 54, 0.1)', padding: '8px', borderRadius: '4px' }}
          >
            {errorMsg}
          </motion.div>
        )}

        {paid && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="text-sm font-medium mt-2"
          >
            Receipt sent to WhatsApp ✅
          </motion.div>
        )}
      </motion.div>

      {/* Roommate View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className={styles.sectionTitle}>Roommates (101)</h2>
        <div className={styles.roommateList}>
          <div className={styles.roommateCard}>
            <div className={styles.avatar}>V</div>
            <div className={styles.roommateInfo}>
              <div className={styles.roommateName}>Vikram Singh</div>
              <div className={styles.roommateDetail}>Software Engineer at TCS</div>
            </div>
          </div>
          <div className={styles.roommateCard}>
            <div className={styles.avatar} style={{ backgroundColor: '#F8FAFC', color: '#64748B' }}>?</div>
            <div className={styles.roommateInfo}>
              <div className={styles.roommateName}>Available Bed</div>
              <div className={styles.roommateDetail}>Looking for roommate</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Notice Snippet */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-4"
      >
        <div className={`${styles.roommateCard} bg-indigo text-white`} style={{ backgroundColor: 'rgba(63, 81, 181, 0.05)', borderColor: 'var(--primary-indigo)' }}>
          <ShieldAlert className="text-indigo" size={24} />
          <div className={styles.roommateInfo}>
            <div className={`${styles.roommateName} text-indigo`}>WIFI Maintenance</div>
            <div className={styles.roommateDetail}>Wifi will be down for 30 mins tonight.</div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
