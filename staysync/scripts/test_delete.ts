import { adminDb } from '../src/lib/firebase-admin';
import { softDeleteTenant } from '../src/lib/repository';

async function testDelete() {
  const tenantId = '9brrLJtQE9zRNXw92WeE';
  console.log('Attempting to delete tenant:', tenantId);
  const result = await softDeleteTenant(tenantId);
  console.log('Delete result:', result);
  process.exit(0);
}

testDelete();
