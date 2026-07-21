import axios from 'axios';

const META_API_VERSION = 'v18.0';
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || 'YOUR_META_PHONE_NUMBER_ID';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || 'YOUR_PERMANENT_ACCESS_TOKEN';

/**
 * Sanitizes phone numbers by stripping non-numeric characters and ensuring a '91' prefix.
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (!cleaned.startsWith('91')) {
    cleaned = `91${cleaned}`;
  }
  return cleaned;
}

/**
 * Sends a rent reminder WhatsApp template using Meta Cloud API.
 */
export async function sendRentReminderWithLink(
  tenantPhone: string,
  tenantName: string,
  roomRent: number,
  dueMonth: string,
  invoiceId: string
) {
  const formattedPhone = formatPhoneNumber(tenantPhone);

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: 'rent_reminder_v2',
      language: {
        code: 'en'
      },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: tenantName },
            { type: 'text', text: roomRent.toString() },
            { type: 'text', text: dueMonth }
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            { type: 'text', text: invoiceId } // Dynamically appends to the Base URL
          ]
        }
      ]
    }
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error('WhatsApp API Error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}
