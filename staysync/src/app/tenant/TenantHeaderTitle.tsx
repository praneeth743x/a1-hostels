"use client";

import React, { Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import styles from './tenant.module.css';

function HeaderTitleContent({ hostelName }: { hostelName: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const isNotifications = pathname.includes('/notifications');
  const activeTab = searchParams.get('tab') || 'Dashboard';
  
  let subtitle = 'Dashboard';
  if (isNotifications) subtitle = 'Notifications';
  else if (activeTab === 'Payments') subtitle = 'Payments';
  else if (activeTab === 'Notices') subtitle = 'Notices';
  else if (activeTab === 'Complaints') subtitle = 'Complaints';
  else if (activeTab === 'Profile') subtitle = 'Profile';
  else subtitle = 'Dashboard';

  return (
    <div className={styles.mobileHeaderTitleContainer}>
      <h1 className={styles.mobileHeaderTitle}>{hostelName}</h1>
      <span className={styles.mobileHeaderSubtitle} style={{ textTransform: 'uppercase' }}>
        {subtitle}
      </span>
    </div>
  );
}

export default function TenantHeaderTitle({ hostelName }: { hostelName: string }) {
  return (
    <Suspense fallback={
      <div className={styles.mobileHeaderTitleContainer}>
        <h1 className={styles.mobileHeaderTitle}>{hostelName}</h1>
        <span className={styles.mobileHeaderSubtitle}>...</span>
      </div>
    }>
      <HeaderTitleContent hostelName={hostelName} />
    </Suspense>
  );
}
