import { adminDb } from '../src/lib/firebase-admin';

async function listTenants() {
  const tenants = await adminDb.collection('tenants').get();
  tenants.forEach(doc => {
    console.log(doc.id, '->', doc.data().tenant_id, doc.data().full_name);
  });
  process.exit(0);
}

listTenants();
