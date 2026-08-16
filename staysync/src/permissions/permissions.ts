export const PERMISSIONS = {
  VIEW_DASHBOARD: "viewDashboard",
  VIEW_TENANTS: "viewTenants",
  MANAGE_TENANTS: "manageTenants",
  ADD_TENANT: "addTenant",
  EDIT_TENANT: "editTenant",
  DELETE_TENANT: "deleteTenant",
  VIEW_ROOMS: "viewRooms",
  MANAGE_ROOMS: "manageRooms",
  DELETE_ROOMS: "deleteRooms",
  RESOLVE_COMPLAINTS: "resolveComplaints",
  EDIT_MENU: "editMenu",
  VIEW_REPORTS: "viewReports",
  EXPORT_REPORTS: "exportReports",
  ADD_EXPENSE: "addExpense",
  DELETE_EXPENSE: "deleteExpense",
  SEND_WHATSAPP: "sendWhatsAppMessages",
  APPROVE_TEMPLATES: "approveTemplates",
  CREATE_NOTICES: "createNotices",
  DELETE_NOTICES: "deleteNotices",
  GENERATE_DUES: "generateDues",
  COLLECT_PAYMENTS: "collectPayments",
  PRINT_RECEIPTS: "printReceipts",
  VIEW_HISTORY: "viewHistory",
  DELETE_HISTORY: "deleteHistory",
  VIEW_MEMBERS: "viewMembers",
  MANAGE_MEMBERS: "manageMembers",
  MANAGE_PROPERTY: "manageProperty",
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export const PermissionKey = {};

export interface TeamMemberPermissions {
  viewDashboard?: boolean;
  viewTenants?: boolean;
  manageTenants?: boolean;
  addTenant?: boolean;
  editTenant?: boolean;
  deleteTenant?: boolean;
  viewRooms?: boolean;
  manageRooms?: boolean;
  deleteRooms?: boolean;
  resolveComplaints?: boolean;
  editMenu?: boolean;
  viewReports?: boolean;
  exportReports?: boolean;
  addExpense?: boolean;
  deleteExpense?: boolean;
  sendWhatsAppMessages?: boolean;
  approveTemplates?: boolean;
  createNotices?: boolean;
  deleteNotices?: boolean;
  generateDues?: boolean;
  collectPayments?: boolean;
  printReceipts?: boolean;
  viewHistory?: boolean;
  deleteHistory?: boolean;
  viewMembers?: boolean;
  manageMembers?: boolean;
  manageProperty?: boolean;
}

export const TeamMemberPermissions = {};

export const ALL_PERMISSIONS_GRANTED: TeamMemberPermissions = {
  viewDashboard: true,
  viewTenants: true,
  manageTenants: true,
  addTenant: true,
  editTenant: true,
  deleteTenant: true,
  viewRooms: true,
  manageRooms: true,
  deleteRooms: true,
  resolveComplaints: true,
  editMenu: true,
  viewReports: true,
  exportReports: true,
  addExpense: true,
  deleteExpense: true,
  sendWhatsAppMessages: true,
  approveTemplates: true,
  createNotices: true,
  deleteNotices: true,
  generateDues: true,
  collectPayments: true,
  printReceipts: true,
  viewHistory: true,
  deleteHistory: true,
  viewMembers: true,
  manageMembers: true,
  manageProperty: true,
};

export const NO_PERMISSIONS: TeamMemberPermissions = {
  viewDashboard: false,
  viewTenants: false,
  manageTenants: false,
  addTenant: false,
  editTenant: false,
  deleteTenant: false,
  viewRooms: false,
  manageRooms: false,
  deleteRooms: false,
  resolveComplaints: false,
  editMenu: false,
  viewReports: false,
  exportReports: false,
  addExpense: false,
  deleteExpense: false,
  sendWhatsAppMessages: false,
  approveTemplates: false,
  createNotices: false,
  deleteNotices: false,
  generateDues: false,
  collectPayments: false,
  printReceipts: false,
  viewHistory: false,
  deleteHistory: false,
  viewMembers: false,
  manageMembers: false,
  manageProperty: false,
};
