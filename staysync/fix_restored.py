with open('src/app/pgowner/dues/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix the import
content = content.replace("import { sendRentReminderWithLink } from '@/lib/whatsapp';", "import { sendRentReminderAction } from '@/app/actions/whatsapp';")

# 2. Fix handleRemind
content = content.replace("await sendRentReminderWithLink(", "await sendRentReminderAction(")

# 3. Add getTenantStatus
target_active = '''  const activeTenants = tenants.filter(t => t.is_active !== false);'''
replacement_active = '''  const getTenantStatus = (t: any) => {
    if (!t) return 'Active';
    if (t.is_active === false || t.status === 'Vacated' || t.status === 'VACATED') return 'Vacated';
    if (t.status === 'Notice Period' || t.status === 'notice_period' || t.status === 'NOTICE' || t.status === 'NOTICE_PERIOD') return 'Notice Period';
    if (t.status === 'PAUSED' || t.status === 'Paused') return 'Paused';
    return 'Active';
  };

  const activeTenants = tenants;'''
if target_active in content:
    content = content.replace(target_active, replacement_active)

# 4. Fix tenantStatus call
target_status_call = "tenantStatus: t.is_active === false ? 'Vacated' : 'Active',"
replacement_status_call = "tenantStatus: getTenantStatus(t),"
if target_status_call in content:
    content = content.replace(target_status_call, replacement_status_call)

with open('src/app/pgowner/dues/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Restored fixes!")
