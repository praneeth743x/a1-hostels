import axios from 'axios';
import FormData from 'form-data';
import { adminDb } from '@/lib/firebase-admin';
import { WHATSAPP_CONFIG, WhatsAppLogEntry } from './whatsappConfig';
import { 
  buildRentReminderUtilityMessage, 
  buildTenantWelcomeUtilityMessage,
  buildRentDueTodayUtilityMessage,
  buildRentDueTomorrowUtilityMessage,
  buildRentOverdueUtilityMessage,
  buildFeeReceiptUtilityMessage,
  validateUtilityMessage 
} from './whatsappUtilityBuilder';
import { createRealReceiptPDFBuffer } from './pdfReceiptBuilder';

const HOSTEL_BANNER_URL = 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1ybc4RDJcJCi0vesS4Kdhno7cvHG0nV0SrX9qYRRAuNE74f3AT9fvhQZSh6QXDC0MTiIjZfRyKlpYhZYt3nwU-m4ryDwg9eKqZfmuw8pDCIdLe0qvQnHSFWF_cQMaYigYn9TFDVs1fDCRbIqTnsPlQtDgbeuyyP5PQI5oNXy3bLkwMzLqMMLzwWcqn5GmEWcloVC5iheKI9ghf6sKn6QYheYdxLVQyrvIIHSDSfDzjTF7tulkyPnH';

/**
 * Validates and formats phone number into standard Meta WhatsApp E.164 numeric format (e.g. 919876543210).
 * Prevents duplicate country codes and removes special characters.
 */
export function formatPhoneNumber(phone: string, defaultCountryCode: string = '91'): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Standard Indian 10-digit mobile number check
  if (cleaned.length === 10) {
    cleaned = `${defaultCountryCode}${cleaned}`;
  } else if (!cleaned.startsWith(defaultCountryCode) && cleaned.length < 12) {
    cleaned = `${defaultCountryCode}${cleaned}`;
  }
  
  return cleaned;
}

/**
 * E.164 Validation check
 */
export function validatePhoneNumberE164(phone: string): { isValid: boolean; formatted: string; error?: string } {
  const formatted = formatPhoneNumber(phone);
  if (!formatted || formatted.length < 10 || formatted.length > 15) {
    return { isValid: false, formatted: '', error: 'Invalid phone number format. Must be E.164 standard.' };
  }
  return { isValid: true, formatted };
}

/**
 * Helper: Sleep for exponential backoff retries
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Firestore Logger: Inserts an event record into whatsapp_logs
 */
export async function logWhatsAppEvent(entry: WhatsAppLogEntry): Promise<string | null> {
  try {
    const docRef = await adminDb.collection('whatsapp_logs').add({
      tenantId: entry.tenantId || null,
      tenantName: entry.tenantName || 'Unknown',
      phoneNumber: entry.phoneNumber,
      templateName: entry.templateName,
      language: entry.language || WHATSAPP_CONFIG.DEFAULT_LANGUAGE,
      status: entry.status,
      messageId: entry.messageId || null,
      sentAt: entry.sentAt || new Date().toISOString(),
      deliveredAt: entry.deliveredAt || null,
      readAt: entry.readAt || null,
      failedReason: entry.failedReason || null,
      triggeredBy: entry.triggeredBy || 'system',
      createdAt: entry.createdAt || new Date().toISOString(),
      payload: entry.payload || null
    });
    return docRef.id;
  } catch (error) {
    console.error('[WHATSAPP-LOGS] Firestore write error:', error);
    return null;
  }
}

/**
 * Firestore Logger: Updates status (sent, delivered, read, failed) by Meta messageId
 */
export async function updateWhatsAppMessageStatus(
  messageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  timestampStr?: string,
  failedReason?: string
): Promise<boolean> {
  try {
    const snapshot = await adminDb.collection('whatsapp_logs')
      .where('messageId', '==', messageId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn(`[WHATSAPP-LOGS] No log entry found for messageId: ${messageId}`);
      return false;
    }

    const docId = snapshot.docs[0].id;
    const updateData: any = {
      status,
      updatedAt: new Date().toISOString()
    };

    const timeVal = timestampStr || new Date().toISOString();
    if (status === 'delivered') updateData.deliveredAt = timeVal;
    if (status === 'read') updateData.readAt = timeVal;
    if (status === 'failed') {
      updateData.failedReason = failedReason || 'Delivery failure notified via Meta Webhook';
    }

    await adminDb.collection('whatsapp_logs').doc(docId).update(updateData);
    return true;
  } catch (error) {
    console.error('[WHATSAPP-LOGS] Firestore status update error:', error);
    return false;
  }
}

