/**
 * Central Meta WhatsApp Platform Configuration & Dynamic Template Mappings
 * Ensures credentials and template identifiers are managed securely and dynamically.
 */

export const WHATSAPP_CONFIG = {
  get GRAPH_API_VERSION() {
    return process.env.GRAPH_API_VERSION || 'v23.0';
  },
  get PHONE_NUMBER_ID() {
    return process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || '1287108487825173';
  },
  get WABA_ID() {
    return process.env.META_WABA_ID || process.env.WABA_ID || '1738836117398955';
  },
  get ACCESS_TOKEN() {
    return process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || 'EAAWkafagEg8BSXZBxOPmZA2sm4dtDYAvfCFrLCugZC48fAyNwvo4quzrj7O2D0qwPDmwy6vsq1cVu6TRs3LlRCAFPCCPtau9pRIH3fqQC3aKJuiumzozplPVTykwyYTaWIolKOfKSU2iqZB1vI88HrNR6ab8GvHe99azB58tLDhJYRgBSOh8J1RUjFAtyqE3jQZDZD';
  },
  get META_APP_ID() {
    return process.env.META_APP_ID || '';
  },
  get META_APP_SECRET() {
    return process.env.META_APP_SECRET || '';
  },
  get VERIFY_TOKEN() {
    return process.env.META_VERIFY_TOKEN || process.env.VERIFY_TOKEN || 'staysync_whatsapp_verify_token_2026';
  },
  
  // Dynamic Template Configurations (Overridable via Environment Variables)
  TEMPLATES: {
    get WELCOME() { return process.env.WA_TEMPLATE_WELCOME || 'tenant_welcome_v1'; },
    get DUE_REMINDER() { return process.env.WA_TEMPLATE_DUE_REMINDER || 'due_day_reminderv1'; },
    get OVERDUE_REMINDER() { return process.env.WA_TEMPLATE_OVERDUE_REMINDER || 'overdue_v1'; },
    get PAYMENT_CONFIRMATION() { return process.env.WA_TEMPLATE_PAYMENT_CONFIRMATION || 'payment_confirmation_v1'; },
    get CUSTOM_REMINDER() { return process.env.WA_TEMPLATE_CUSTOM_REMINDER || 'general_tenant_notice'; },
    SANDBOX_FALLBACK: 'hello_world'
  },
  DEFAULT_LANGUAGE: 'en',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000
};

export interface WhatsAppLogEntry {
  id?: string;
  tenantId?: string;
  tenantName?: string;
  phoneNumber: string;
  templateName: string;
  language: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  messageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedReason?: string;
  triggeredBy?: string;
  createdAt: string;
  payload?: any;
}
