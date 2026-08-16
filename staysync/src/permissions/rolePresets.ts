import { TeamMemberPermissions, ALL_PERMISSIONS_GRANTED, NO_PERMISSIONS } from './permissions';
import type { Role, StandardRole } from '@/types/roles';

export const ROLE_PRESETS: Record<string, TeamMemberPermissions> = {
  Manager: {
    viewDashboard: true, viewTenants: true, manageTenants: true, addTenant: true, editTenant: true, deleteTenant: false,
    viewRooms: true, manageRooms: true, deleteRooms: false, resolveComplaints: true, editMenu: true, viewReports: true, exportReports: true,
    addExpense: true, deleteExpense: false, sendWhatsAppMessages: true, approveTemplates: false,
    createNotices: true, deleteNotices: true, generateDues: true, collectPayments: true, printReceipts: true,
    viewHistory: true, deleteHistory: false, viewMembers: true, manageMembers: false, manageProperty: false
  },
  Accountant: {
    viewDashboard: true, viewTenants: true, manageTenants: false, addTenant: false, editTenant: false, deleteTenant: false,
    viewRooms: false, manageRooms: false, resolveComplaints: false, editMenu: false, viewReports: true, exportReports: true,
    addExpense: true, deleteExpense: true, sendWhatsAppMessages: true, approveTemplates: false,
    createNotices: false, deleteNotices: false, generateDues: true, collectPayments: true, printReceipts: true,
    viewHistory: true, deleteHistory: false, viewMembers: false, manageMembers: false, manageProperty: false
  },
  Receptionist: {
    viewDashboard: true, viewTenants: true, manageTenants: true, addTenant: true, editTenant: true, deleteTenant: false,
    viewRooms: true, manageRooms: true, deleteRooms: false, resolveComplaints: true, editMenu: false, viewReports: false, exportReports: false,
    addExpense: false, deleteExpense: false, sendWhatsAppMessages: true, approveTemplates: false,
    createNotices: true, deleteNotices: false, generateDues: true, collectPayments: true, printReceipts: true,
    viewHistory: true, deleteHistory: false, viewMembers: false, manageMembers: false, manageProperty: false
  },
  Maintenance: {
    viewDashboard: false, viewTenants: false, manageTenants: false, addTenant: false, editTenant: false, deleteTenant: false,
    viewRooms: true, manageRooms: true, deleteRooms: false, resolveComplaints: true, editMenu: false, viewReports: false, exportReports: false,
    addExpense: false, deleteExpense: false, sendWhatsAppMessages: false, approveTemplates: false,
    createNotices: false, deleteNotices: false, generateDues: false, collectPayments: false, printReceipts: false,
    viewHistory: false, deleteHistory: false, viewMembers: false, manageMembers: false, manageProperty: false
  },
  Security: {
    viewDashboard: false, viewTenants: false, manageTenants: false, addTenant: false, editTenant: false, deleteTenant: false,
    viewRooms: true, manageRooms: false, resolveComplaints: true, editMenu: false, viewReports: false, exportReports: false,
    addExpense: false, deleteExpense: false, sendWhatsAppMessages: false, approveTemplates: false,
    createNotices: false, deleteNotices: false, generateDues: false, collectPayments: false, printReceipts: false,
    viewHistory: false, deleteHistory: false, viewMembers: false, manageMembers: false, manageProperty: false
  },
  Cleaner: {
    viewDashboard: false, viewTenants: false, manageTenants: false, addTenant: false, editTenant: false, deleteTenant: false,
    viewRooms: true, manageRooms: true, deleteRooms: false, resolveComplaints: true, editMenu: false, viewReports: false, exportReports: false,
    addExpense: false, deleteExpense: false, sendWhatsAppMessages: false, approveTemplates: false,
    createNotices: false, deleteNotices: false, generateDues: false, collectPayments: false, printReceipts: false,
    viewHistory: false, deleteHistory: false, viewMembers: false, manageMembers: false, manageProperty: false
  }
};

export function getDefaultPermissionsForRole(role: Role | string): TeamMemberPermissions {
  if (role === 'Owner' || role === 'pg_owner' || role === 'super_admin') {
    return ALL_PERMISSIONS_GRANTED;
  }
  return ROLE_PRESETS[role as string] || {
    ...NO_PERMISSIONS,
    viewDashboard: true,
    resolveComplaints: true,
  };
}
