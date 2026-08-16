const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envStr = fs.readFileSync(envPath, 'utf-8');
envStr.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  }
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    }),
  });
}
const db = admin.firestore();

async function inspectLogs() {
  console.log("=== RECENT WHATSAPP LOGS ===");
  const snap = await db.collection('whatsapp_logs').orderBy('createdAt', 'desc').limit(20).get();
  if (snap.empty) {
    console.log("No logs found in whatsapp_logs collection!");
    return;
  }

  snap.forEach(doc => {
    const data = doc.data();
    console.log(`\n[ID: ${doc.id}]`);
    console.log(`Tenant: ${data.tenantName} (${data.tenantId}) Phone: ${data.phoneNumber}`);
    console.log(`Template: ${data.templateName} | Status: ${data.status}`);
    console.log(`MessageId: ${data.messageId || 'NONE'}`);
    console.log(`Failed Reason: ${data.failedReason || 'N/A'}`);
    console.log(`Created At: ${data.createdAt}`);
    if (data.payload) {
      console.log(`Payload: ${JSON.stringify(data.payload)}`);
    }
  });
}

inspectLogs().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
