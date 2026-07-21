"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send } from 'lucide-react';
import { AnimatedButton } from '@/components/AnimatedButton';
import { getNotices, addNotice } from '@/app/actions/pgowner';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import styles from '../pages.module.css';

export default function NoticeBoard() {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setOwnerId(user.uid);
        const res = await getNotices(user.uid);
        if (res.success && res.data) {
          setNotices(res.data);
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !ownerId) return;
    setIsSending(true);
    
    try {
      const res = await addNotice(ownerId, message.trim());
      if (res.success && res.data) {
        setNotices([{ ...res.data[0], isOptimistic: true }, ...notices]);
        setMessage('');
      } else {
        alert("Failed to send notice: " + res.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

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
          
          <form className={styles.broadcastForm} onSubmit={handleSendNotice}>
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
              type="submit" 
              isLoading={isSending} 
              className={styles.sendBlastBtn}
            >
              <Send size={18} />
              <span>Broadcast to all Tenants</span>
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
            <AnimatePresence>
              {notices.length === 0 && !isLoading && (
                <li className="text-sm">No recent notices found.</li>
              )}
              {notices.map((notice, i) => (
                <motion.li 
                  key={notice.notice_id || `opt-${i}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={i > 0 ? "mt-4" : ""}
                >
                  <strong>{notice.message.split('.')[0] || 'Notice'}</strong>
                  <p className="text-sm mt-1">{notice.message}</p>
                  <span className="text-xs">
                    {new Date(notice.created_at).toLocaleString('en-IN', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                    })}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
