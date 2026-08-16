"use client";

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Save, AlertTriangle, Clock, RefreshCw, 
  Plus, Minus, CreditCard
} from 'lucide-react';
import { getWhatsAppReminderSettings, updateWhatsAppReminderSettings } from '@/app/actions/superadmin';
import { toast } from 'react-hot-toast';
import styles from './whatsappRules.module.css';

export default function WhatsAppRulesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    dueDayReminder: true,
    overdueFirstReminderDays: 1,
    overdueReminderFrequencyDays: 3,
    tenantPaymentsEnabled: true
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await getWhatsAppReminderSettings();
        if (res.success && res.data) {
          setSettings({
            dueDayReminder: res.data.dueDayReminder ?? true,
            overdueFirstReminderDays: res.data.overdueFirstReminderDays ?? 1,
            overdueReminderFrequencyDays: res.data.overdueReminderFrequencyDays ?? 3,
            tenantPaymentsEnabled: res.data.tenantPaymentsEnabled ?? true
          });
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateWhatsAppReminderSettings(settings);
    setSaving(false);
    if (res.success) {
      toast.success("WhatsApp Reminder Rules saved!");
    } else {
      toast.error("Failed to save rules: " + res.error);
    }
  };

  const adjustValue = (key: 'overdueFirstReminderDays' | 'overdueReminderFrequencyDays', delta: number, min = 1, max = 30) => {
    setSettings(prev => ({
      ...prev,
      [key]: Math.min(max, Math.max(min, (prev[key] || 1) + delta))
    }));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      
      {/* Top Header */}
      <div className={styles.topHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIconBox}>
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className={styles.title}>WhatsApp Reminder Rules</h1>
            <p className={styles.subtitle}>Configure automated rent reminder schedules across all PG hostels.</p>
          </div>
        </div>

        <button 
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
          type="button"
        >
          {saving ? (
            <div style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          ) : (
            <Save size={16} />
          )}
          {saving ? 'Saving...' : 'Save Rules'}
        </button>
      </div>

      {/* Rules Form */}
      <div className={styles.settingsCard}>

        {/* Setting 1: Due Day Reminder */}
        <div className={styles.settingItem}>
          <div className={styles.settingHeader}>
            <div className={styles.settingTitleGroup}>
              <div className={styles.iconDot} style={{ background: '#eef2ff', color: '#4f46e5' }}>
                <Clock size={18} />
              </div>
              <div>
                <h3 className={styles.itemTitle}>Due Day Reminder (8:00 AM)</h3>
                <p className={styles.itemDesc}>Automated notice dispatched on the exact due date.</p>
              </div>
            </div>

            <label className={styles.toggleSwitch}>
              <input 
                type="checkbox" 
                checked={settings.dueDayReminder}
                onChange={(e) => setSettings({ ...settings, dueDayReminder: e.target.checked })}
              />
              <span className={styles.slider} />
            </label>
          </div>
        </div>

        {/* Setting 2: First Overdue Warning */}
        <div className={styles.settingItem}>
          <div className={styles.settingHeader}>
            <div className={styles.settingTitleGroup}>
              <div className={styles.iconDot} style={{ background: '#fee2e2', color: '#ef4444' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className={styles.itemTitle}>First Overdue Warning</h3>
                <p className={styles.itemDesc}>Grace period after due date before sending 1st warning.</p>
              </div>
            </div>
          </div>

          <div className={styles.controlRow}>
            <div className={styles.stepperGroup}>
              <button 
                className={styles.stepperBtn}
                onClick={() => adjustValue('overdueFirstReminderDays', -1, 1, 30)}
                type="button"
              >
                <Minus size={14} />
              </button>
              <span className={styles.stepperValue}>{settings.overdueFirstReminderDays} {settings.overdueFirstReminderDays === 1 ? 'Day' : 'Days'}</span>
              <button 
                className={styles.stepperBtn}
                onClick={() => adjustValue('overdueFirstReminderDays', 1, 1, 30)}
                type="button"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className={styles.presetChips}>
              {[1, 2, 3].map(days => (
                <button
                  key={days}
                  type="button"
                  className={`${styles.chip} ${settings.overdueFirstReminderDays === days ? styles.chipActive : ''}`}
                  onClick={() => setSettings({ ...settings, overdueFirstReminderDays: days })}
                >
                  +{days}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Setting 3: Repeat Overdue Frequency */}
        <div className={styles.settingItem}>
          <div className={styles.settingHeader}>
            <div className={styles.settingTitleGroup}>
              <div className={styles.iconDot} style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <RefreshCw size={18} />
              </div>
              <div>
                <h3 className={styles.itemTitle}>Overdue Repeat Frequency</h3>
                <p className={styles.itemDesc}>How often to repeat warnings after the initial alert.</p>
              </div>
            </div>
          </div>

          <div className={styles.controlRow}>
            <div className={styles.stepperGroup}>
              <button 
                className={styles.stepperBtn}
                onClick={() => adjustValue('overdueReminderFrequencyDays', -1, 1, 14)}
                type="button"
              >
                <Minus size={14} />
              </button>
              <span className={styles.stepperValue}>Every {settings.overdueReminderFrequencyDays}d</span>
              <button 
                className={styles.stepperBtn}
                onClick={() => adjustValue('overdueReminderFrequencyDays', 1, 1, 14)}
                type="button"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className={styles.presetChips}>
              {[2, 3, 5, 7].map(days => (
                <button
                  key={days}
                  type="button"
                  className={`${styles.chip} ${settings.overdueReminderFrequencyDays === days ? styles.chipActive : ''}`}
                  onClick={() => setSettings({ ...settings, overdueReminderFrequencyDays: days })}
                >
                  Every {days}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Setting 4: Tenant Payments */}
        <div className={styles.settingItem}>
          <div className={styles.settingHeader}>
            <div className={styles.settingTitleGroup}>
              <div className={styles.iconDot} style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CreditCard size={18} />
              </div>
              <div>
                <h3 className={styles.itemTitle}>Tenant Payments</h3>
                <p className={styles.itemDesc}>Enable or disable tenant payments across all PG hostels.</p>
              </div>
            </div>

            <label className={styles.toggleSwitch}>
              <input 
                type="checkbox" 
                checked={settings.tenantPaymentsEnabled}
                onChange={async (e) => {
                  const val = e.target.checked;
                  const updated = { ...settings, tenantPaymentsEnabled: val };
                  setSettings(updated);
                  const res = await updateWhatsAppReminderSettings(updated);
                  if (res.success) {
                    toast.success(val ? "Tenant payments ENABLED" : "Tenant payments LOCKED");
                  } else {
                    toast.error("Failed to save setting");
                  }
                }}
              />
              <span className={styles.slider} />
            </label>
          </div>
        </div>

      </div>

    </div>
  );
}