/**
 * Central Meta Graph API request wrapper with exponential backoff retries.
 */
async function postToMetaGraph(endpoint: string, payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = WHATSAPP_CONFIG.ACCESS_TOKEN;
  const phoneId = WHATSAPP_CONFIG.PHONE_NUMBER_ID;
  const version = WHATSAPP_CONFIG.GRAPH_API_VERSION;

  if (!token || !phoneId) {
    return { success: false, error: 'WhatsApp credentials missing. Please check META_ACCESS_TOKEN & META_PHONE_NUMBER_ID.' };
  }

  const url = `https://graph.facebook.com/${version}/${phoneId}/${endpoint}`;
  let attempt = 0;
  let lastError = '';

  while (attempt < WHATSAPP_CONFIG.MAX_RETRIES) {
    attempt++;
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 12000
      });

      return { success: true, data: response.data };
    } catch (error: any) {
      const errRes = error.response?.data?.error;
      const statusCode = error.response?.status;
      lastError = errRes ? `[Meta ${errRes.code || statusCode}] ${errRes.message || JSON.stringify(errRes)}` : (error.message || 'Meta API error');

      // Do not retry on client 4xx auth or bad request errors
      if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        break;
      }

      if (attempt < WHATSAPP_CONFIG.MAX_RETRIES) {
        await sleep(WHATSAPP_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  return { success: false, error: lastError };
}

/**
 * Sends approved WhatsApp Template Message with automatic parameter count adaptation.
 */
export async function sendTemplate(params: {
  tenantPhone: string;
  templateName: string;
  language?: string;
  components?: any[];
  parametersList?: string[];
  tenantId?: string;
  tenantName?: string;
  triggeredBy?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const validation = validatePhoneNumberE164(params.tenantPhone);
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const langCode = params.language || WHATSAPP_CONFIG.DEFAULT_LANGUAGE;
  const pList = params.parametersList || [];

  // Preserve non-body components (e.g. Header image, Button parameters)
  const baseComponents = (params.components || []).filter((c: any) => c.type !== 'body');

  const buildComponents = (bodyParams?: string[]) => {
    const comps = [...baseComponents];
    if (bodyParams && bodyParams.length > 0) {
      comps.push({
        type: 'body',
        parameters: bodyParams.map(t => ({ type: 'text', text: String(t || 'N/A') }))
      });
    }
    return comps.length > 0 ? comps : undefined;
  };

  // Build candidate component sets to try if parameter mismatch occurs
  const candidateComponentsList: any[] = [];

  // If explicit components with body were passed, try them first
  if (params.components && params.components.some((c: any) => c.type === 'body')) {
    candidateComponentsList.push(params.components);
  }

  if (pList.length > 0) {
    // Try exact full parameters list combined with base components (header image, etc.)
    candidateComponentsList.push(buildComponents(pList));

    // Try 4 parameters
    if (pList.length >= 4) {
      candidateComponentsList.push(buildComponents(pList.slice(0, 4)));
    }
    // Try 3 parameters
    if (pList.length >= 3) {
      candidateComponentsList.push(buildComponents(pList.slice(0, 3)));
    }
    // Try 2 parameters
    if (pList.length >= 2) {
      candidateComponentsList.push(buildComponents(pList.slice(0, 2)));
    }
    // Try 1 parameter
    if (pList.length >= 1) {
      candidateComponentsList.push(buildComponents(pList.slice(0, 1)));
    }
  }

  // Also try base components alone (e.g., image header with 0 body params)
  candidateComponentsList.push(baseComponents.length > 0 ? baseComponents : undefined);

  let finalRes: any = { success: false, error: 'Unknown template error' };
  let finalPayload: any = null;

  for (const comps of candidateComponentsList) {
    const payload: any = {
      messaging_product: 'whatsapp',
      to: validation.formatted,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: langCode },
        ...(comps ? { components: comps } : {})
      }
    };

    let res = await postToMetaGraph('messages', payload);

    // Fallback retry for language code mismatch (e.g., 'en' vs 'en_US')
    if (!res.success && typeof res.error === 'string' && res.error.includes('132001')) {
      const fallbackLang = langCode === 'en' ? 'en_US' : 'en';
      payload.template.language.code = fallbackLang;
      res = await postToMetaGraph('messages', payload);
    }

    finalRes = res;
    finalPayload = payload;

    if (res.success) {
      break;
    }

    // Stop trying if error is NOT parameter mismatch (132000 / 132012 / 132014 / 100)
    const errStr = String(res.error || '');
    if (!errStr.includes('132000') && !errStr.includes('132012') && !errStr.includes('132014') && !errStr.includes('100')) {
      break;
    }
  }

  const messageId = finalRes.data?.messages?.[0]?.id;

  let friendlyError = finalRes.error;
  if (!finalRes.success && typeof finalRes.error === 'string') {
    if (finalRes.error.includes('100') && finalRes.error.includes('does not exist')) {
      friendlyError = `Template '${params.templateName}' not found in Meta WABA. Please create Utility template '${params.templateName}' in Meta WhatsApp Manager.`;
    } else if (finalRes.error.includes('131047')) {
      friendlyError = `24-Hour Window Expired: Send an approved template message to re-engage tenant.`;
    }
  }

  // Log to Firestore
  await logWhatsAppEvent({
    tenantId: params.tenantId,
    tenantName: params.tenantName,
    phoneNumber: validation.formatted,
    templateName: params.templateName,
    language: langCode,
    status: finalRes.success ? 'sent' : 'failed',
    messageId,
    failedReason: finalRes.success ? undefined : friendlyError,
    triggeredBy: params.triggeredBy || 'system',
    createdAt: new Date().toISOString(),
    payload: finalPayload
  });

  return { success: finalRes.success, messageId, error: friendlyError };
}

