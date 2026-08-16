"use server";

import { adminDb } from '@/lib/firebase-admin';
import { logAuditEvent } from '@/lib/auditLogger';

export async function createPrivacyRequest(
  tenantUid: string,
  pgId: string,
  requestType: 'correction' | 'deletion',
  requestedFields?: string,
  reason?: string
) {
  try {
    if (!tenantUid) {
      return { success: false, error: 'Tenant UID is required.' };
    }

    const requestRef = adminDb.collection('privacy_requests').doc();
    const requestId = requestRef.id;

    const requestDoc = {
      request_id: requestId,
      tenant_id: tenantUid,
      pg_id: pgId || 'N/A',
      requested_date: new Date().toISOString(),
      type: requestType,
      status: 'Pending',
      requested_fields: requestedFields || '',
      reason: reason || '',
      reviewed_by: '',
      reviewed_date: '',
      resolution_notes: ''
    };

    await requestRef.set(requestDoc);

    const auditAction = requestType === 'deletion' ? 'DATA_DELETION_REQUESTED' : 'DATA_CORRECTION_REQUESTED';
    await logAuditEvent(tenantUid, 'tenant', auditAction, requestId, pgId, { requestType, requestedFields, reason });

    return { success: true, data: requestId };
  } catch (err: any) {
    console.error('[PRIVACY ACTION ERROR] createPrivacyRequest failed:', err);
    return { success: false, error: err.message };
  }
}

export async function getTenantPrivacyRequests(tenantUid: string) {
  try {
    if (!tenantUid) {
      return { success: false, error: 'Tenant UID is required.' };
    }

    const [requestsSnap, grievancesSnap] = await Promise.all([
      adminDb.collection('privacy_requests').where('tenant_id', '==', tenantUid).get(),
      adminDb.collection('privacy_grievances').where('tenant_id', '==', tenantUid).get()
    ]);

    const requests = requestsSnap.docs.map(doc => doc.data());
    const grievances = grievancesSnap.docs.map(doc => doc.data());

    requests.sort((a: any, b: any) => new Date(b.requested_date || 0).getTime() - new Date(a.requested_date || 0).getTime());
    grievances.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return {
      success: true,
      data: { requests, grievances }
    };
  } catch (err: any) {
    console.error('[PRIVACY ACTION ERROR] getTenantPrivacyRequests failed:', err);
    return { success: false, error: err.message };
  }
}

export async function createPrivacyGrievance(
  tenantUid: string,
  pgId: string,
  subject: string,
  description: string,
  relatedType?: string
) {
  try {
    if (!tenantUid || !subject || !description) {
      return { success: false, error: 'Tenant UID, subject, and description are required.' };
    }

    const grievanceRef = adminDb.collection('privacy_grievances').doc();
    const grievanceId = grievanceRef.id;

    const grievanceDoc = {
      grievance_id: grievanceId,
      tenant_id: tenantUid,
      pg_id: pgId || 'N/A',
      created_at: new Date().toISOString(),
      status: 'Open',
      subject: subject.trim(),
      description: description.trim(),
      related_data_type: relatedType || 'General Privacy',
      assigned_admin: '',
      resolution: '',
      resolved_timestamp: ''
    };

    await grievanceRef.set(grievanceDoc);

    await logAuditEvent(tenantUid, 'tenant', 'PRIVACY_GRIEVANCE_RAISED', grievanceId, pgId, { subject, relatedType });

    return { success: true, data: grievanceId };
  } catch (err: any) {
    console.error('[PRIVACY ACTION ERROR] createPrivacyGrievance failed:', err);
    return { success: false, error: err.message };
  }
}

export async function getOwnerPrivacyRequests(ownerUid: string, pgId: string) {
  try {
    if (!ownerUid) {
      return { success: false, error: 'Owner UID is required.' };
    }

    let reqQuery = adminDb.collection('privacy_requests').where('pg_id', '==', pgId);
    let grvQuery = adminDb.collection('privacy_grievances').where('pg_id', '==', pgId);

    // If pgId is 'all' or empty, query by owner's hostels
    if (!pgId || pgId === 'all') {
      const hostelsSnap = await adminDb.collection('properties').where('owner_id', '==', ownerUid).get();
      const pgIds = hostelsSnap.docs.map(d => d.id);

      if (pgIds.length === 0) {
        return { success: true, data: { requests: [], grievances: [] } };
      }

      reqQuery = adminDb.collection('privacy_requests').where('pg_id', 'in', pgIds.slice(0, 10));
      grvQuery = adminDb.collection('privacy_grievances').where('pg_id', 'in', pgIds.slice(0, 10));
    }

    const [requestsSnap, grievancesSnap] = await Promise.all([
      reqQuery.get(),
      grvQuery.get()
    ]);

    const requests = requestsSnap.docs.map(doc => doc.data());
    const grievances = grievancesSnap.docs.map(doc => doc.data());

    requests.sort((a: any, b: any) => new Date(b.requested_date || 0).getTime() - new Date(a.requested_date || 0).getTime());
    grievances.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return {
      success: true,
      data: { requests, grievances }
    };
  } catch (err: any) {
    console.error('[PRIVACY ACTION ERROR] getOwnerPrivacyRequests failed:', err);
    return { success: false, error: err.message };
  }
}

export async function updatePrivacyRequestStatus(
  ownerUid: string,
  requestId: string,
  status: string,
  resolutionNotes?: string
) {
  try {
    if (!ownerUid || !requestId || !status) {
      return { success: false, error: 'Missing required parameters.' };
    }

    const reqRef = adminDb.collection('privacy_requests').doc(requestId);
    const snap = await reqRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Request not found.' };
    }

    const updateData: any = {
      status,
      reviewed_by: ownerUid,
      reviewed_date: new Date().toISOString(),
      resolution_notes: resolutionNotes || ''
    };

    await reqRef.update(updateData);

    const docData = snap.data();
    await logAuditEvent(ownerUid, 'owner', 'PRIVACY_REQUEST_REVIEWED', requestId, docData?.pg_id, { status, resolutionNotes });

    return { success: true };
  } catch (err: any) {
    console.error('[PRIVACY ACTION ERROR] updatePrivacyRequestStatus failed:', err);
    return { success: false, error: err.message };
  }
}

export async function updatePrivacyGrievanceStatus(
  ownerUid: string,
  grievanceId: string,
  status: string,
  resolutionNotes?: string
) {
  try {
    if (!ownerUid || !grievanceId || !status) {
      return { success: false, error: 'Missing required parameters.' };
    }

    const grvRef = adminDb.collection('privacy_grievances').doc(grievanceId);
    const snap = await grvRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Grievance not found.' };
    }

    const updateData: any = {
      status,
      assigned_admin: ownerUid,
      resolution: resolutionNotes || '',
      resolved_timestamp: status === 'Resolved' ? new Date().toISOString() : ''
    };

    await grvRef.update(updateData);

    const docData = snap.data();
    await logAuditEvent(ownerUid, 'owner', 'PRIVACY_GRIEVANCE_RESOLVED', grievanceId, docData?.pg_id, { status, resolutionNotes });

    return { success: true };
  } catch (err: any) {
    console.error('[PRIVACY ACTION ERROR] updatePrivacyGrievanceStatus failed:', err);
    return { success: false, error: err.message };
  }
}
