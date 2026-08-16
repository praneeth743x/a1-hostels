import { NextResponse } from 'next/server';
import { WHATSAPP_CONFIG } from '@/lib/whatsappConfig';
import { updateWhatsAppMessageStatus, logWhatsAppEvent, handleIncomingWhatsAppTextMessage } from '@/lib/whatsapp';

/**
 * Meta WhatsApp Webhook GET Endpoint - Verification Challenge
 * Meta calls this when setting up or verifying the Webhook URL in Meta Developer Dashboard.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode && token) {
    if (mode === 'subscribe' && token === WHATSAPP_CONFIG.VERIFY_TOKEN) {
      console.log('[WHATSAPP-WEBHOOK] Webhook verified successfully!');
      return new NextResponse(challenge, { status: 200 });
    } else {
      console.error('[WHATSAPP-WEBHOOK] Verification token mismatch.');
      return NextResponse.json({ error: 'Forbidden. Verification token mismatch.' }, { status: 403 });
    }
  }

  return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
}

/**
 * Meta WhatsApp Webhook POST Endpoint - Real-Time Message Status & Inbound Messages
 * Receives notifications for message status (sent, delivered, read, failed) and updates Firestore whatsapp_logs.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if event is from WhatsApp API
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};

          // 1. Process Status Updates (sent, delivered, read, failed)
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              const messageId = statusObj.id;
              const status = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
              const timestampSec = statusObj.timestamp;
              const timestampStr = timestampSec ? new Date(parseInt(timestampSec) * 1000).toISOString() : new Date().toISOString();

              let failedReason: string | undefined = undefined;
              if (status === 'failed' && statusObj.errors && statusObj.errors.length > 0) {
                const err = statusObj.errors[0];
                failedReason = `[Meta Error ${err.code}] ${err.title || err.message || 'Delivery Failure'}`;
              }

              if (messageId && status) {
                await updateWhatsAppMessageStatus(messageId, status, timestampStr, failedReason);
              }
            }
          }

          // 2. Process Incoming Messages (Text, Image, Audio, Document, Location, Button replies)
          if (value.messages && Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              const fromPhone = msg.from;
              const messageId = msg.id;
              const msgType = msg.type; // 'text', 'image', 'audio', 'document', 'location', 'button', etc.

              let textBody = '';
              if (msgType === 'text' && msg.text?.body) {
                textBody = msg.text.body;
              } else if (msgType === 'image') {
                textBody = `📷 Photo${msg.image?.caption ? ': ' + msg.image.caption : ''}`;
              } else if (msgType === 'document') {
                textBody = `📄 Document${msg.document?.filename ? ': ' + msg.document.filename : msg.document?.caption ? ': ' + msg.document.caption : ''}`;
              } else if (msgType === 'audio' || msgType === 'voice') {
                textBody = `🎤 Voice Message`;
              } else if (msgType === 'location') {
                textBody = `📍 Shared Location`;
              } else if (msg.button?.text) {
                textBody = msg.button.text;
              } else if (msg.interactive?.button_reply?.title) {
                textBody = msg.interactive.button_reply.title;
              }

              if (textBody) {
                // Save text/media message to tenant chat thread in Firestore
                await handleIncomingWhatsAppTextMessage(fromPhone, textBody, messageId);

                // Log incoming event to whatsapp_logs for audit
                await logWhatsAppEvent({
                  phoneNumber: fromPhone,
                  templateName: 'incoming_tenant_reply',
                  language: WHATSAPP_CONFIG.DEFAULT_LANGUAGE,
                  status: 'delivered',
                  messageId,
                  triggeredBy: 'tenant_inbound',
                  createdAt: new Date().toISOString(),
                  payload: { text: textBody, type: msgType }
                });
              } else {
                console.log(`[WHATSAPP-WEBHOOK] Ignored unhandled inbound message of type '${msgType}' from ${fromPhone}`);
              }
            }
          }
        }
      }

      return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
    }

    return NextResponse.json({ error: 'Not a WhatsApp Business Account event' }, { status: 404 });
  } catch (error: any) {
    console.error('[WHATSAPP-WEBHOOK] Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
