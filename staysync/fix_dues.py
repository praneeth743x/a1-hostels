import re

with open('src/app/pgowner/dues/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add getTenantStatus and modify activeTenants
target1 = '''  // Treat tenants as active unless explicitly marked is_active === false
  const activeTenants = tenants.filter(t => t.is_active !== false);
  // Build the set of tenant IDs that already appear in the backend pending dues list
  const pendingDueTenantIds = new Set(dues.map((d: any) => d.tenant_id));
  
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

# 2. Fix d.tenantStatus logic in combinedList
target2 = '''        tenantStatus: d.tenantStatus || (
          tenant
            ? (tenant.is_active === false ? 'Vacated' : (tenant.status === 'notice_period' ? 'Notice Period' : (tenant.status === 'PAUSED' ? 'Paused' : 'Active')))
            : 'Active'
        ),'''
replacement2 = '''        tenantStatus: d.tenantStatus || getTenantStatus(tenant),'''
content = content.replace(target2, replacement2)

# 3. Fix t.tenantStatus logic in combinedList
target3 = '''        tenantStatus: t.is_active === false ? 'Vacated' : (t.status === 'notice_period' ? 'Notice Period' : 'Active'),'''
replacement3 = '''        tenantStatus: getTenantStatus(t),'''
content = content.replace(target3, replacement3)

# 4. Fix filtering
target4 = '''     const matchesStatus = filters.status === 'All' || item.tenantStatus === filters.status;'''
replacement4 = '''     let matchesStatus = false;
     if (filters.status === 'All') {
       if (item.tenantStatus === 'Vacated' && !pendingDueTenantIds.has(item.tenant_id)) {
         matchesStatus = false;
       } else {
         matchesStatus = true;
       }
     } else {
       matchesStatus = item.tenantStatus === filters.status;
     }'''
content = content.replace(target4, replacement4)

# 5. Fix isVacated in getThemeColors
target5 = '''    const isVacated = tenantStatus === 'vacated' || tenantStatus === 'VACATED';'''
replacement5 = '''    const isVacated = tenantStatus === 'Vacated' || tenantStatus === 'vacated' || tenantStatus === 'VACATED';'''
content = content.replace(target5, replacement5)

# 6. Fix isVacated in filteredList.map
target6 = '''              {filteredList.map((due) => {
                const isPaused = due.tenantStatus === 'Paused' || due.tenantStatus === 'PAUSED';
                const isVacated = due.tenantStatus === 'vacated' || due.tenantStatus === 'VACATED';'''
replacement6 = '''              {filteredList.map((due) => {
                const isPaused = due.tenantStatus === 'Paused' || due.tenantStatus === 'PAUSED';
                const isVacated = due.tenantStatus === 'Vacated' || due.tenantStatus === 'vacated' || due.tenantStatus === 'VACATED';'''
content = content.replace(target6, replacement6)

with open('src/app/pgowner/dues/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
