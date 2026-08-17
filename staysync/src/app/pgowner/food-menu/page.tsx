"use client";

import { toast } from 'react-hot-toast';

import React, { useState, useEffect, useRef } from 'react';

import { rpcCall } from '@/lib/rpc';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ChevronDown, Save, Loader2, X, Sun, CloudSun, Moon, ChevronRight, ChevronUp, Download, Share2, Maximize, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './foodMenu.module.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner'];

// Sample images for the meals
const MEAL_IMAGES = {
  Breakfast: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=150&q=80',
  Lunch: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
  Dinner: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=150&q=80'
};

const DAY_COLORS = [
  '#ff9800', // Mon (Orange)
  '#2196f3', // Tue (Blue)
  '#4caf50', // Wed (Green)
  '#9c27b0', // Thu (Purple)
  '#f44336', // Fri (Red)
  '#ffc107', // Sat (Yellow)
  '#00bcd4', // Sun (Cyan)
];

import { useHostel } from '@/context/HostelContext';
import { useHostelData } from '@/hooks/useHostelData';

import { Suspense } from 'react';
function FoodMenuPageContent() {
  const { properties: storeProperties, selectedPgId } = useHostel();
  const { data: hostelData } = useHostelData(selectedPgId);
  const storeFoodMenu = hostelData?.foodMenu || null;
  const initialPgId = selectedPgId || (typeof window !== 'undefined' ? localStorage.getItem('activePgId') : null);

  const [properties, setProperties] = useState<any[]>(storeProperties || []);
  const [selectedPgIds, setSelectedPgIds] = useState<string[]>(initialPgId ? [initialPgId] : ['ALL']);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  
  const [menuData, setMenuData] = useState<Record<string, Record<string, string[]>>>(() => {
    const initial: any = {};
    DAYS.forEach(day => {
      initial[day] = { Breakfast: [], Lunch: [], Dinner: [] };
    });
    return initial;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [allKnownTags, setAllKnownTags] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleHostelsUpdated = () => {
      const currentId = localStorage.getItem('activePgId');
      if (currentId) {
        setSelectedPgIds([currentId]);
      }
    };
    window.addEventListener('hostelsUpdated', handleHostelsUpdated);

    return () => {
      window.removeEventListener('hostelsUpdated', handleHostelsUpdated);
    };
  }, []);

  useEffect(() => {
    if (storeProperties && storeProperties.length > 0) {
      setProperties(storeProperties);
    }
  }, [storeProperties]);

  useEffect(() => {
    const initial: any = {};
    DAYS.forEach(day => {
      initial[day] = { Breakfast: [], Lunch: [], Dinner: [] };
    });

    if (storeFoodMenu && (storeFoodMenu as any).menu) {
      const menuInfo = (storeFoodMenu as any).menu;
      Object.keys(menuInfo).forEach(day => {
        Object.keys(menuInfo[day]).forEach(meal => {
          const val = menuInfo[day][meal];
          if (typeof val === 'string') {
            initial[day][meal] = val.split(',').map((s: string) => s.trim()).filter((s: string) => s);
          } else if (Array.isArray(val)) {
            initial[day][meal] = val;
          }
        });
      });
    }
    setMenuData(initial);
    setIsLoading(false);
  }, [storeFoodMenu]);

  useEffect(() => {
    const tags = new Set<string>();
    Object.values(menuData).forEach(dayData => {
      Object.values(dayData).forEach(mealArr => {
        mealArr.forEach(item => tags.add(item));
      });
    });
    setAllKnownTags(Array.from(tags));
  }, [menuData]);

  const handleSave = async () => {
    if (!ownerId || selectedPgIds.length === 0) return;
    setIsSaving(true);
    try {
      await rpcCall('updateFoodMenu', ownerId, selectedPgIds, menuData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save menu');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePgSelection = (pgId: string) => {
    if (pgId === 'ALL') {
      setSelectedPgIds(['ALL']);
      setIsDropdownOpen(false);
      return;
    }
    
    let newSelection = selectedPgIds.filter(id => id !== 'ALL');
    if (newSelection.includes(pgId)) {
      newSelection = newSelection.filter(id => id !== pgId);
    } else {
      newSelection.push(pgId);
    }
    
    if (newSelection.length === 0) {
      newSelection = ['ALL'];
    }
    setSelectedPgIds(newSelection);
  };

  const getSelectionText = () => {
    if (selectedPgIds.includes('ALL')) return 'All Hostels';
    if (selectedPgIds.length === 1) {
      const p = properties.find(p => p.pg_id === selectedPgIds[0]);
      return p ? p.name : 'Unknown';
    }
    return `${selectedPgIds.length} Hostels Selected`;
  };

  const handleDownload = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('hidden-printable-menu');
      if (!element) return;
      const opt = {
        margin: 10,
        filename: 'Weekly_Food_Menu.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
      };
      html2pdf().from(element).set(opt).save();
    } catch (err) {
      console.error("Failed to load html2pdf", err);
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  const handleShare = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('hidden-printable-menu');
      if (!element) return;
      const opt = {
        margin: 10,
        filename: 'Weekly_Food_Menu.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
      };
      
      // Generate PDF as a blob
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
      const file = new File([pdfBlob], 'Weekly_Food_Menu.pdf', { type: 'application/pdf' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Weekly Food Menu',
          text: `Here is the weekly food menu for ${getSelectionText()}`,
          files: [file],
        });
      } else if (navigator.share) {
        // Fallback to URL if file sharing is not supported by the device/browser
        await navigator.share({
          title: 'Weekly Food Menu',
          text: `Check out the weekly food menu for ${getSelectionText()}`,
          url: window.location.href,
        });
      } else {
        toast.error("Sharing is not supported on this device/browser.");
      }
    } catch (err) {
      console.error("Error sharing:", err);
      toast.error("Failed to share the menu.");
    }
  };

  // Helper to count items
  const getItemCount = (day: string, meal: string) => {
    return menuData[day]?.[meal]?.length || 0;
  };

  const getTodayString = () => {
    const d = new Date();
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  };
  const currentDayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]; // Mon = 0

  return (
    <div className={styles.appContainer}>
      {/* Hostel Selector */}
      <div className={styles.hostelSelectContainer}>
        <div className={styles.hostelSelectWrapper}>
          <button 
            className={styles.hostelSelectBtn}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span className={styles.hostelSelectLabel}>Hostel</span>
            <div className={styles.hostelSelectValue}>
              <span className={styles.truncate}>{getSelectionText()}</span>
              <ChevronDown size={18} color="#64748b" />
            </div>
          </button>
          
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={styles.dropdownMenu}
              >
                <div className={styles.checkboxItem} onClick={() => togglePgSelection('ALL')}>
                  <input type="checkbox" checked={selectedPgIds.includes('ALL')} readOnly />
                  <span>All Hostels</span>
                </div>
                {properties.map(p => (
                  <div key={p.pg_id} className={styles.checkboxItem} onClick={() => togglePgSelection(p.pg_id)}>
                    <input type="checkbox" checked={selectedPgIds.includes(p.pg_id)} readOnly />
                    <span>{p.name}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Action Bar (Download & Share) */}
      <div className={styles.actionBarWrapper}>
        <div className={styles.actionBar}>
          <button className={styles.actionBtn} onClick={handleDownload}>
            <Download size={20} color="#10b981" />
            <span style={{ color: '#10b981' }}>Download PDF</span>
          </button>
          <div className={styles.divider}></div>
          <button className={styles.actionBtn} onClick={handleShare}>
            <Share2 size={20} color="#6a1b9a" />
            <span style={{ color: '#6a1b9a' }}>Share Menu</span>
          </button>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Weekly Menu</h2>

      {/* Accordion List */}
      <div className={styles.accordionList}>
        {DAYS.map((day, idx) => {
          const isExpanded = selectedDay === day;
          const bCount = getItemCount(day, 'Breakfast');
          const lCount = getItemCount(day, 'Lunch');
          const dCount = getItemCount(day, 'Dinner');
          const edgeColor = DAY_COLORS[idx];

          return (
            <div 
              key={day} 
              className={`${styles.accordionCard} ${isExpanded ? styles.expandedCard : ''}`}
              style={{ borderLeftColor: edgeColor }}
            >
              <div 
                className={styles.accordionHeader} 
                onClick={() => setSelectedDay(isExpanded ? null : day)}
              >
                <div className={styles.dayIcon} style={{ color: edgeColor }}>
                  <Sun size={24} />
                </div>
                <div className={styles.dayInfo}>
                  <h3 className={styles.dayName}>{day}</h3>
                  <p className={styles.daySummary}>
                    Breakfast {bCount} • Lunch {lCount} • Dinner {dCount}
                  </p>
                </div>
                <div className={styles.expandIcon} style={{ color: isExpanded ? '#10b981' : '#64748b' }}>
                  {isExpanded ? <ChevronUp size={24} /> : <ChevronRight size={24} />}
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className={styles.accordionContent}
                  >
                    {/* Edit Form */}
                    <div className={styles.editSection}>
                      <h4 className={styles.editTitle}>Edit Items</h4>
                      {MEALS.map(meal => (
                        <TagInput 
                          key={`${day}-${meal}`}
                          label={meal}
                          tags={menuData[day]?.[meal] || []}
                          allKnownTags={allKnownTags}
                          onChange={(newTags) => {
                            setMenuData(prev => ({
                              ...prev,
                              [day]: {
                                ...prev[day],
                                [meal]: newTags
                              }
                            }));
                          }}
                        />
                      ))}
                      
                      <button 
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
                        {isSaving ? 'Saving...' : 'Save Menu'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Hidden element for PDF generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div id="hidden-printable-menu" style={{ padding: '20px', background: 'white', fontFamily: 'sans-serif', color: '#000' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '20px', color: '#6a1b9a' }}>{getSelectionText()} - Weekly Food Menu</h1>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3e8ff' }}>
                <th style={{ border: '1px solid #ccc', padding: '12px', textAlign: 'left', color: '#6a1b9a' }}>Day</th>
                <th style={{ border: '1px solid #ccc', padding: '12px', textAlign: 'left', color: '#6a1b9a' }}>Breakfast</th>
                <th style={{ border: '1px solid #ccc', padding: '12px', textAlign: 'left', color: '#6a1b9a' }}>Lunch</th>
                <th style={{ border: '1px solid #ccc', padding: '12px', textAlign: 'left', color: '#6a1b9a' }}>Dinner</th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => {
                const dayData = menuData[day] || { Breakfast: [], Lunch: [], Dinner: [] };
                return (
                  <tr key={day}>
                    <td style={{ border: '1px solid #ccc', padding: '12px', fontWeight: 'bold' }}>{day}</td>
                    <td style={{ border: '1px solid #ccc', padding: '12px' }}>
                      {dayData.Breakfast?.length > 0 ? dayData.Breakfast.join(', ') : '-'}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '12px' }}>
                      {dayData.Lunch?.length > 0 ? dayData.Lunch.join(', ') : '-'}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '12px' }}>
                      {dayData.Dinner?.length > 0 ? dayData.Dinner.join(', ') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}

// Custom Tag Input Component with Auto-Suggest
function TagInput({ label, tags, allKnownTags, onChange }: { label: string, tags: string[], allKnownTags: string[], onChange: (tags: string[]) => void }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    if (val.trim().length > 0) {
      const filtered = allKnownTags.filter(tag => 
        tag.toLowerCase().includes(val.toLowerCase()) && !tags.includes(tag)
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className={styles.mealInputGroup} ref={containerRef}>
      <label className={styles.mealLabel}>{label}</label>
      <div className={styles.tagInputContainer}>
        {tags.map(tag => (
          <div key={tag} className={styles.tag}>
            {tag}
            <button className={styles.removeTagBtn} onClick={() => removeTag(tag)}>
              <X size={14} />
            </button>
          </div>
        ))}
        <input
          type="text"
          className={styles.tagInput}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim().length > 0 && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              if (inputValue.trim()) {
                addTag(inputValue);
              }
            }, 150);
          }}
          placeholder={tags.length === 0 ? `Add item...` : 'Type and press Enter...'}
        />
      </div>
      
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={styles.suggestionsDropdown}
          >
            {suggestions.map(suggestion => (
              <div 
                key={suggestion} 
                className={styles.suggestionItem}
                onClick={() => addTag(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FoodMenuPage() { return <Suspense fallback={<div>Loading...</div>}><FoodMenuPageContent /></Suspense>; }
