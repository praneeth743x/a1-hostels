import { adminDb } from '@/lib/firebase-admin';

export type AuditAction =
  | 'TENANT_CREATED'
  | 'TENANT_UPDATED'
  | 'TENANT_DEACTIVATED'
  | 'TENANT_DATA_ACCESSED'
  | 'PAYMENT_RECORD_MODIFIED'
  | 'DATA_CORRECTION_REQUESTED'
  | 'DATA_DELETION_REQUESTED'
  | 'PRIVACY_GRIEVANCE_RAISED'
  | 'PRIVACY_REQUEST_REVIEWED'
  | 'PRIVACY_GRIEVANCE_RESOLVED'
  | 'SENSITIVE_DATA_DELETED';

export interface AuditLogEntry {
  actor_id: string;
  actor_role: string;
  pg_id?: string;
  target_id?: string;
  action: AuditAction;
  timestamp: string;
  metadata?: Record<string, any>;
}

export async function logAuditEvent(
  actorId: string,
  actorRole: string,
  action: AuditAction,
  targetId?: string,
  pgId?: string,
  metadata?: Record<string, any>
) {
  try {
    const logRef = adminDb.collection('audit_logs').doc();
    
    // Sanitize metadata to NEVER store passwords, secrets, or PINs
    const sanitizedMetadata = { ...metadata };
    delete sanitizedMetadata.password;
    delete sanitizedMetadata.upi_pin;
    delete sanitizedMetadata.cvv;
    delete sanitizedMetadata.secret;

    const logData: AuditLogEntry = {
      actor_id: actorId || 'SYSTEM',
      actor_role: actorRole || 'system',
      pg_id: pgId || 'N/A',
      target_id: targetId || 'N/A',
      action,
      timestamp: new Date().toISOString(),
      metadata: sanitizedMetadata
    };

    await logRef.set(logData);
    return { success: true, logId: logRef.id };
  } catch (err: any) {
    console.error('[AUDIT LOG ERROR] Failed to record audit log:', err);
    return { success: false, error: err.message };
  }
}
