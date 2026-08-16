import { TeamMemberPermissions } from './permissions';

/**
 * Pure RBAC evaluation service.
 * Owner role bypasses all permission and property scoping checks.
 * Supports per-property specific permissions override.
 */
export const PermissionService = {
  hasPermission(
    permissions: TeamMemberPermissions | null | undefined,
    permissionKey: keyof TeamMemberPermissions,
    isOwner: boolean = false,
    pgId?: string,
    propertyPermissions?: Record<string, TeamMemberPermissions> | null
  ): boolean {
    if (isOwner) return true;
    if (pgId && propertyPermissions && propertyPermissions[pgId]) {
      return Boolean(propertyPermissions[pgId][permissionKey]);
    }
    if (!permissions) return false;
    return Boolean(permissions[permissionKey]);
  },

  hasAnyPermission(
    permissions: TeamMemberPermissions | null | undefined,
    keys: (keyof TeamMemberPermissions)[],
    isOwner: boolean = false,
    pgId?: string,
    propertyPermissions?: Record<string, TeamMemberPermissions> | null
  ): boolean {
    if (isOwner) return true;
    if (keys.length === 0) return false;
    if (pgId && propertyPermissions && propertyPermissions[pgId]) {
      return keys.some(key => Boolean(propertyPermissions[pgId][key]));
    }
    if (!permissions) return false;
    return keys.some(key => Boolean(permissions[key]));
  },

  hasAllPermissions(
    permissions: TeamMemberPermissions | null | undefined,
    keys: (keyof TeamMemberPermissions)[],
    isOwner: boolean = false,
    pgId?: string,
    propertyPermissions?: Record<string, TeamMemberPermissions> | null
  ): boolean {
    if (isOwner) return true;
    if (keys.length === 0) return false;
    if (pgId && propertyPermissions && propertyPermissions[pgId]) {
      return keys.every(key => Boolean(propertyPermissions[pgId][key]));
    }
    if (!permissions) return false;
    return keys.every(key => Boolean(permissions[key]));
  },

  hasPropertyAccess(
    assignedProperties: string[] | null | undefined,
    pgId: string,
    isOwner: boolean = false
  ): boolean {
    if (isOwner) return true;
    if (!assignedProperties || assignedProperties.length === 0) return true;
    return assignedProperties.includes(pgId);
  }
};
