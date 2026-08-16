import { NextResponse } from 'next/server';
import { testWhatsAppConnection } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = body.phoneNumber || '919876543210';

    const result = await testWhatsAppConnection(phone);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      overallError: error.message || 'Failed to execute WhatsApp test connection'
    }, { status: 500 });
  }
}