/**
 * Sends WhatsApp Direct Text Message.
 */
export async function sendWhatsAppTextMessage(
  tenantPhone: string, 
  text: string,
  metaOptions?: { tenantId?: string; tenantName?: string; triggeredBy?: string }
): Promise<{ success: boolean; error?: any; data?: any; messageId?: string }> {
  const validation = validatePhoneNumberE164(tenantPhone);
  if (!validation.isValid) return { success: false, error: validation.error };

  const payload = {
    messaging_product: 'whatsapp',
    to: validation.formatted,
    type: 'text',
    text: { body: text }
  };

  const res = await postToMetaGraph('messages', payload);
  const messageId = res.data?.messages?.[0]?.id;

  await logWhatsAppEvent({
    tenantId: metaOptions?.tenantId,
    tenantName: metaOptions?.tenantName,
    phoneNumber: validation.formatted,
    templateName: 'text_session_message',
    language: WHATSAPP_CONFIG.DEFAULT_LANGUAGE,
    status: res.success ? 'sent' : 'failed',
    messageId,
    failedReason: res.error,
    triggeredBy: metaOptions?.triggeredBy || 'system',
    createdAt: new Date().toISOString()
  });

  return { success: res.success, data: res.data, error: res.error, messageId };
}

/**
 * Sends WhatsApp Image Message with Caption.
 */
export async function sendWhatsAppImageMessage(
  tenantPhone: string,
  imageUrl: string,
  captionText: string,
  metaOptions?: { tenantId?: string; tenantName?: string; triggeredBy?: string }
): Promise<{ success: boolean; error?: any; data?: any; messageId?: string }> {
  const validation = validatePhoneNumberE164(tenantPhone);
  if (!validation.isValid) return { success: false, error: validation.error };

  const payload = {
    messaging_product: 'whatsapp',
    to: validation.formatted,
    type: 'image',
    image: { link: imageUrl, caption: captionText }
  };

  const res = await postToMetaGraph('messages', payload);
  const messageId = res.data?.messages?.[0]?.id;

  await logWhatsAppEvent({
    tenantId: metaOptions?.tenantId,
    tenantName: metaOptions?.tenantName,
    phoneNumber: validation.formatted,
    templateName: 'image_utility_message',
    language: WHATSAPP_CONFIG.DEFAULT_LANGUAGE,
    status: res.success ? 'sent' : 'failed',
    messageId,
    failedReason: res.error,
    triggeredBy: metaOptions?.triggeredBy || 'system',
    createdAt: new Date().toISOString()
  });

  return { success: res.success, data: res.data, error: res.error, messageId };
}

/**
 * Uploads binary buffer directly to Meta Cloud Media API.
 */
