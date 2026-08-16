export type StandardRole = 'Owner' | 'Manager' | 'Accountant' | 'Receptionist' | 'Maintenance' | 'Security' | 'Cleaner';
export type ExtendedRole = StandardRole | 'Custom Role' | 'pg_owner' | 'super_admin' | 'team_member' | (string & {});
export type Role = ExtendedRole;

export const STANDARD_ROLES: StandardRole[] = [
  'Owner',
  'Manager',
  'Accountant',
  'Receptionist',
  'Maintenance',
  'Security',
  'Cleaner',
];
