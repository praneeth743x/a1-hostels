const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}
const db = admin.firestore();

async function update() {
  await db.collection('system_settings').doc('landing').set({
    logoUrl: '/himalaya_logo_premium.png'
  }, { merge: true });
  console.log("Database logoUrl updated successfully to /himalaya_logo_premium.png");
}
update().catch(console.error);
