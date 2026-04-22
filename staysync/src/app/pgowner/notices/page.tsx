"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send } from 'lucide-react';
import { AnimatedButton } from '@/components/AnimatedButton';
import styles from '../pgowner.module.css';

export default function NoticeBoard() {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Notice Board</h1>
          <p className={styles.pageSubtitle}>Broadcast messages instantly to your tenants' apps</p>
        </div>
      </header>

      <div className={styles.broadcastGrid}>
        <motion.div 
          className={`${styles.broadcastEditor} glass-card`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className={styles.cardHeader}>
            <MessageSquare size={20} className="text-indigo" />
            <h3>Post New Notice</h3>
          </div>
          
          <form className={styles.broadcastForm}>
            <div className={styles.textareaWrapper}>
              <textarea 
                className={styles.broadcastTextarea}
                placeholder="e.g. Water tank cleaning tomorrow at 10 AM. Please fill your buckets."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                required
              />
            </div>

            <AnimatedButton 
              type="button" 
              isLoading={isSending} 
              className={styles.sendBlastBtn}
              onClick={() => {
                setIsSending(true);
                setTimeout(() => { setIsSending(false); setMessage(''); }, 1500);
              }}
            >
              <Send size={18} />
              <span>Broadcast to 45 Tenants</span>
            </AnimatedButton>
          </form>
        </motion.div>

        <motion.div 
          className={`${styles.broadcastInfo} glass-card`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className={styles.infoTitle}>Recent Notices</h3>
          <ul className={`${styles.infoList} text-muted`}>
            <li>
              <strong>WIFI Maintenance</strong>
              <p className="text-sm mt-1">Wifi will be down for 30 mins tonight.</p>
              <span className="text-xs">Yesterday, 4:00 PM</span>
            </li>
            <li className="mt-4">
              <strong>Rent Reminder</strong>
              <p className="text-sm mt-1">Please pay rent by the 5th.</p>
              <span className="text-xs">Oct 28, 9:00 AM</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
