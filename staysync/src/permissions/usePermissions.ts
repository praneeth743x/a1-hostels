import { useMemo, useCallback } from 'react';
import { TeamMemberPermissions, ALL_PERMISSIONS_GRANTED, NO_PERMISSIONS } from './permissions';
import { PermissionService } from './permissionService';

export interface UsePermissionsResult {
  role: string;
  staffRole: string;
  isOwner: boolean;
  isStaff: boolean;
  permissions: TeamMemberPermissions;
  propertyPermissions: Record<string, TeamMemberPermissions>;
  assignedProperties: string[];
  hasPermission: (key: keyof TeamMemberPermissions, pgId?: string) => boolean;
  hasAnyPermission: (keys: (keyof TeamMemberPermissions)[], pgId?: string) => boolean;
  hasAllPermissions: (keys: (keyof TeamMemberPermissions)[], pgId?: string) => boolean;
  hasPropertyAccess: (pgId: string) => boolean;
}

/**
 * Standard hook to derive permissions and helper methods from user profile state.
 * Supports per-property custom permissions overrides.
 */
export function usePermissionsFromProfile(userProfile: any): UsePermissionsResult {
  const role = userProfile?.role || '';
  const staffRole = userProfile?.staff_role || userProfile?.role || 'Staff';

  const isOwner = useMemo(() => {
    if (role === 'team_member') return false;
    return role === 'pg_owner' || role === 'owner' || role === 'super_admin';
  }, [role]);

  const isStaff = !isOwner && role === 'team_member';

  const permissions = useMemo<TeamMemberPermissions>(() => {
    if (isOwner) return ALL_PERMISSIONS_GRANTED;
    if (userProfile?.permissions) {
      return {
        ...NO_PERMISSIONS,
        ...userProfile.permissions
      };
    }
    return NO_PERMISSIONS;
  }, [isOwner, userProfile]);

  const propertyPermissions = useMemo<Record<string, TeamMemberPermissions>>(() => {
    return userProfile?.property_permissions || userProfile?.propertyPermissions || {};
  }, [userProfile]);

  const assignedProperties = useMemo<string[]>(() => {
    if (isOwner) return [];
    return userProfile?.assigned_properties || userProfile?.assignedProperties || [];
  }, [isOwner, userProfile]);

  const hasPermission = useCallback((key: keyof TeamMemberPermissions, pgId?: string): boolean => {
    return PermissionService.hasPermission(permissions, key, isOwner, pgId, propertyPermissions);
  }, [permissions, isOwner, propertyPermissions]);

  const hasAnyPermission = useCallback((keys: (keyof TeamMemberPermissions)[], pgId?: string): boolean => {
    return PermissionService.hasAnyPermission(permissions, keys, isOwner, pgId, propertyPermissions);
  }, [permissions, isOwner, propertyPermissions]);

  const hasAllPermissions = useCallback((keys: (keyof TeamMemberPermissions)[], pgId?: string): boolean => {
    return PermissionService.hasAllPermissions(permissions, keys, isOwner, pgId, propertyPermissions);
  }, [permissions, isOwner, propertyPermissions]);

  const hasPropertyAccess = useCallback((pgId: string): boolean => {
    return PermissionService.hasPropertyAccess(assignedProperties, pgId, isOwner);
  }, [assignedProperties, isOwner]);

  return {
    role,
    staffRole,
    isOwner,
    isStaff,
    permissions,
    propertyPermissions,
    assignedProperties,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasPropertyAccess
  };
}