export async function uploadMediaToMeta(buffer: Buffer, fileName: string, mimeType: string = 'application/pdf'): Promise<string | null> {
  const token = WHATSAPP_CONFIG.ACCESS_TOKEN;
  const phoneId = WHATSAPP_CONFIG.PHONE_NUMBER_ID;
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', buffer, { filename: fileName, contentType: mimeType });

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${WHATSAPP_CONFIG.GRAPH_API_VERSION}/${phoneId}/media`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...form.getHeaders()
        }
      }
    );
    return response.data?.id || null;
  } catch (error: any) {
    console.error('[META-MEDIA-UPLOAD] Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Sends Document message by uploaded Meta Media ID.
 */
export async function sendWhatsAppDocumentByIdMessage(
  tenantPhone: string,
  mediaId: string,
  fileName: string,
  captionText: string,
  metaOptions?: { tenantId?: string; tenantName?: string; triggeredBy?: string }
): Promise<{ success: boolean; error?: any; data?: any; messageId?: string }> {
  const validation = validatePhoneNumberE164(tenantPhone);
  if (!validation.isValid) return { success: false, error: validation.error };

  const payload = {
    messaging_product: 'whatsapp',
    to: validation.formatted,
    type: 'document',
    document: { id: mediaId, filename: fileName, caption: captionText }
  };

  const res = await postToMetaGraph('messages', payload);
  const messageId = res.data?.messages?.[0]?.id;

  await logWhatsAppEvent({
    tenantId: metaOptions?.tenantId,
    tenantName: metaOptions?.tenantName,
    phoneNumber: validation.formatted,
    templateName: 'pdf_receipt_document',
    language: WHATSAPP_CONFIG.DEFAULT_LANGUAGE,
    status: res.success ? 'sent' : 'failed',
    messageId,
    failedReason: res.error,
    triggeredBy: metaOptions?.triggeredBy || 'system',
    createdAt: new Date().toISOString()
  });

  return { success: res.success, data: res.data, error: res.error, messageId };
}

/**
 * Sends Welcome Notification when tenant is created.
 */
export async function sendTenantWelcomeNotification(params: {
  tenantPhone: string;
  tenantName: string;
  roomNumber?: string;
  moveInDate?: string;
  rentAmount?: number;
  securityDeposit?: number;
  invoiceId?: string;
  hostelName?: string;
  tenantId?: string;
  triggeredBy?: string;
}): Promise<{ success: boolean; error?: any; data?: any; messageId?: string }> {
  let roomNumber = params.roomNumber;
  let hostelName = params.hostelName;
  let rawMoveInDate = params.moveInDate;

  if (params.tenantId && (!roomNumber || roomNumber === 'N/A' || !hostelName || hostelName === 'A1 Hostels' || !rawMoveInDate)) {
    const res = await resolveTenantRoomAndPendingDues(params.tenantId);
    if (!roomNumber || roomNumber === 'N/A') roomNumber = res.roomNumber;
    if (!hostelName || hostelName === 'A1 Hostels') hostelName = res.hostelName;
    if (!rawMoveInDate && res.moveInDate) rawMoveInDate = res.moveInDate;
  }

  // Format Check-in / Move-in Date (e.g., "12 Aug 2026")
  let formattedCheckInDate = 'N/A';
  if (rawMoveInDate) {
    const d = new Date(rawMoveInDate);
    if (!isNaN(d.getTime())) {
      formattedCheckInDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } else {
      formattedCheckInDate = String(rawMoveInDate).split('T')[0];
    }
  } else {
    formattedCheckInDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const parametersList = [
    params.tenantName || 'Tenant',
    hostelName || 'A1 Hostels',
    String(roomNumber || 'N/A'),
    formattedCheckInDate
  ];

  const welcomeBannerUrl = await getActiveTemplateBannerUrl('welcome');
  const components = [
    {
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: welcomeBannerUrl }
        }
      ]
    }
  ];

  return await sendTemplate({
    tenantPhone: params.tenantPhone,
    templateName: WHATSAPP_CONFIG.TEMPLATES.WELCOME,
    components,
    parametersList,
    tenantId: params.tenantId,
    tenantName: params.tenantName,
    triggeredBy: params.triggeredBy
  });
}

/**
 * Helper to resolve actual Room Number, Hostel Name, and Post-Payment Pending Dues from Firestore.
 */
const propertyCache = new Map<string, string>();
const roomCache = new Map<string, string>();

export async function resolveTenantRoomAndPendingDues(
  tenantId?: string,
  providedTenantData?: any,
  precalculatedDues?: number
): Promise<{ roomNumber: string; pendingDues: number; hostelName: string; moveInDate?: string }> {
  let roomNumber = 'N/A';
  let pendingDues = 0;
  let hostelName = 'A1 Hostels';
  let moveInDate: string | undefined = undefined;

  if (!tenantId && !providedTenantData) {
    return { roomNumber, pendingDues, hostelName, moveInDate };
  }

  try {
    let tData = providedTenantData;
    let actualTenantId = tenantId || tData?.tenant_id || tData?.id;

    if (!tData && actualTenantId) {
      const tSnap = await adminDb.collection('tenants').doc(actualTenantId).get();
      if (tSnap.exists) {
        tData = tSnap.data();
      } else {
        const qSnap = await adminDb.collection('tenants').where('tenant_id', '==', actualTenantId).limit(1).get();
        if (!qSnap.empty) tData = qSnap.docs[0].data();
      }
    }

    if (tData) {
      actualTenantId = tData.tenant_id || tData.id || actualTenantId;
      moveInDate = tData.move_in_date || tData.moveInDate || tData.joiningDate || tData.created_at;

      // 1. Resolve room number
      if (tData.room_number) {
        roomNumber = String(tData.room_number);
      } else if (tData.room && typeof tData.room === 'string' && !tData.room.startsWith('room_')) {
        roomNumber = String(tData.room);
      } else if (tData.room_id || tData.roomId) {
        const roomId = tData.room_id || tData.roomId;
        if (roomCache.has(roomId)) {
          roomNumber = roomCache.get(roomId)!;
        } else {
          const roomSnap = await adminDb.collection('rooms').doc(roomId).get();
          if (roomSnap.exists) {
            roomNumber = String(roomSnap.data()?.room_number || 'N/A');
            roomCache.set(roomId, roomNumber);
          } else {
            const roomQ = await adminDb.collection('rooms').where('room_id', '==', roomId).limit(1).get();
            if (!roomQ.empty) {
              roomNumber = String(roomQ.docs[0].data()?.room_number || 'N/A');
              roomCache.set(roomId, roomNumber);
            }
          }
        }
      }

      // 2. Resolve hostel name
      if (tData.pg_id) {
        if (propertyCache.has(tData.pg_id)) {
          hostelName = propertyCache.get(tData.pg_id)!;
        } else {
          const pgSnap = await adminDb.collection('properties').doc(tData.pg_id).get();
          if (pgSnap.exists) {
            hostelName = pgSnap.data()?.name || hostelName;
            propertyCache.set(tData.pg_id, hostelName);
          }
        }
      }

      // 3. Resolve pending dues for this tenant (only pending status)
      if (precalculatedDues !== undefined) {
        pendingDues = precalculatedDues;
      } else if (actualTenantId) {
        const pendingSnap1 = await adminDb.collection('payments')
          .where('tenant_id', '==', actualTenantId)
          .where('status', '==', 'pending')
          .get();

        const pendingSnap2 = await adminDb.collection('payments')
          .where('tenantId', '==', actualTenantId)
          .where('status', '==', 'pending')
          .get();

        const processedDocIds = new Set<string>();
        pendingSnap1.docs.forEach(doc => {
          processedDocIds.add(doc.id);
          pendingDues += Number(doc.data()?.amount || 0);
        });

        pendingSnap2.docs.forEach(doc => {
          if (!processedDocIds.has(doc.id)) {
            processedDocIds.add(doc.id);
            pendingDues += Number(doc.data()?.amount || 0);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[WA-RECEIPT] Error resolving tenant room/dues:', err);
  }

  return { roomNumber, pendingDues, hostelName, moveInDate };
}

/**
 * Sends Fee Receipt & Payment Confirmation with PDF attachment.
 */
export async function sendFeeReceiptNotification(params: {
  tenantPhone: string;
  tenantName: string;
  amountPaid: number;
  paymentMethod: string;
  paymentDate: string;
  category?: string;
  receiptId: string;
  hostelName?: string;
  pdfUrl?: string;
  pendingFee?: number;
  roomNumber?: string;
  tenantId?: string;
  triggeredBy?: string;
}): Promise<{ success: boolean; error?: any; data?: any; messageId?: string }> {
  let hostelName = params.hostelName;
  let roomNumber = params.roomNumber;
  let pendingFee = params.pendingFee;

  // Auto-resolve room number, hostel name, or pending dues if tenantId is available or fields are missing/N/A
  if (params.tenantId || !roomNumber || roomNumber === 'N/A' || pendingFee === undefined || !hostelName) {
    const resolved = await resolveTenantRoomAndPendingDues(params.tenantId);
    if (!roomNumber || roomNumber === 'N/A') roomNumber = resolved.roomNumber;
    if (!hostelName || hostelName === 'A1 Hostels') hostelName = resolved.hostelName;
    if (pendingFee === undefined) pendingFee = resolved.pendingDues;
  }

  hostelName = hostelName || 'A1 Hostels';
  roomNumber = roomNumber || 'N/A';
  pendingFee = pendingFee ?? 0;

  const fileName = `Receipt_${params.receiptId}.pdf`;

  let mediaId: string | null = null;
  try {
    const pdfBuffer = await createRealReceiptPDFBuffer({
      receiptId: params.receiptId,
      dateTimeStr: params.paymentDate,
      tenantName: params.tenantName,
      roomNumber,
      hostelName,
      paymentMethod: params.paymentMethod,
      pendingFee,
      amountPaid: params.amountPaid
    });

    mediaId = await uploadMediaToMeta(pdfBuffer, fileName, 'application/pdf');
  } catch (e) {
    console.warn('[WA-RECEIPT] PDF buffer generation error:', e);
  }

  // Construct exact components matching payment_confirmation_v1 (Header Document + 7 Body params)
  const components: any[] = [];
  if (mediaId) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'document',
          document: { id: mediaId, filename: fileName }
        }
      ]
    });
  }

  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: params.tenantName || 'Tenant' },                                  // {{1}} Tenant Name
      { type: 'text', text: hostelName },                                                     // {{2}} Hostel Name
      { type: 'text', text: String(roomNumber) },                                             // {{3}} Room Number
      { type: 'text', text: String(params.amountPaid || 0) },                                 // {{4}} Amount Paid
      { type: 'text', text: params.paymentDate || new Date().toLocaleDateString() },          // {{5}} Payment Date
      { type: 'text', text: String(params.receiptId) },                                       // {{6}} Receipt No
      { type: 'text', text: String(pendingFee) }                                              // {{7}} Due After Payment
    ]
  });

  return await sendTemplate({
    tenantPhone: params.tenantPhone,
    templateName: WHATSAPP_CONFIG.TEMPLATES.PAYMENT_CONFIRMATION,
    components,
    parametersList: [
      params.tenantName || 'Tenant',
      hostelName,
      String(roomNumber),
      String(params.amountPaid || 0),
      params.paymentDate || new Date().toLocaleDateString(),
      String(params.receiptId),
      String(pendingFee)
    ],
    tenantId: params.tenantId,
    tenantName: params.tenantName,
    triggeredBy: params.triggeredBy
  });
}

/**
 * Helper: Gets active template header banner image URL from app_settings or defaults to HOSTEL_BANNER_URL.
 */
export async function getActiveTemplateBannerUrl(templateKey?: 'welcome' | 'due' | 'overdue'): Promise<string> {
  try {
    const docSnap = await adminDb.collection('app_settings').doc('whatsapp_config').get();
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      if (templateKey === 'welcome' && data.welcomeBannerUrl) return data.welcomeBannerUrl;
      if (templateKey === 'due' && data.dueBannerUrl) return data.dueBannerUrl;
      if (templateKey === 'overdue' && data.overdueBannerUrl) return data.overdueBannerUrl;
      if (data.bannerUrl) return data.bannerUrl;
    }
  } catch (e) {
    console.warn('[WA-BANNER] Error fetching active banner URL:', e);
  }
  return HOSTEL_BANNER_URL;
}

/**
 * Sends Rent Reminder (DUE_TODAY / OVERDUE) with dynamic link and banner image header.
 */
export async function sendRentReminderWithLink(
  tenantPhone: string,
  tenantName: string,
  roomRent: number,
  dueMonth: string,
  invoiceId: string,
  hostelName: string = 'A1 Hostels',
  statusType: 'STANDARD' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'OVERDUE' = 'STANDARD',
  overdueDays: number = 0,
  extraParams?: { tenantId?: string; triggeredBy?: string; roomNumber?: string; dueDateStr?: string }
): Promise<{ success: boolean; error?: any; data?: any; messageId?: string }> {
  const isOverdue = statusType === 'OVERDUE';
  const templateName = isOverdue ? WHATSAPP_CONFIG.TEMPLATES.OVERDUE_REMINDER : WHATSAPP_CONFIG.TEMPLATES.DUE_REMINDER;

  let roomNumber = extraParams?.roomNumber;
  let finalHostelName = hostelName;
  if (extraParams?.tenantId && (!roomNumber || roomNumber === 'N/A' || !finalHostelName)) {
    const res = await resolveTenantRoomAndPendingDues(extraParams.tenantId);
    if (!roomNumber || roomNumber === 'N/A') roomNumber = res.roomNumber;
    if (!finalHostelName) finalHostelName = res.hostelName;
  }
  if (!roomNumber) roomNumber = '101';

  const dueDateStr = extraParams?.dueDateStr || `${new Date().getDate()} ${dueMonth}`;

  let bodyParameters: any[] = [];
  let parametersList: string[] = [];

  if (isOverdue) {
    const overdueText = `${overdueDays || 1} Day${(overdueDays || 1) > 1 ? 's' : ''}`;
    bodyParameters = [
      { type: 'text', text: tenantName || 'Tenant' },
      { type: 'text', text: overdueText },
      { type: 'text', text: finalHostelName },
      { type: 'text', text: String(roomNumber) },
      { type: 'text', text: String(roomRent || 0) },
      { type: 'text', text: String(dueDateStr) }
    ];
    parametersList = [
      tenantName || 'Tenant',
      overdueText,
      finalHostelName,
      String(roomNumber),
      String(roomRent || 0),
      String(dueDateStr)
    ];
  } else {
    bodyParameters = [
      { type: 'text', text: tenantName || 'Tenant' },
      { type: 'text', text: finalHostelName },
      { type: 'text', text: String(roomNumber) },
      { type: 'text', text: String(roomRent || 0) },
      { type: 'text', text: String(dueDateStr) }
    ];
    parametersList = [
      tenantName || 'Tenant',
      finalHostelName,
      String(roomNumber),
      String(roomRent || 0),
      String(dueDateStr)
    ];
  }

  const activeBannerUrl = await getActiveTemplateBannerUrl(isOverdue ? 'overdue' : 'due');

  const components = [
    {
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: activeBannerUrl }
        }
      ]
    },
    {
      type: 'body',
      parameters: bodyParameters
    }
  ];

  return await sendTemplate({
    tenantPhone,
    templateName,
    components,
    parametersList,
    tenantId: extraParams?.tenantId,
    tenantName,
    triggeredBy: extraParams?.triggeredBy
  });
}

/**
 * Diagnostic Test Connection Tool: Verifies Token, Phone ID, WABA and sends a live test message.
 */
export async function testWhatsAppConnection(recipientPhone: string): Promise<{
  success: boolean;
  stepResults: { step: string; status: 'SUCCESS' | 'FAILED'; details?: any }[];
  overallError?: string;
}> {
  const stepResults: { step: string; status: 'SUCCESS' | 'FAILED'; details?: any }[] = [];

  // Step 1: Check Config Variables
  if (!WHATSAPP_CONFIG.ACCESS_TOKEN || !WHATSAPP_CONFIG.PHONE_NUMBER_ID) {
    stepResults.push({ step: 'Credentials Check', status: 'FAILED', details: 'Missing META_ACCESS_TOKEN or PHONE_NUMBER_ID' });
    return { success: false, stepResults, overallError: 'Missing Meta API configuration secrets' };
  }
  stepResults.push({ step: 'Credentials Check', status: 'SUCCESS', details: { phoneId: WHATSAPP_CONFIG.PHONE_NUMBER_ID, version: WHATSAPP_CONFIG.GRAPH_API_VERSION } });

  // Step 2: Validate Graph API Phone Number ID
  try {
    const phoneRes = await axios.get(
      `https://graph.facebook.com/${WHATSAPP_CONFIG.GRAPH_API_VERSION}/${WHATSAPP_CONFIG.PHONE_NUMBER_ID}`,
      { headers: { Authorization: `Bearer ${WHATSAPP_CONFIG.ACCESS_TOKEN}` }, timeout: 8000 }
    );
    stepResults.push({ step: 'Meta Phone Number Verification', status: 'SUCCESS', details: { verifiedName: phoneRes.data.verified_name || 'Verified', displayPhone: phoneRes.data.display_phone_number || WHATSAPP_CONFIG.PHONE_NUMBER_ID } });
  } catch (e: any) {
    const errObj = e.response?.data?.error;
    const err = errObj?.message || e.message;
    
    // If phone ID endpoint returns permission warning but token is valid, attempt message dispatch
    if (errObj && errObj.code === 100) {
      stepResults.push({ step: 'Meta Phone Number Verification', status: 'SUCCESS', details: { note: 'Token authenticated. Proceeding to message dispatch.' } });
    } else {
      stepResults.push({ step: 'Meta Phone Number Verification', status: 'FAILED', details: err });
      return { success: false, stepResults, overallError: `Phone Number ID error: ${err}` };
    }
  }

  // Step 3: Send Test Message
  const sendRes = await sendWhatsAppTextMessage(
    recipientPhone,
    `✅ *StaySync Meta WhatsApp API Connection Test*\n\nYour WhatsApp Cloud API integration is live, authenticated, and communicating successfully.\n\nTimestamp: ${new Date().toLocaleString()}`,
    { triggeredBy: 'test_connection_suite' }
  );

  if (sendRes.success) {
    stepResults.push({ step: 'Test Message Dispatch', status: 'SUCCESS', details: { messageId: sendRes.messageId } });
    return { success: true, stepResults };
  } else {
    let errDetail = sendRes.error;
    if (typeof sendRes.error === 'string' && sendRes.error.includes('131030')) {
      errDetail = 'Meta Sandbox Mode: Add recipient number to allowed recipient list in Meta Developer Portal (API Setup -> To) or switch App to Live mode.';
    }
    stepResults.push({ step: 'Test Message Dispatch', status: 'FAILED', details: errDetail });
    return { success: false, stepResults, overallError: errDetail };
  }
}

