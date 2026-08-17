"use server";

import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay lazily to prevent CI build errors when env vars are absent
function getRazorpayClient() {
  if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
    throw new Error("RAZORPAY_KEY_ID is missing");
  }
  return new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });
}

export async function createRazorpayOrder(amountPaise: number, receiptId: string) {
  try {
    if (amountPaise < 100) {
      throw new Error("Amount must be at least 100 paise");
    }

    const razorpay = getRazorpayClient();
    const options = {
      amount: amountPaise,
      currency: "INR",
      receipt: receiptId,
    };

    const order = await razorpay.orders.create(options);
    return { success: true, order_id: order.id, amount: order.amount, currency: order.currency };
  } catch (error: any) {
    console.error("Error creating Razorpay order:", error);
    return { success: false, error: error.message || "Failed to create order" };
  }
}

export async function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
) {
  try {
    if (!razorpayOrderId || !razorpayPaymentId || !signature) {
      return { success: false, error: "Missing required fields" };
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const isValid = generatedSignature === signature;
    if (!isValid) {
      return { success: false, error: "Signature mismatch" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Mock WhatsApp Broadcast Server Action
export async function sendWhatsAppReceipt(phone: string, amount: number, tenantName: string) {
  try {
    console.log(`[MOCK INTERAKT API] Sent receipt to ${phone} for ₹${amount}`);
    // In production, make a POST request to Interakt/Twilio here
    // await fetch('https://api.interakt.ai/v1/public/message/', { ... })
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
