import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  try {
    // If no real credentials are provided, we attempt to initialize with default. 
    // This allows the build/dev server to run without crashing, but actual DB queries will fail.
    if (process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
       initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();

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
      
    const invoices: any[] = [];
    snapshot.forEach(doc => {
      invoices.push({ id: doc.id, ...doc.data() });
    });
    
    return invoices;
  } catch (error) {
    console.error(`Failed to get unpaid invoices for ${month}:`, error);
    return [];
  }
}
