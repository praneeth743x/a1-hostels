"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useParams } from 'next/navigation';
import { rpcCall } from '@/lib/rpc';
import { 
  ArrowLeft, MapPin, Phone, Navigation, Building, BedDouble, Shield, 
  Sparkles, CheckCircle2, DollarSign, Calendar, Mail, Compass, HelpCircle
} from 'lucide-react';
import styles from './hostel-detail.module.css';

interface HostelDetails {
  id: string;
  name: string;
  address: string;
  locationLink: string;
  description: string;
  imageUrl: string;
  images: string[];
  amenities: string[];
  facilities: string[];
  gender: string;
  totalRooms: number;
  pgId: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  pricing: Record<number, string>;
}

export default function HostelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [hostel, setHostel] = useState<HostelDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    rpcCall('getPublicHostelById', id).then((res: any) => {
      if (res.success && res.data) {
        setHostel(res.data);
      } else {
        setError(res.error || 'Failed to load hostel details.');
      }
      setLoading(false);
    }).catch(err => {
      setError(err.message || 'An error occurred.');
      setLoading(false);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      });
    }
  }, [id]);

  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const getDistanceString = () => {
    if (!userLocation || !hostel || hostel.lat === null || hostel.lng === null) return null;
    const dist = haversineKm(userLocation.lat, userLocation.lng, hostel.lat, hostel.lng);
    return dist < 1 ? `${Math.round(dist * 1000)} meters` : `${dist.toFixed(1)} km`;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Fetching premium living space details...</p>
      </div>
    );
  }

  if (error || !hostel) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <span style={{ fontSize: '3rem' }}>🧐</span>
          <h3>Property Not Found</h3>
          <p>{error || 'The requested property could not be loaded.'}</p>
          <button onClick={() => router.push('/')} className={styles.backBtn}>
            <ArrowLeft size={16} /> Back to Discover
          </button>
        </div>
      </div>
    );
  }

  const imgList = (hostel.images && hostel.images.length > 0) ? hostel.images : [hostel.imageUrl || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80'];

  const sharingLabels: Record<number, string> = {
    1: 'Single Sharing',
    2: 'Double Sharing',
    3: 'Triple Sharing',
    4: 'Four Sharing',
    5: 'Five Sharing',
    6: 'Six Sharing'
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Dynamic Background Aurora */}
      <div className={styles.bgAurora1}></div>
      <div className={styles.bgAurora2}></div>

      {/* Header Bar */}
      <header className={styles.navHeader}>
        <button onClick={() => router.push('/')} className={styles.navBackBtn}>
          <ArrowLeft size={18} />
          <span>Discover Hostels</span>
        </button>
        <div className={styles.brandTitle}>Himalaya Hostels</div>
      </header>

      <main className={styles.mainContent}>
        {/* TOP PANEL: Images & Quick info */}
        <div className={styles.topPanelGrid}>
          {/* IMAGE CAROUSEL SECTION */}
          <div className={styles.mediaContainer}>
            <div className={styles.mainImageWrap}>
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImgIdx}
                  src={imgList[currentImgIdx]}
                  alt={hostel.name}
                  className={styles.mainImg}
                  initial={{ opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.4 }}
                />
              </AnimatePresence>

              {/* Navigation overlays */}
              {imgList.length > 1 && (
                <>
                  <button 
                    onClick={() => setCurrentImgIdx((currentImgIdx - 1 + imgList.length) % imgList.length)}
                    className={`${styles.carouselArrow} ${styles.arrowLeft}`}
                  >
                    ‹
                  </button>
                  <button 
                    onClick={() => setCurrentImgIdx((currentImgIdx + 1) % imgList.length)}
                    className={`${styles.carouselArrow} ${styles.arrowRight}`}
                  >
                    ›
                  </button>
                </>
              )}

              {/* Distance badge */}
              {getDistanceString() && (
                <div className={styles.distanceBadge}>
                  📍 {getDistanceString()} away from you
                </div>
              )}

              {/* Gender badge */}
              {hostel.gender && (
                <div className={styles.genderBadge}>
                  {hostel.gender.toLowerCase().includes('girl') || hostel.gender.toLowerCase().includes('female')
                    ? '👩 Girls Only'
                    : hostel.gender.toLowerCase().includes('boy') || hostel.gender.toLowerCase().includes('male')
                    ? '👦 Boys Only'
                    : hostel.gender}
                </div>
              )}
            </div>

            {/* Thumbnail dots/previews */}
            {imgList.length > 1 && (
              <div className={styles.thumbContainer}>
                {imgList.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setCurrentImgIdx(idx)}
                    className={`${styles.thumbWrap} ${idx === currentImgIdx ? styles.thumbActive : ''}`}
                  >
                    <img src={img} alt={`Preview ${idx + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* QUICK INFO SIDE PANEL */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <div className={styles.sectionBadge}>
                <Sparkles size={12} />
                <span>PREMIUM LIVING</span>
              </div>
              <h1 className={styles.hostelTitle}>{hostel.name}</h1>
              <p className={styles.hostelAddress}>
                <MapPin size={16} color="#B45309" />
                <span>{hostel.address}</span>
              </p>
            </div>

            {hostel.description && (
              <div className={styles.descSection}>
                <h3>About Property</h3>
                <p>{hostel.description}</p>
              </div>
            )}

            <div className={styles.actionSection}>
              {/* Call */}
              {hostel.phone && (
                <a href={`tel:${hostel.phone}`} className={styles.callButton}>
                  <Phone size={16} />
                  <span>Call Hostel Support</span>
                </a>
              )}

              {/* Get Directions */}
              <a
                href={
                  hostel.lat && hostel.lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${hostel.lat},${hostel.lng}`
                    : hostel.locationLink
                    ? hostel.locationLink
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hostel.name + ' ' + hostel.address)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className={styles.directionsButton}
              >
                <Navigation size={16} />
                <span>Get Directions</span>
              </a>

              {/* Book Now via WhatsApp */}
              <a
                href={(() => {
                  const rawPhone = hostel.phone || '';
                  let cleaned = rawPhone.replace(/\D/g, '');
                  if (cleaned.length === 10) {
                    cleaned = '91' + cleaned;
                  }
                  const msg = `Hello, I would like to book a visit or join your hostel: *${hostel.name}* located at *${hostel.address}*. Please let me know the availability.`;
                  return `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.bookButton}
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span>Connect on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        {/* BOTTOM PANEL: Facilities */}
        <div className={styles.facilitiesFullWidth}>
          {/* FACILITIES PANEL */}
          <div className={styles.detailsCard}>
            <h2 className={styles.detailsCardTitle}>🏨 Selected Facilities &amp; Amenities</h2>
            {hostel.facilities && hostel.facilities.length > 0 ? (
              <div className={styles.facilitiesContainer}>
                {hostel.facilities.map((fac, idx) => (
                  <motion.div 
                    key={idx} 
                    className={styles.facilityItem}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <CheckCircle2 size={16} className={styles.checkIcon} />
                    <span>{fac}</span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyDetails}>
                <span>📝</span>
                <p>No special facilities listed for this hostel. Contact the owner for info.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.pageFooter}>
        <div className={styles.footerInner}>
          <div>Himalaya Hostels Premium Student &amp; Professional Hostels</div>
          <p>© 2026 Himalaya Hostels Platform. High Class Hospitality Guaranteed.</p>
        </div>
      </footer>
    </div>
  );
}
