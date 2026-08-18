import { NextResponse } from 'next/server';
// Force Turbopack Cache Refresh - Permissions Fix
import * as pgownerActions from '@/app/actions/pgowner';
import * as authActions from '@/app/actions/auth';
import * as superadminActions from '@/app/actions/superadmin';
import * as razorpayActions from '@/app/actions/razorpay';
import * as teamActions from '@/app/actions/teamActions';
import * as complaintsActions from '@/app/actions/complaints';
import * as tenantActions from '@/app/actions/tenant';
import * as whatsappActions from '@/app/actions/whatsappActions';
import * as privacyActions from '@/app/actions/privacy';
import * as profileActions from '@/app/actions/profile';

const allActions: Record<string, any> = {
  ...profileActions,
  ...pgownerActions,
  ...authActions,
  ...superadminActions,
  ...razorpayActions,
  ...teamActions,
  ...complaintsActions,
  ...tenantActions,
  ...whatsappActions,
  ...privacyActions,
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, args } = body;
    
    if (!allActions[action]) {
      return NextResponse.json({ success: false, error: `Action ${action} not found` });
    }
    
    const result = await allActions[action](...args);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
// force reload
// force reload 2
