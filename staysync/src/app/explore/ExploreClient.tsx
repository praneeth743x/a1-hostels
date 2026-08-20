"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Map, SlidersHorizontal, MapPin, Bookmark, Wifi, Utensils, 
  AirVent, WashingMachine, ShieldCheck, Zap, ArrowLeft, PhoneCall, 
  MessageCircle, Star, Sparkles, X, ChevronRight, Building2, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './explore.module.css';
import globalStyles from '../page.module.css';

const FILTERS = [
  { label: 'All', id: 'all' },
  { label: 'Wi-Fi', id: 'wifi', icon: Wifi },
  { label: 'Food / Mess', id: 'food', icon: Utensils },
  { label: 'AC Rooms', id: 'ac', icon: AirVent },
  { label: 'Laundry', id: 'washing', icon: WashingMachine },
  { label: 'Security', id: 'security', icon: ShieldCheck },
  { label: 'Power Backup', id: 'power', icon: Zap }
];

export default function ExploreClient({ initialHostels }: { initialHostels: any[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarked, setBookmarked] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('cachedLogoUrl')) {
      return localStorage.getItem('cachedLogoUrl')!;
    }
    return '/himalaya_logo_premium.png';
  });

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => {});
    }

    import('@/lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, getDoc }) => {
        getDoc(doc(db, 'system_settings', 'landing')).then((snap) => {
          if (snap.exists() && snap.data()?.logoUrl) {
            const url = snap.data().logoUrl;
            setLogoUrl(url);
            if (typeof window !== 'undefined') localStorage.setItem('cachedLogoUrl', url);
          }
        }).catch(() => {});
      });
    });
  }, []);

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarked(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  const filteredHostels = (initialHostels || [])
    .filter(h => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (h.name || '').toLowerCase().includes(q) || 
        (h.address || '').toLowerCase().includes(q) ||
        (h.city || '').toLowerCase().includes(q) ||
        (h.area || '').toLowerCase().includes(q);
      
      if (activeFilter === 'all') return matchesSearch;

      const ams = (h.amenities || []).map((a: string) => a.toLowerCase());
      const facs = (h.facilities || []).map((f: string) => f.toLowerCase());
      const allSpecs = [...ams, ...facs].join(' ');

      if (activeFilter === 'wifi') return matchesSearch && (allSpecs.includes('wifi') || allSpecs.includes('wi-fi') || allSpecs.includes('internet'));
      if (activeFilter === 'food') return matchesSearch && (allSpecs.includes('food') || allSpecs.includes('mess') || allSpecs.includes('meals') || allSpecs.includes('dining'));
      if (activeFilter === 'ac') return matchesSearch && (allSpecs.includes('ac') || allSpecs.includes('air'));
      if (activeFilter === 'washing') return matchesSearch && (allSpecs.includes('washing') || allSpecs.includes('laundry'));
      if (activeFilter === 'security') return matchesSearch && (allSpecs.includes('cctv') || allSpecs.includes('security') || allSpecs.includes('guard'));
      if (activeFilter === 'power') return matchesSearch && (allSpecs.includes('power') || allSpecs.includes('generator') || allSpecs.includes('backup'));

      return matchesSearch;
    })
    .map(h => {
      let distance = Infinity;
      if (userLoc && h.lat && h.lng) {
        distance = getDistance(userLoc.lat, userLoc.lng, h.lat, h.lng);
      }
      return { ...h, distance };
    })
    .sort((a, b) => {
      if (userLoc && isFinite(a.distance) && isFinite(b.distance)) {
        return a.distance - b.distance;
      }
      return 0;
    });

  return (
    <div className={styles.exploreRoot}>
      {/* Luxury Ambient Background */}
      <div className={globalStyles.silkAmbientBackground}>
        <div className={globalStyles.glowGoldOrb1}></div>
        <div className={globalStyles.glowGoldOrb2}></div>
        <div className={globalStyles.glowPearlOrb}></div>
        <div className={globalStyles.liquidRibbon1}></div>
        <div className={globalStyles.liquidRibbon2}></div>
      </div>

      {/* Vision Header */}
      <motion.header 
        className={globalStyles.visionHeader}
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={globalStyles.headerTopRow}>
          <Link href="/" className={globalStyles.visionBrand} style={{ textDecoration: 'none' }}>
            <div className={globalStyles.officialLogoImg}>
              <img 
                src={logoUrl || "/himalaya_logo_premium.png"} 
                alt="Logo" 
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            </div>
            <div className={globalStyles.brandTitleColumn}>
              <span className={globalStyles.brandTitleText}>A1 HOSTELS</span>
              <span className={globalStyles.brandSubtitleText}>PREMIUM LIVING</span>
            </div>
          </Link>

          <div className={globalStyles.headerActionGroup}>
            <button 
              onClick={() => router.push('/')} 
              className={styles.homeBtn}
              type="button"
            >
              <ArrowLeft size={16} />
              <span>Back Home</span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Main Container */}
      <main className={styles.mainContainer}>
        {/* Hero Search Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroTextRow}>
            <div>
              <div className={styles.heroBadge}>
                <Sparkles size={13} className={styles.sparkleIcon} />
                <span>EXPLORE VERIFIED SPACES</span>
              </div>
              <h1 className={styles.heroTitle}>Discover Your Ideal PG & Hostel</h1>
              <p className={styles.heroSubtitle}>Browse luxury student and executive accommodations with top tier amenities</p>
            </div>

            <button 
              className={styles.mapTriggerBtn}
              onClick={() => window.open('https://www.google.com/maps/search/hostels', '_blank')}
            >
              <Map size={18} />
              <span>View On Map</span>
            </button>
          </div>

          {/* Search Input Bar */}
          <div className={styles.searchBarWrapper}>
            <Search className={styles.searchBarIcon} size={20} />
            <input 
              type="text" 
              placeholder="Search by PG name, city, landmark, or area..." 
              className={styles.searchBarInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                className={styles.searchClearBtn}
                onClick={() => setSearchQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className={styles.filterPillsRow}>
            {FILTERS.map((f) => {
              const Icon = f.icon;
              const isActive = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className={`${styles.filterPill} ${isActive ? styles.filterPillActive : ''}`}
                >
                  {Icon && <Icon size={15} />}
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Results Bar */}
        <div className={styles.resultsInfoBar}>
          <div className={styles.resultsCount}>
            <span>Showing</span> <strong>{filteredHostels.length}</strong> <span>hostels</span>
            {activeFilter !== 'all' && (
              <span className={styles.activeFilterTag}>
                Filtered by {FILTERS.find(f => f.id === activeFilter)?.label}
                <button onClick={() => setActiveFilter('all')}><X size={12} /></button>
              </span>
            )}
          </div>

          {userLoc && (
            <div className={styles.locationBadge}>
              <MapPin size={13} />
              <span>Sorted by nearest to you</span>
            </div>
          )}
        </div>

        {/* Hostels Grid */}
        <div className={styles.hostelsGrid}>
          {filteredHostels.length === 0 ? (
            <div className={styles.emptyStateContainer}>
              <div className={styles.emptyStateIcon}><Building2 size={40} /></div>
              <h3>No Hostels Found</h3>
              <p>We couldn't find any properties matching "{searchQuery}". Try searching with different keywords or resetting filters.</p>
              <button 
                type="button" 
                onClick={() => { setSearchQuery(''); setActiveFilter('all'); }} 
                className={styles.resetSearchBtn}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredHostels.map((hostel, index) => {
              const coverImg = (hostel.images && hostel.images.length > 0) 
                ? hostel.images[0] 
                : (hostel.imageUrl || '/luxury_building.png');
              const isSaved = bookmarked.includes(hostel.id);
              const cleanPhone = (hostel.phone || '').replace(/\D/g, '');

              return (
                <motion.div 
                  key={hostel.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className={styles.hostelCard}
                  onClick={() => router.push(`/hostels/${hostel.id}`)}
                >
                  {/* Image Cover */}
                  <div className={styles.cardCover}>
                    <img 
                      src={coverImg} 
                      alt={hostel.name || 'PG Hostel'} 
                      className={styles.coverImage}
                      loading="lazy"
                    />
                    <div className={styles.coverGradient}></div>

                    {/* Top Badges */}
                    <div className={styles.coverTopBadges}>
                      <div className={styles.verifiedPill}>
                        <CheckCircle2 size={12} />
                        <span>Verified</span>
                      </div>
                      <button 
                        type="button"
                        className={`${styles.bookmarkBtn} ${isSaved ? styles.bookmarkBtnActive : ''}`}
                        onClick={(e) => toggleBookmark(hostel.id, e)}
                        title={isSaved ? 'Remove from saved' : 'Save hostel'}
                      >
                        <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    {/* Bottom Cover Info */}
                    <div className={styles.coverBottomBadges}>
                      <div className={styles.ratingBadge}>
                        <Star size={12} fill="#f59e0b" color="#f59e0b" />
                        <span>4.9</span>
                      </div>
                      {isFinite(hostel.distance) && (
                        <div className={styles.distanceBadge}>
                          <MapPin size={11} />
                          <span>{hostel.distance < 1 ? `${Math.round(hostel.distance * 1000)}m` : `${hostel.distance.toFixed(1)} km`}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className={styles.cardBody}>
                    <div className={styles.titleRow}>
                      <h3 className={styles.hostelTitle}>{hostel.name || 'A1 Hostels & PG'}</h3>
                    </div>

                    <div className={styles.addressRow}>
                      <MapPin size={14} className={styles.addressPin} />
                      <span className={styles.addressText}>{hostel.address || hostel.city || 'Hyderabad, Telangana'}</span>
                    </div>

                    {/* Facility Tags */}
                    <div className={styles.amenitiesRow}>
                      <span className={styles.amenityTag}><Wifi size={12} /> High-Speed Wi-Fi</span>
                      <span className={styles.amenityTag}><Utensils size={12} /> 3-Time Food</span>
                      <span className={styles.amenityTag}><AirVent size={12} /> AC / Non-AC</span>
                    </div>

                    {/* Footer Actions */}
                    <div className={styles.cardFooter}>
                      <div className={styles.priceCol}>
                        <span className={styles.priceLabel}>Monthly Rent</span>
                        <span className={styles.priceVal}>
                          {hostel.starting_price || hostel.price ? `₹${Number(hostel.starting_price || hostel.price).toLocaleString('en-IN')}` : 'Best Rates'}
                        </span>
                      </div>

                      <div className={styles.actionButtons}>
                        {cleanPhone && (
                          <>
                            <a 
                              href={`https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(`Hi, I am interested in ${hostel.name || 'your PG Hostel'}. Please share room availability and details.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.whatsappActionBtn}
                              onClick={(e) => e.stopPropagation()}
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </a>

                            <a 
                              href={`tel:${cleanPhone}`}
                              className={styles.callActionBtn}
                              onClick={(e) => e.stopPropagation()}
                              title="Call Property"
                            >
                              <PhoneCall size={16} />
                            </a>
                          </>
                        )}

                        <button 
                          type="button" 
                          className={styles.viewDetailsBtn}
                        >
                          <span>Details</span>
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
