"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminOverview() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/superadmin/owners');
  }, [router]);

  return null;
}
