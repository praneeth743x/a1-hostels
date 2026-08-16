import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { App } from 'firebase-admin/app';

let adminAppModule: any;
let adminAuthModule: any;
let adminFirestoreModule: any;
let firebaseApp: App | null = null;

function initFirebaseAdmin() {
  if (firebaseApp) return firebaseApp;

  if (typeof window === 'undefined') {
    // Hide requires from Turbopack to prevent mangling
    const req = eval('require');
    if (!adminAppModule) adminAppModule = req('firebase-admin/app');
    if (!adminAuthModule) adminAuthModule = req('firebase-admin/auth');
    if (!adminFirestoreModule) adminFirestoreModule = req('firebase-admin/firestore');
    
    if (adminAppModule.getApps().length > 0) {
      firebaseApp = adminAppModule.getApps()[0];
      return firebaseApp;
    }

    try {
      console.log('[FIREBASE-ADMIN] Initializing application...');
      const privateKeyRaw = process.env.FB_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
      const clientEmail = process.env.FB_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
      if (privateKeyRaw) {
        firebaseApp = adminAppModule.initializeApp({
          credential: adminAppModule.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: clientEmail,
            privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
          }),
        });
        console.log('[FIREBASE-ADMIN] Initialized with private key.');
      } else {
        firebaseApp = adminAppModule.initializeApp();
        console.log('[FIREBASE-ADMIN] Initialized with default credentials.');
      }
    } catch (error) {
      console.error('[FIREBASE-ADMIN] Initialization error', error);
    }
  }
  return firebaseApp;
}

export const adminAuth = new Proxy({}, {
  get: (target, prop) => {
    const app = initFirebaseAdmin();
    const auth = adminAuthModule.getAuth(app);
    const value = (auth as any)[prop];
    return typeof value === 'function' ? value.bind(auth) : value;
  }
}) as unknown as Auth;

export const adminDb = new Proxy({}, {
  get: (target, prop) => {
    const app = initFirebaseAdmin();
    const firestore = adminFirestoreModule.getFirestore(app);
    const value = (firestore as any)[prop];
    return typeof value === 'function' ? value.bind(firestore) : value;
  }
}) as unknown as Firestore;


export async function dbUpdateInvoiceStatus(invoiceId: string, status: string) {
  try {
    await adminDb.collection('invoices').doc(invoiceId).update({
      status: status,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error(`Failed to update invoice ${invoiceId}:`, error);
    return false;
  }
}

export async function getUnpaidInvoicesForMonth(month: string) {
  try {
    const snapshot = await adminDb.collection('invoices')
      .where('dueMonth', '==', month)
      .where('status', 'in', ['pending', 'overdue'])
      .get();
      
    const rawInvoices: any[] = [];
    snapshot.forEach(doc => {
      rawInvoices.push({ id: doc.id, ...doc.data() });
    });

    const activeInvoices: any[] = [];
    for (const invoice of rawInvoices) {
      if (invoice.tenantId) {
        const tSnap = await adminDb.collection('tenants').doc(invoice.tenantId).get();
        if (!tSnap.exists || tSnap.data()?.status === 'DELETED' || tSnap.data()?.is_active === false) {
          continue;
        }
      }
      if (invoice.pg_id) {
        const pSnap = await adminDb.collection('properties').doc(invoice.pg_id).get();
        if (!pSnap.exists || pSnap.data()?.status === 'DELETED' || pSnap.data()?.is_active === false) {
          continue;
        }
      }
      activeInvoices.push(invoice);
    }
    
    return activeInvoices;
  } catch (error) {
    console.error(`Failed to get unpaid invoices for ${month}:`, error);
    return [];
  }
}
