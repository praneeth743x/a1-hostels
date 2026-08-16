import re

with open('src/app/pgowner/dues/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = '''  const activeTenants = tenants.filter(t => t.is_active);
  const pendingDueTenantIds = new Set(dues.map(d => d.tenant_id));
  
  const paidCount = activeTenants.filter(t => !pendingDueTenantIds.has(t.tenant_id)).length;
  
  const dueCount = activeTenants.filter(t => pendingDueTenantIds.has(t.tenant_id)).length;'''

replacement1 = '''  const getTenantStatus = (t: any) => {
    if (!t) return 'Active';
    if (t.is_active === false || t.status === 'Vacated' || t.status === 'VACATED') return 'Vacated';
    if (t.status === 'Notice Period' || t.status === 'notice_period' || t.status === 'NOTICE' || t.status === 'NOTICE_PERIOD') return 'Notice Period';
    if (t.status === 'PAUSED' || t.status === 'Paused') return 'Paused';
    return 'Active';
  };

  const activeTenants = tenants;
  const pendingDueTenantIds = new Set(dues.map((d: any) => d.tenant_id));
  
  const paidCount = activeTenants.filter(t => t.is_active !== false && !pendingDueTenantIds.has(t.tenant_id)).length;
  
  const dueCount = activeTenants.filter(t => t.is_active !== false && pendingDueTenantIds.has(t.tenant_id)).length;'''

content = content.replace(target1, replacement1)

with open('src/app/pgowner/dues/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
