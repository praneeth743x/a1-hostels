import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { deleteTenantPermanently } from '@/app/actions/tenant';
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

    if (now > expiresAt) {
      // Unlock the tenant
      if (data?.tenantId) {
        await adminDb.collection('tenants').doc(data.tenantId).update({
          deletion_requested_at: null
        }).catch(() => {}); // ignore errors if tenant already deleted
      }
      return new NextResponse(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #d93025;">Link Expired</h2>
            <p>This confirmation link has expired (1 minute limit). The tenant has been unlocked.</p>
            <a href="/pgowner/tenants" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Return to Dashboard</a>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' }, status: 400 });
    }

    // Process the deletion
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
      <html>
        <head><title>Tenant Deleted</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #d93025;">Tenant Successfully Deleted</h2>
          <p>The tenant has been successfully removed from your records.</p>
          <a href="/pgowner/tenants" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Return to Dashboard</a>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (error: any) {
    console.error("Confirmation route error:", error);
    return new NextResponse("An internal error occurred.", { status: 500 });
  }
}
