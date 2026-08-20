import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { deleteTenantPermanently } from '@/app/actions/tenant';
import { deleteProperty } from '@/app/actions/pgowner';
import { revalidatePath } from 'next/cache';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new NextResponse("Invalid or missing token.", { status: 400 });
    }

    const requestRef = adminDb.collection('deletion_requests').doc(token);
    const docSnap = await requestRef.get();

    if (!docSnap.exists) {
      return new NextResponse("Invalid or expired confirmation link.", { status: 400 });
    }

    const data = docSnap.data();

    if (data?.status !== 'pending') {
      return new NextResponse("This deletion request has already been processed.", { status: 400 });
    }

    const now = new Date();
    const expiresAt = new Date(data?.expiresAt || 0);

    const isProperty = data?.type === 'property' || !!data?.propertyId;
    const targetDashboardUrl = isProperty ? '/pgowner/properties' : '/pgowner/tenants';

    if (now > expiresAt) {
      // Unlock the tenant if applicable
      if (data?.tenantId) {
        await adminDb.collection('tenants').doc(data.tenantId).update({
          deletion_requested_at: null
        }).catch(() => {});
      }
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Link Expired - A1 Hostels</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #1e293b; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;">
            <div style="background: white; border-radius: 16px; padding: 40px 30px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; font-size: 28px; font-weight: bold;">!</div>
              <h2 style="color: #dc2626; margin: 0 0 10px 0; font-size: 22px;">Confirmation Link Expired</h2>
              <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">This security confirmation link has expired (1 minute limit). No changes were made.</p>
              <a href="${targetDashboardUrl}" style="display: inline-block; padding: 12px 28px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Return to Dashboard</a>
            </div>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' }, status: 400 });
    }

    if (isProperty) {
      const propertyId = data?.propertyId || data?.pgId;
      const deleteResult = await deleteProperty(propertyId);
      if (!deleteResult.success) {
        return new NextResponse(`Failed to delete property: ${deleteResult.error}`, { status: 500 });
      }

      await requestRef.update({
        status: 'completed',
        completedAt: now.toISOString()
      });

      revalidatePath('/pgowner/properties');
      revalidatePath('/pgowner');

      return new NextResponse(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Hostel Deleted - A1 Hostels</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #1e293b; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;">
            <div style="background: white; border-radius: 16px; padding: 40px 30px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: #ecfdf5; color: #16a34a; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; font-size: 28px;">✓</div>
              <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 22px;">Hostel Successfully Deleted</h2>
              <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">The hostel and all its associated rooms, tenants, payments, and data have been permanently removed.</p>
              <a href="/pgowner/properties" style="display: inline-block; padding: 12px 28px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Return to Properties</a>
            </div>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    } else {
      // Process the tenant deletion
      const deleteResult = await deleteTenantPermanently(data?.tenantId);
      
      if (!deleteResult.success) {
        return new NextResponse(`Failed to delete tenant: ${deleteResult.error}`, { status: 500 });
      }

      // Mark token as used
      await requestRef.update({
        status: 'completed',
        completedAt: now.toISOString()
      });

      revalidatePath('/pgowner/tenants');
      revalidatePath('/pgowner/dashboard');

      return new NextResponse(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Tenant Deleted - A1 Hostels</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #1e293b; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;">
            <div style="background: white; border-radius: 16px; padding: 40px 30px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: #ecfdf5; color: #16a34a; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; font-size: 28px;">✓</div>
              <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 22px;">Tenant Successfully Deleted</h2>
              <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">The tenant and their associated account records have been permanently removed.</p>
              <a href="/pgowner/tenants" style="display: inline-block; padding: 12px 28px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Return to Tenants</a>
            </div>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

  } catch (error: any) {
    console.error("Confirmation route error:", error);
    return new NextResponse("An internal error occurred.", { status: 500 });
  }
}
