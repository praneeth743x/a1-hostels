"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Search, Mic, Map, SlidersHorizontal, MapPin, Bookmark, Wifi, Utensils, AirVent, WashingMachine, ChevronDown, Camera, Home, Bed, Search as Compass, PlusSquare, Calendar, User, ArrowLeft, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './explore.module.css';
import globalStyles from '../page.module.css';

// DUMMY_HOSTELS removed in favor of real data from the server

const FILTERS = [
  { label: 'Filters', icon: SlidersHorizontal, isPrimary: true },
  { label: 'Wi-Fi', icon: Wifi },
  { label: 'Food', icon: Utensils },
  { label: 'AC Rooms', icon: AirVent },
  { label: 'Washing Machine', icon: WashingMachine }
];

export default function ExploreClient({ initialHostels }: { initialHostels: any[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [bookmarked, setBookmarked] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('cachedLogoUrl')) {
      return localStorage.getItem('cachedLogoUrl')!;
    }
    return '/himalaya_logo_premium.png';
  });

  React.useEffect(() => {
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

  const toggleBookmark = (id: string) => {
    setBookmarked(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const toggleFilter = (label: string) => {
    if (label === 'Filters') return;
    setActiveFilters(prev => prev.includes(label) ? prev.filter(f => f !== label) : [...prev, label]);
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
      const matchesSearch = (h.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (h.address || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilters = activeFilters.length === 0 || activeFilters.every(filter => {
        const lowerFilter = filter.toLowerCase();
        const ams = (h.amenities || []).map((a: string) => a.toLowerCase());
        const facs = (h.facilities || []).map((f: string) => f.toLowerCase());
        
        // Some properties just have "AC", so check for inclusion
        return ams.some((a: string) => a.includes(lowerFilter.replace(' rooms', ''))) || 
               facs.some((f: string) => f.includes(lowerFilter.replace(' rooms', '')));
      });

      return matchesSearch && matchesFilters;
    })
    .map(h => {
      let distance = Infinity;
      if (userLoc && h.lat && h.lng) {
        distance = getDistance(userLoc.lat, userLoc.lng, h.lat, h.lng);
      }
      return { ...h, distance };
    })
    .sort((a, b) => {
       if (userLoc) return a.distance - b.distance;
       return 0;
    });

  return (
    <div className={styles.pageContainer}>
      
      {/* Luxury Liquid Background from Landing Page */}
      <div className={globalStyles.silkAmbientBackground}>
        <div className={globalStyles.glowGoldOrb1}></div>
        <div className={globalStyles.glowGoldOrb2}></div>
        <div className={globalStyles.glowPearlOrb}></div>
        <div className={globalStyles.liquidRibbon1}></div>
        <div className={globalStyles.liquidRibbon2}></div>
      </div>

      {/* Original Floating VisionOS Glass Header */}
      <motion.header 
        className={globalStyles.visionHeader}
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
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
              <span className={globalStyles.brandTitleText}>HIMALAYA HOSTELS</span>
              <span className={globalStyles.brandSubtitleText}>EXPLORE HOSTELS</span>
            </div>
          </Link>

          <div className={globalStyles.headerActionGroup}>
            <button 
              onClick={() => router.push('/')} 
              className={styles.backButton}
              type="button"
              style={{ background: 'rgba(27, 46, 19, 0.08)', border: '1px solid rgba(27, 46, 19, 0.18)', padding: '6px 14px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1b2e13', fontWeight: 700, fontSize: '0.8rem' }}
            >
              <ArrowLeft size={16} />
              <span>Home</span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Scrollable Content Area */}
      <main className={styles.mainContent}>
        
        {/* Premium Sticky Top Section */}
        <div className={styles.topSection}>
          {/* Header Area */}
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <h1 className={styles.title}>Explore Hostels</h1>
              <p className={styles.subtitle}>Find your perfect stay</p>
            </div>
            <button 
              className={styles.mapButton}
              onClick={() => window.open('https://www.google.com/maps/search/hostels', '_blank')}
            >
              <Map size={18} />
              <span>Map</span>
            </button>
          </header>

          {/* Search Bar & Filter Row */}
          <div className={styles.searchRow}>
            <div className={styles.searchContainer}>
              <Search className={styles.searchIcon} size={22} />
              <input 
                type="text" 
                placeholder="Search by hostel or place name..." 
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <button 
              className={`${styles.filterButton} ${activeFilters.length > 0 ? styles.filterButtonActive : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={22} />
              {activeFilters.length > 0 && <span className={styles.filterBadge}>{activeFilters.length}</span>}
            </button>
          </div>

          {/* Expandable Filters Dropdown */}
          {showFilters && (
            <div className={styles.filterDropdown}>
              <div className={styles.filterDropdownHeader}>
                <span className={styles.filterDropdownTitle}>Facilities</span>
                {activeFilters.length > 0 && (
                  <button className={styles.clearFiltersBtn} onClick={() => setActiveFilters([])}>
                    Clear all
                  </button>
                )}
              </div>
              <div className={styles.filterDropdownGrid}>
                {FILTERS.slice(1).map((filter, index) => {
                  const Icon = filter.icon;
                  const isActive = activeFilters.includes(filter.label);
                  return (
                    <button 
                      key={index} 
                      className={`${styles.dropdownFilterItem} ${isActive ? styles.dropdownFilterItemActive : ''}`}
                      onClick={() => toggleFilter(filter.label)}
                    >
                      <Icon size={18} />
                      <span>{filter.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className={styles.resultHeader}>
          <h2 className={styles.resultCount}>{filteredHostels.length} Hostels <span className={styles.foundText}>found</span></h2>
          <button className={styles.sortButton}>
            Sort by: <span className={styles.sortHighlight}>{userLoc ? 'Nearest' : 'Relevance'}</span>
            <ChevronDown size={14} className={styles.sortChevron} />
          </button>
        </div>

        {/* Hostel List */}
        <div className={styles.hostelList}>
          {filteredHostels.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No hostels found</p>
              <span>Try changing your search or filters.</span>
              <button onClick={() => setSearchQuery('')} className={styles.clearSearchBtn}>Clear Search</button>
            </div>
          ) : (
            filteredHostels.map(hostel => (
              <div 
                key={hostel.id} 
                className={styles.hostelCard}
                onClick={() => router.push(`/hostels/${hostel.id}`)}
                style={{ cursor: 'pointer' }}
              >
                
                {/* Image Column */}
                <div className={styles.cardImageContainer}>
                  <img src={(hostel.images && hostel.images.length > 0) ? hostel.images[0] : (hostel.imageUrl || '/luxury_building.png')} alt={hostel.name} className={styles.cardImage} />
                  <div className={styles.photoBadge}>
                    <Camera size={12} />
                    <span>{(hostel.images?.length || 0) + 1} Photos</span>
                  </div>
                </div>

                {/* Info Column */}
                <div className={styles.cardInfo}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.hostelName}>{hostel.name || 'Unnamed Hostel'}</h3>
                    <button 
                      className={`${styles.bookmarkButton} ${bookmarked.includes(hostel.id) ? styles.bookmarked : ''}`}
                      onClick={() => toggleBookmark(hostel.id)}
                    >
                      <Bookmark size={20} fill={bookmarked.includes(hostel.id) ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <div className={styles.locationRow}>
                    <MapPin size={14} className={styles.locationIcon} />
                    <span className={styles.locationText}>{hostel.address || 'Address not specified'}</span>
                  </div>

                  <div className={styles.facilitiesRow}>
                    <div className={styles.facilityIcon}><Wifi size={14} /></div>
                    <div className={styles.facilityIcon}><Utensils size={14} /></div>
                    <div className={styles.facilityIcon}><AirVent size={14} /></div>
                    <div className={styles.facilityIcon}><WashingMachine size={14} /></div>
                    <div className={styles.facilityCount}>+{(hostel.amenities?.length || 0) + (hostel.facilities?.length || 0)}</div>
                  </div>

                  <div className={styles.cardFooter}>
                    <div className={styles.priceContainer}>
                      <span className={styles.priceAmount}>Contact us</span>
                      <span className={styles.priceSuffix}> for pricing</span>
                    </div>
                    
                    <a 
                      href={`tel:${hostel.phone}`} 
                      className={styles.callButton}
                      onClick={(e) => e.stopPropagation()} // Prevent card click
                    >
                      <PhoneCall size={20} />
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
      </main>
    </div>
  );
}
