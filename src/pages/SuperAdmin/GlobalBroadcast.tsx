import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send } from 'lucide-react';
import { AnimatedButton } from '../../components/AnimatedButton';
import './SuperAdmin.css';

export const GlobalBroadcast: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    // Mock API call for WhatsApp Blast
    setTimeout(() => {
      setIsSending(false);
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setMessage('');
      }, 3000);
    }, 2000);
  };

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Global Broadcast</h1>
          <p className="page-subtitle">Send WhatsApp messages to all 2,500+ tenants instantly</p>
        </div>
      </header>

      <div className="broadcast-grid">
        <motion.div 
          className="broadcast-editor glass-card"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="card-header">
            <MessageSquare size={20} className="text-indigo" />
            <h3>Compose Message</h3>
          </div>
          
          <form onSubmit={handleBroadcast} className="broadcast-form">
            <div className="textarea-wrapper">
              <textarea 
                className="broadcast-textarea"
                placeholder="Type your message here... (e.g. Server maintenance scheduled for tonight at 2 AM)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                required
              />
              <div className="char-count text-muted">
                {message.length} characters
              </div>
            </div>

            <AnimatedButton 
              type="submit" 
              isLoading={isSending} 
              disabled={sent || message.trim().length === 0}
              className="send-blast-btn"
            >
              {sent ? 'Message Sent Successfully!' : (
                <>
                  <Send size={18} />
                  <span>Send to All Tenants</span>
                </>
              )}
            </AnimatedButton>
          </form>
        </motion.div>

        <motion.div 
          className="broadcast-info glass-card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h3 className="info-title">Broadcast Guidelines</h3>
          <ul className="info-list text-muted">
            <li>Messages are sent via the official Interakt WhatsApp API.</li>
            <li>Cost per message is approx ₹0.80. Total cost will be billed to the admin account.</li>
            <li>Avoid sending messages between 10 PM and 8 AM to comply with DND regulations.</li>
            <li>Ensure the message is urgent and relevant to all platform users.</li>
          </ul>
          
          <div className="audience-estimate">
            <span className="estimate-label">Estimated Audience:</span>
            <span className="estimate-value text-indigo">2,845 active tenants</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
