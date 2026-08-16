"use client";

import React from 'react';
import { X, Download } from 'lucide-react';
import styles from './foodMenu.module.css';
import { motion } from 'framer-motion';

interface MenuViewerProps {
  menuData: Record<string, Record<string, string[]>>;
  hostelName: string;
  onClose: () => void;
  onDownload: () => void;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

// High-quality food images for the banner
const BANNER_IMAGES = [
  'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
];

export default function MenuViewer({ menuData, hostelName, onClose, onDownload }: MenuViewerProps) {
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={styles.viewerOverlay}
    >
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className={styles.viewerModal}
        style={{ maxWidth: '1000px' }}
      >
        <div className={styles.viewerActions}>
          <button className={styles.actionBtn} onClick={onDownload}>
             <Download size={18} />
             Download PDF
          </button>
          <button className={styles.closeBtn} onClick={onClose}>
             <X size={24} />
          </button>
        </div>

        <div className={styles.printableMenu} id="printable-menu">
          

          <table className={styles.menuTable}>
            <thead>
              <tr>
                <th className={styles.emptyTh}></th>
                <th className={styles.mealTh}>BREAKFAST</th>
                <th className={styles.mealTh}>LUNCH</th>
                <th className={styles.mealTh}>DINNER</th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => {
                const dayKey = day.charAt(0) + day.slice(1).toLowerCase(); 
                const dayData = menuData[dayKey] || { Breakfast: [], Lunch: [], Dinner: [] };
                
                return (
                  <tr key={day}>
                    <td className={styles.dayTd}>{day}</td>
                    <td className={styles.mealTd}>
                      {dayData.Breakfast?.length > 0 ? dayData.Breakfast.join(', ') : '-'}
                    </td>
                    <td className={styles.mealTd}>
                      {dayData.Lunch?.length > 0 ? dayData.Lunch.join(', ') : '-'}
                    </td>
                    <td className={styles.mealTd}>
                      {dayData.Dinner?.length > 0 ? dayData.Dinner.join(', ') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>
      </motion.div>
    </motion.div>
  );
}
