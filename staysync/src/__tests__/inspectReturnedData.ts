import { getInitialAppData } from '../app/actions/pgowner';

async function inspectReturnedData() {
  console.log("=== INSPECTING GETINITIALAPPDATA RETURNED DATA ===");
  const ownerId = 'fO1etPUMd9QwBpAxr8iDuEH9gAn2';
  const pgId = 'CAIzCEg6P2XrwO3fNxNc';

  const res = await getInitialAppData(ownerId, pgId);
  if (!res.success) {
    console.error("Failed to get initial app data:", res.error);
    return;
  }

  const data = res.data as any;
  const dues = data.dues || [];
  const payments = data.payments || [];

  const tenantId = 'up9BqKUAlFhPuCJ7dgOy';

  console.log("\n--- Dues (Charges) returned for Tenant ---");
  dues.filter((d: any) => d.tenant_id === tenantId).forEach((d: any) => {
    console.log(`- [${d.id}] ${d.type} - ${d.description}: amount=${d.amount}, status=${d.status}`);
  });

  console.log("\n--- Payments (Receipts) returned for Tenant ---");
  payments.filter((p: any) => p.tenant_id === tenantId).forEach((p: any) => {
    console.log(`- [${p.id}] amount=${p.amount_paid || p.amount}, status=${p.status}, date=${p.created_at || p.payment_date}`);
  });
}

inspectReturnedData().catch(console.error);