/**
 * Processes incoming WhatsApp TEXT messages from tenants.
 * ONLY text messages are saved into tenant chat threads/complaints in Firestore.
 */
export async function handleIncomingWhatsAppTextMessage(
  fromPhone: string,
  textBody: string,
  messageId?: string
): Promise<boolean> {
  try {
    if (!textBody || !textBody.trim()) return false;
    const cleanText = textBody.trim();

    // Standardize phone number matching (last 10 digits)
    const digitsOnly = fromPhone.replace(/\D/g, '');
    const phone10 = digitsOnly.slice(-10);
    if (!phone10 || phone10.length < 10) return false;

    // Search for tenant by mobile/phone number across all possible phone field names
    const tenantsSnap = await adminDb.collection('tenants').get();
    let matchedTenant: any = null;
    let matchedTenantId: string = '';

    for (const doc of tenantsSnap.docs) {
      const tData = doc.data();
      const fields = [tData.mobile, tData.phone, tData.phone_number, tData.mobile_number, tData.tenant_phone, tData.whatsapp, tData.contact];
      for (const f of fields) {
        if (f && typeof f === 'string') {
          const cleaned = f.replace(/\D/g, '');
          if (cleaned.slice(-10) === phone10) {
            matchedTenant = tData;
            matchedTenantId = tData.tenant_id || doc.id;
            break;
          }
        }
      }
      if (matchedTenant) break;
    }

    const timestamp = new Date().toISOString();
    const newMsg = {
      sender: 'tenant',
      message: cleanText,
      timestamp,
      whatsappMessageId: messageId || null
    };

    let ownerId = matchedTenant?.owner_id || '';
    let tenantEmail = matchedTenant?.email || '';
    let tenantName = matchedTenant?.full_name || matchedTenant?.name || '';
    let roomNum = matchedTenant?.room_number || matchedTenant?.room?.room_number || 'Unassigned';
    let pgId = matchedTenant?.pg_id || '';
    let pgName = matchedTenant?.pg_name || '';

    // If owner_id is missing, try looking up from property doc
    if (!ownerId && pgId) {
      try {
        const propDoc = await adminDb.collection('properties').doc(pgId).get();
        if (propDoc.exists) {
          ownerId = propDoc.data()?.owner_id || '';
          pgName = pgName || propDoc.data()?.name || '';
        }
      } catch (e) {}
    }

    // Query all complaints to find existing thread by tenant ID, email, or phone10
    const complaintsSnap = await adminDb.collection('complaints').get();
    const allComplaints = complaintsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    const tenantComplaints = allComplaints.filter(c => {
      const cPhone10 = (c.tenant_phone || c.phone || '').replace(/\D/g, '').slice(-10);
      return (
        (matchedTenantId && c.tenant_id && c.tenant_id.toLowerCase() === matchedTenantId.toLowerCase()) ||
        (tenantEmail && c.tenant_email && c.tenant_email.toLowerCase() === tenantEmail.toLowerCase()) ||
        (cPhone10 && cPhone10 === phone10)
      );
    });

    if (tenantComplaints.length > 0) {
      tenantComplaints.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
      const activeComplaint = tenantComplaints[0];
      const existingMessages = activeComplaint.messages || [];

      if (!ownerId && activeComplaint.owner_id) {
        ownerId = activeComplaint.owner_id;
      }

      const updateData: any = {
        messages: [...existingMessages, newMsg],
        updated_at: timestamp
      };
      if (ownerId && !activeComplaint.owner_id) {
        updateData.owner_id = ownerId;
      }

      await adminDb.collection('complaints').doc(activeComplaint.id).update(updateData);
    } else {
      // If owner_id is still missing, set default owner_id from properties collection
      if (!ownerId) {
        try {
          const propsSnap = await adminDb.collection('properties').limit(1).get();
          if (!propsSnap.empty) {
            ownerId = propsSnap.docs[0].data().owner_id || '';
            pgName = pgName || propsSnap.docs[0].data().name || '';
          }
        } catch (e) {}
      }

      // Create a General Chat thread for this tenant in complaints
      await adminDb.collection('complaints').add({
        tenant_id: matchedTenantId || `unregistered_${phone10}`,
        tenant_name: tenantName || `WhatsApp (${fromPhone})`,
        tenant_email: tenantEmail || '',
        tenant_phone: fromPhone,
        room_number: roomNum,
        pg_id: pgId,
        pg_name: pgName || 'Direct Message',
        owner_id: ownerId,
        category: 'General Chat',
        description: cleanText,
        status: 'pending',
        messages: [newMsg],
        created_at: timestamp,
        updated_at: timestamp
      });
    }

    return true;
  } catch (err) {
    console.error('[WHATSAPP-INBOUND] Failed processing incoming text message:', err);
    return false;
  }
}
