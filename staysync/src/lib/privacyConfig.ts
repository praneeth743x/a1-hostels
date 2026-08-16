/**
 * DPDP-Ready Data Protection & Retention Architecture Configuration
 * Configurable data categories and retention rules for StaySync Hostel Management SaaS
 */

export interface RetentionPolicy {
  category: string;
  description: string;
  retentionDays: number | 'INDEFINITE_FOR_TENURE' | 'LEGAL_TAX_COMPLIANCE';
  autoDeleteAllowed: boolean;
  legalJustification: string;
}

export const DATA_RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  ACTIVE_TENANT_DATA: {
    category: 'Active Tenant Profile & Allocation',
    description: 'Name, phone, room allocation, check-in date during active stay',
    retentionDays: 'INDEFINITE_FOR_TENURE',
    autoDeleteAllowed: false,
    legalJustification: 'Required for active hostel occupancy agreement & service delivery'
  },
  INACTIVE_TENANT_DATA: {
    category: 'Vacated Tenant Records',
    description: 'Historical occupancy data after tenant vacates',
    retentionDays: 180, // Configurable retention for non-financial profile details
    autoDeleteAllowed: true,
    legalJustification: 'Operational grace period for exit settlement and reference verification'
  },
  FINANCIAL_AND_TAX_RECORDS: {
    category: 'Rent Ledger & Payment Receipts',
    description: 'Transaction IDs, payment dates, collected rent amounts, due history',
    retentionDays: 'LEGAL_TAX_COMPLIANCE', // Minimum 7 years under Indian IT / GST Acts
    autoDeleteAllowed: false,
    legalJustification: 'Statutory compliance for accounting, tax audits, legal dispute defense'
  },
  SECURITY_AUDIT_LOGS: {
    category: 'Authentication & Access Logs',
    description: 'Device registrations, login timestamps, data modification audit trails',
    retentionDays: 365,
    autoDeleteAllowed: true,
    legalJustification: 'Platform security monitoring and fraud prevention'
  },
  PRIVACY_REQUESTS_AND_GRIEVANCES: {
    category: 'Data Subject Requests & Grievances',
    description: 'Data correction requests, deletion requests, privacy grievances',
    retentionDays: 1095, // 3 years
    autoDeleteAllowed: false,
    legalJustification: 'Compliance recordkeeping under Data Protection regulations'
  }
};

export const DPDP_ROLES_CONFIG = {
  dataFiduciary: {
    roleName: 'Data Fiduciary / Data Controller',
    entity: 'Hostel Owner / Management',
    responsibilities: [
      'Determines the purpose and means of collecting tenant information for hostel stay.',
      'Responsible for onboarding tenants and entering accurate occupancy details.',
      'Reviews and resolves tenant data correction and deletion requests.'
    ]
  },
  dataProcessor: {
    roleName: 'Data Processor / SaaS Service Provider',
    entity: 'StaySync SaaS Platform',
    responsibilities: [
      'Provides cloud infrastructure and software functionality for hostel management.',
      'Processes tenant data strictly on behalf of and per the instructions of the Hostel Management.',
      'Maintains technical and organizational security measures, encryption, and RBAC isolation.'
    ]
  }
};
