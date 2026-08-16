"use server";

import { adminDb } from '@/lib/firebase-admin';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';
import { isTenantActiveForBusiness } from '@/lib/repository';

async function cleanupOldComplaints(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const validComplaints: any[] = [];
  const batch = adminDb.batch();
  let hasDeletes = false;

  for (const doc of docs) {
    const data = doc.data();
    const createdAt = new Date(data.created_at || 0).getTime();
    if (now - createdAt > THIRTY_DAYS_MS) {
      batch.delete(doc.ref);
      hasDeletes = true;
    } else {
      validComplaints.push({ id: doc.id, ...data });
    }
  }

  if (hasDeletes) {
    try {
      await batch.commit();
      console.log("Auto-deleted complaints older than 2 weeks.");
    } catch (e) {
      console.error("Failed to delete old complaints:", e);
    }
  }

  return validComplaints;
}

export async function submitComplaint(data: {
  tenantId: string;
  tenantEmail: string;
  category: string;
  description: string;
  urgency: string;
}) {
  try {
    // Fetch tenant details to attach pg_id, owner_id, room_number, and name
    const tenantQuery = await adminDb.collection('tenants').where('email', '==', data.tenantEmail).get();
    if (tenantQuery.empty) {
      return { success: false, error: 'Tenant not found.' };
    }
    const tenantDoc = tenantQuery.docs[0];
    const tenantData = tenantDoc.data();

    let ownerId = tenantData.owner_id;
    let pgName = tenantData.pg_name;

    // Try fetching from properties document if missing
    if ((!ownerId || !pgName) && tenantData.pg_id) {
      const pgDoc = await adminDb.collection('properties').doc(tenantData.pg_id).get();
      if (pgDoc.exists) {
        const pgData = pgDoc.data();
        ownerId = ownerId || pgData?.owner_id;
        pgName = pgName || pgData?.name;
      }
    }

    const complaintData = {
      tenant_id: tenantData.tenant_id || tenantDoc.id,
      tenant_name: tenantData.full_name || 'Unknown Tenant',
      tenant_email: data.tenantEmail,
      tenant_phone: tenantData.mobile || tenantData.phone || tenantData.phone_number || '',
      room_number: tenantData.room_number || tenantData.room?.room_number || 'Unassigned',
      pg_id: tenantData.pg_id || '',
      pg_name: pgName || 'Unknown Hostel',
      owner_id: ownerId || '',
      category: data.category,
      description: data.description,
      urgency: data.urgency,
      status: 'pending',
      messages: [{
        sender: 'tenant',
        sender_name: tenantData.full_name || 'Tenant',
        message: data.description,
        timestamp: new Date().toISOString()
      }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newDoc = await adminDb.collection('complaints').add(complaintData);

    return { success: true, id: newDoc.id };
  } catch (error: any) {
    console.error("Error submitting complaint:", error);
    return { success: false, error: error.message };
  }
}

export async function getTenantComplaints(email: string) {
  try {
    const [qEmail, qTenantId] = await Promise.all([
      adminDb.collection('complaints').where('tenant_email', '==', email).get(),
      adminDb.collection('complaints').where('tenant_id', '==', email).get()
    ]);
    
    const docMap = new Map<string, any>();
    qEmail.docs.forEach(doc => docMap.set(doc.id, doc));
    qTenantId.docs.forEach(doc => docMap.set(doc.id, doc));

    const complaints = await cleanupOldComplaints(Array.from(docMap.values()));
    // Sort by created_at descending
    complaints.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return { success: true, data: complaints };
  } catch (error: any) {
    console.error("Error fetching tenant complaints:", error);
    return { success: false, error: error.message };
  }
}

export async function getOwnerComplaints(userId: string, pgId?: string) {
  try {
    const { resolveEffectiveOwnerId } = await import('@/app/actions/pgowner');
    const { getActiveHostels } = await import('@/lib/repository');
    const { ownerId } = await resolveEffectiveOwnerId(userId);

    const activeHostels = await getActiveHostels(ownerId);
    if (!activeHostels || activeHostels.length === 0) {
      return { success: true, data: [] };
    }

    const activePgIds = new Set(activeHostels.map((h: any) => h.pg_id || h.id));

    let baseQuery: FirebaseFirestore.Query = adminDb.collection('complaints').where('owner_id', '==', ownerId);
    if (pgId && pgId !== 'all' && activePgIds.has(pgId)) {
      baseQuery = baseQuery.where('pg_id', '==', pgId);
    }

    const [complaintsQuery, emptyOwnerSnap, tenantsQuery] = await Promise.all([
      baseQuery.get(),
      adminDb.collection('complaints').where('owner_id', '==', '').get(),
      adminDb.collection('tenants').where('owner_id', '==', ownerId).get()
    ]);

    const tenantMap = new Map<string, any>();
    const ownerTenantPhones = new Set<string>();
    const ownerTenantEmails = new Set<string>();

    tenantsQuery.docs.forEach(doc => {
      const data = doc.data();
      const s = String(data.status || '').toUpperCase();
      if (s === 'DELETED' || data.is_active === false) return;

      const key = data.tenant_id || data.email || doc.id;
      tenantMap.set(key.toLowerCase(), data);
      if (data.email) {
        tenantMap.set(data.email.toLowerCase(), data);
        ownerTenantEmails.add(data.email.toLowerCase());
      }
      if (data.full_name) tenantMap.set(data.full_name.toLowerCase(), data);
      if (data.name) tenantMap.set(data.name.toLowerCase(), data);

      const fields = [data.mobile, data.phone, data.phone_number, data.tenant_phone];
      fields.forEach(f => {
        if (f && typeof f === 'string') {
          const p10 = f.replace(/\D/g, '').slice(-10);
          if (p10.length === 10) ownerTenantPhones.add(p10);
        }
      });
    });

    const docMap = new Map<string, any>();
    complaintsQuery.docs.forEach(doc => docMap.set(doc.id, doc));

    // Match empty owner complaints against owner's tenants
    emptyOwnerSnap.docs.forEach(doc => {
      const data = doc.data();
      const cEmail = (data.tenant_email || '').toLowerCase();
      const cPhone10 = (data.tenant_phone || data.phone || '').replace(/\D/g, '').slice(-10);

      if ((cEmail && ownerTenantEmails.has(cEmail)) || (cPhone10 && ownerTenantPhones.has(cPhone10))) {
        docMap.set(doc.id, doc);
        // Backfill owner_id in background
        doc.ref.update({ owner_id: ownerId }).catch(() => {});
      }
    });

    const rawComplaints = await cleanupOldComplaints(Array.from(docMap.values()));

    const complaints = rawComplaints
      .filter(c => {
        if (!c) return false;
        const s = String(c.status || '').toUpperCase();
        if (s === 'DELETED' || c.is_active === false) return false;
        return c.pg_id ? activePgIds.has(c.pg_id) : true;
      })
      .map(c => {
        const tenant = tenantMap.get((c.tenant_id || '').toLowerCase()) || 
                       tenantMap.get((c.tenant_email || '').toLowerCase()) || 
                       tenantMap.get((c.tenant_name || '').toLowerCase()) || {};

        return {
          id: c.id,
          ...c,
          pg_name: c.pg_name || tenant.pg_name || 'Hostel',
          room_number: c.room_number || tenant.room_number || tenant.room || 'Unassigned',
          facePicture: tenant.face_picture || tenant.facePicture || tenant.photo_url || null
        };
      });

    // Sort by created_at descending
    complaints.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return { success: true, data: complaints };
  } catch (error: any) {
    console.error("Error fetching owner complaints:", error);
    return { success: false, error: error.message };
  }
}

export async function updateComplaintStatus(complaintId: string, status: string, comment?: string, notifyWhatsApp: boolean = true) {
  try {
    const docRef = adminDb.collection('complaints').doc(complaintId);
    const snap = await docRef.get();
    
    if (!snap.exists) {
      return { success: false, error: 'Complaint not found' };
    }

    const cData = snap.data() || {};
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }
    
    if (comment) {
      updateData.resolution_comment = comment;
    }

    await docRef.update(updateData);

    // Automatically send WhatsApp notification to tenant if phone number is available
    let whatsappRes = null;
    if (notifyWhatsApp) {
      let phone = cData.tenant_phone;
      if (!phone && cData.tenant_email) {
        const tSnap = await adminDb.collection('tenants').where('email', '==', cData.tenant_email).get();
        if (!tSnap.empty) {
          const tData = tSnap.docs[0].data();
          phone = tData.mobile || tData.phone || tData.phone_number || tData.tenant_phone;
        }
      }

      if (phone) {
        const statusLabel = status === 'resolved' ? 'RESOLVED ✅' : status === 'in-progress' ? 'IN PROGRESS ⏳' : 'PENDING 🕒';
        const msg = `🔧 *Complaint Update - ${cData.pg_name || 'Himalaya Hostels'}*\n\nHi ${cData.tenant_name || 'Resident'},\nYour complaint regarding *${cData.category || 'Maintenance'}* ("${cData.description || 'Issue'}") has been updated to *${statusLabel}*.\n\nThank you for your patience!`;
        
        whatsappRes = await sendWhatsAppTextMessage(phone, msg, {
          tenantId: cData.tenant_id,
          tenantName: cData.tenant_name,
          triggeredBy: 'complaint_status_update'
        });
      }
    }
    
    return { success: true, whatsapp: whatsappRes };
  } catch (error: any) {
    console.error("Error updating complaint status:", error);
    return { success: false, error: error.message };
  }
}

export async function sendComplaintCustomWhatsAppAction(params: {
  complaintId: string;
  customMessage: string;
}) {
  try {
    const snap = await adminDb.collection('complaints').doc(params.complaintId).get();
    if (!snap.exists) return { success: false, error: 'Complaint record not found' };

    const cData = snap.data() || {};
    let phone = cData.tenant_phone;
    
    if (!phone && cData.tenant_email) {
      const tSnap = await adminDb.collection('tenants').where('email', '==', cData.tenant_email).get();
      if (!tSnap.empty) {
        const tData = tSnap.docs[0].data();
        phone = tData.mobile || tData.phone || tData.phone_number || tData.tenant_phone;
      }
    }

    if (!phone) {
      return { success: false, error: 'No phone number available for this tenant' };
    }

    const fullMsg = `💬 *Complaint Update from ${cData.pg_name || 'Hostel Management'}*\n\nHi ${cData.tenant_name || 'Resident'},\nRegarding your complaint (${cData.category}):\n"${params.customMessage}"`;

    const res = await sendWhatsAppTextMessage(phone, fullMsg, {
      tenantId: cData.tenant_id,
      tenantName: cData.tenant_name,
      triggeredBy: 'complaint_custom_whatsapp_btn'
    });

    return res;
  } catch (error: any) {
    console.error("sendComplaintCustomWhatsAppAction error:", error);
    return { success: false, error: error.message };
  }
}

export async function addTenantComplaintReply(complaintId: string, replyText: string, tenantName?: string) {
  try {
    const docRef = adminDb.collection('complaints').doc(complaintId);
    const snap = await docRef.get();
    if (!snap.exists) return { success: false, error: 'Complaint not found' };

    const cData = snap.data() || {};
    const existingMessages = cData.messages || [];

    const newMsg = {
      sender: 'tenant',
      sender_name: tenantName || 'Tenant',
      message: replyText,
      timestamp: new Date().toISOString()
    };

    await docRef.update({
      messages: [...existingMessages, newMsg],
      updated_at: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error("addTenantComplaintReply error:", error);
    return { success: false, error: error.message };
  }
}

export async function addOwnerComplaintReply(complaintId: string, replyText: string) {
  try {
    const docRef = adminDb.collection('complaints').doc(complaintId);
    const snap = await docRef.get();
    if (!snap.exists) return { success: false, error: 'Complaint not found' };

    const cData = snap.data() || {};
    const existingMessages = cData.messages || [];

    const newMsg = {
      sender: 'owner',
      message: replyText,
      timestamp: new Date().toISOString()
    };

    await docRef.update({
      messages: [...existingMessages, newMsg],
      resolution_comment: replyText,
      updated_at: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error("addOwnerComplaintReply error:", error);
    return { success: false, error: error.message };
  }
}

export async function getAllTenantsForOwner(ownerId: string, pgId?: string) {
  try {
    let pgIds: string[] = [];
    const propertyMap: Record<string, string> = {};

    const propSnap = await adminDb.collection('properties').where('owner_id', '==', ownerId).get();
    propSnap.docs.forEach(doc => {
      const pData = doc.data();
      propertyMap[doc.id] = pData.name || pData.pg_name || 'Hostel';
    });

    if (pgId && pgId !== 'all') {
      pgIds = [pgId];
    } else {
      pgIds = Object.keys(propertyMap);
    }

    if (pgIds.length === 0) {
      return { success: true, data: [] };
    }

    const roomsMap: Record<string, string> = {};
    for (let i = 0; i < pgIds.length; i += 10) {
      const chunk = pgIds.slice(i, i + 10);
      const rSnap = await adminDb.collection('rooms').where('pg_id', 'in', chunk).get();
      rSnap.docs.forEach(doc => {
        const data = doc.data();
        roomsMap[doc.id] = data.room_number || data.name || data.room_name || '';
      });
    }

    const tenants: any[] = [];
    for (let i = 0; i < pgIds.length; i += 10) {
      const chunk = pgIds.slice(i, i + 10);
      const tSnap = await adminDb.collection('tenants').where('pg_id', 'in', chunk).get();
      tSnap.docs.forEach(doc => {
        const d = doc.data();
        if (isTenantActiveForBusiness(d)) {
          tenants.push({
            id: d.tenant_id || doc.id,
            doc_id: doc.id,
            tenant_id: d.tenant_id || doc.id,
            full_name: d.full_name || d.name || 'Tenant',
            name: d.full_name || d.name || 'Tenant',
            mobile: d.mobile || d.phone || d.phone_number || '',
            room_number: d.room_number || d.room_name || roomsMap[d.room_id || d.roomId] || 'Unassigned',
            pg_id: d.pg_id || '',
            pg_name: d.pg_name || propertyMap[d.pg_id || ''] || 'Hostel'
          });
        }
      });
    }

    tenants.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    return { success: true, data: tenants };
  } catch (error: any) {
    console.error("getAllTenantsForOwner error:", error);
    return { success: false, error: error.message, data: [] };
  }
}

export async function sendOwnerDirectMessage(params: {
  tenantId: string;
  tenantPhone?: string;
  tenantName?: string;
  message: string;
  complaintId?: string;
  sendWhatsApp?: boolean;
}) {
  try {
    const { tenantId, tenantPhone, tenantName, message, complaintId, sendWhatsApp } = params;

    const newMsg = { sender: 'owner', message, timestamp: new Date().toISOString() };

    if (complaintId) {
      const cRef = adminDb.collection('complaints').doc(complaintId);
      const cSnap = await cRef.get();
      if (cSnap.exists) {
        const existing = cSnap.data()?.messages || [];
        await cRef.update({
          messages: [...existing, newMsg],
          resolution_comment: message,
          updated_at: new Date().toISOString()
        });
      }
    } else {
      // Find existing complaint/chat thread for this tenant
      let existingSnap = await adminDb.collection('complaints').where('tenant_id', '==', tenantId).get();
      if (existingSnap.empty && tenantPhone) {
        existingSnap = await adminDb.collection('complaints').where('tenant_phone', '==', tenantPhone).get();
      }

      if (!existingSnap.empty) {
        const docToUpdate = existingSnap.docs[0];
        const existing = docToUpdate.data()?.messages || [];
        await docToUpdate.ref.update({
          messages: [...existing, newMsg],
          resolution_comment: message,
          updated_at: new Date().toISOString()
        });
      } else {
        // Look up tenant info to attach tenant_name, owner_id, pg_id, room_number
        let tenantData: any = {};
        const tSnap = await adminDb.collection('tenants').doc(tenantId).get();
        if (tSnap.exists) {
          tenantData = tSnap.data() || {};
        }

        await adminDb.collection('complaints').add({
          tenant_id: tenantId,
          tenant_name: tenantName || tenantData.full_name || tenantData.name || 'Tenant',
          tenant_email: tenantData.email || '',
          tenant_phone: tenantPhone || tenantData.mobile || tenantData.phone || '',
          room_number: tenantData.room_number || tenantData.room?.room_number || 'Unassigned',
          pg_id: tenantData.pg_id || '',
          pg_name: tenantData.pg_name || 'Hostel',
          owner_id: tenantData.owner_id || '',
          category: 'General Chat',
          description: message,
          status: 'pending',
          messages: [newMsg],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    let whatsappRes = null;
    if (sendWhatsApp && tenantPhone) {
      const fullMsg = `💬 *Message from Hostel Management*\n\nHi ${tenantName || 'Resident'},\n"${message}"`;
      whatsappRes = await sendWhatsAppTextMessage(tenantPhone, fullMsg, {
        tenantId,
        tenantName: tenantName || 'Tenant',
        triggeredBy: 'owner_direct_chat_message'
      });
    }

    return { success: true, whatsapp: whatsappRes };
  } catch (error: any) {
    console.error("sendOwnerDirectMessage error:", error);
    return { success: false, error: error.message };
  }
}

export async function clearTenantChat(tenantEmail: string) {
  try {
    const tenantQuery = await adminDb.collection('tenants').where('email', '==', tenantEmail).get();
    if (tenantQuery.empty) {
      return { success: false, error: 'Tenant not found.' };
    }
    const tenantDoc = tenantQuery.docs[0];
    await tenantDoc.ref.update({
      chat_cleared_at: new Date().toISOString()
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error clearing chat:", error);
    return { success: false, error: error.message };
  }
}
