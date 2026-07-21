"use server";

import { adminAuth } from '@/lib/firebase-admin';

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || '';

export async function sendMsg91Otp(phone: string) {
  try {
    const rawPhone = phone.replace(/\D/g, '');
    
    // Call MSG91 Send OTP API
    const response = await fetch(`https://control.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=91${rawPhone}`, {
      method: 'POST',
      headers: {
        'authkey': MSG91_AUTH_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await response.json();
    console.log("MSG91 SEND RAW RESPONSE:", data);
    
    if (data.type === 'success' || data.type === 'success ') {
      return { success: true };
    } else {
      throw new Error(data.message || 'Failed to send OTP via MSG91');
    }
  } catch (error: any) {
    console.error("MSG91 Send Error:", error);
    return { success: false, error: error.message };
  }
}

export async function verifyMsg91OtpAndGetToken(phone: string, otp: string) {
  try {
    const rawPhone = phone.replace(/\D/g, '');
    
    // Universal Backdoor to bypass DLT block for testing all roles (SuperAdmin, PGOwner, Tenant)
    if (otp === '111111') {
      const formattedPhone = `+91${rawPhone}`;
      let uid;
      try {
        const userRecord = await adminAuth.getUserByPhoneNumber(formattedPhone);
        uid = userRecord.uid;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          const newUser = await adminAuth.createUser({ phoneNumber: formattedPhone });
          uid = newUser.uid;
        } else {
          throw err;
        }
      }
      const customToken = await adminAuth.createCustomToken(uid);
      return { success: true, customToken, uid };
    }
    
    // Call MSG91 Verify OTP API
    const response = await fetch(`https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=91${rawPhone}`, {
      method: 'GET',
      headers: {
        'authkey': MSG91_AUTH_KEY
      }
    });

    const data = await response.json();
    console.log("MSG91 VERIFY RAW RESPONSE:", data);
    
    if (data.type !== 'success' && data.type !== 'success ') {
      throw new Error(data.message || 'Invalid OTP');
    }

    // OTP is valid! Now create/get the Firebase User and generate a Custom Token
    const formattedPhone = `+91${rawPhone}`;
    let uid;
    
    try {
      const userRecord = await adminAuth.getUserByPhoneNumber(formattedPhone);
      uid = userRecord.uid;
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        const newUser = await adminAuth.createUser({
          phoneNumber: formattedPhone
        });
        uid = newUser.uid;
      } else {
        throw err;
      }
    }

    // Generate Firebase Custom Token
    const customToken = await adminAuth.createCustomToken(uid);
    
    return { success: true, customToken, uid };
  } catch (error: any) {
    console.error("MSG91 Verify Error:", error);
    return { success: false, error: error.message };
  }
}
