const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}
const db = admin.firestore();

async function check() {
  const doc = await db.collection('system_settings').doc('landing').get();
  if (doc.exists) {
    const data = doc.data();
    console.log("SiteName:", data.siteName);
    console.log("LogoUrl Length:", data.logoUrl ? data.logoUrl.length : 0);
    if (data.logoUrl) {
      console.log("LogoUrl Preview:", data.logoUrl.substring(0, 100));
    }
  } else {
    console.log("Landing doc does not exist!");
  }
}
check().catch(console.error);
