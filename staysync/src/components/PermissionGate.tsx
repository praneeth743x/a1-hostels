"use client";

import React from 'react';
import { usePermissions } from '@/context/HostelContext';
import { TeamMemberPermissions } from '@/constants/permissions';

interface PermissionGateProps {
  permission?: keyof TeamMemberPermissions;
  anyPermissions?: (keyof TeamMemberPermissions)[];
  allPermissions?: (keyof TeamMemberPermissions)[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Enterprise PermissionGate Component.
 * Conditionally renders UI elements (buttons, forms, actions) based on user permissions.
 * Owner role always passes.
 */
export default function PermissionGate({
  permission,
  anyPermissions,
  allPermissions,
  fallback = null,
  children
}: PermissionGateProps) {
  const { isOwner, hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  if (isOwner) {
    return <>{children}</>;
  }

  let allowed = true;

  if (permission) {
    allowed = allowed && hasPermission(permission);
  }

  if (anyPermissions && anyPermissions.length > 0) {
    allowed = allowed && hasAnyPermission(...anyPermissions);
  }

  if (allPermissions && allPermissions.length > 0) {
    allowed = allowed && hasAllPermissions(...allPermissions);
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
