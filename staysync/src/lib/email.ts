import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendDeletionConfirmationEmail(
  ownerEmail: string,
  tenantName: string,
  token: string,
  pgName: string,
  roomNo: string,
  dueAmount: number,
  requestedByName?: string
) {
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/confirm-delete?type=tenant&token=${token}`;

  const mailOptions = {
    from: `"A1 Hostels" <${process.env.EMAIL_USER}>`,
    to: ownerEmail,
    subject: `Confirm Tenant Deletion: ${tenantName} - A1 Hostels`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="color: #4F46E5; margin: 0; font-size: 24px; font-weight: 700;">A1 Hostels</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Hostel Management Security</p>
        </div>

        <h2 style="color: #d93025; font-size: 20px; margin-bottom: 15px;">Confirm Tenant Deletion</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hello,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">A request was made to <strong>PERMANENTLY</strong> delete the following tenant from your hostel:</p>
        <ul style="background: #f8fafc; padding: 18px 30px; border-radius: 8px; border: 1px solid #e2e8f0; color: #334155; line-height: 1.8; font-size: 15px; list-style-type: none;">
          <li><strong>• Name:</strong> ${tenantName}</li>
          <li><strong>• Hostel:</strong> ${pgName}</li>
          <li><strong>• Room:</strong> ${roomNo}</li>
          <li><strong>• Pending Due:</strong> ₹${dueAmount.toLocaleString('en-IN')}</li>
          <li><strong>• Requested By:</strong> ${requestedByName || 'PG Owner / Management'}</li>
        </ul>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">To confirm and permanently delete this tenant and all associated data, please click the button below:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${confirmUrl}" style="display: inline-block; padding: 14px 28px; background-color: #d93025; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">Confirm Tenant Deletion</a>
        </div>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 20px; line-height: 1.5;"><em>If you did not request this, you can safely ignore this email. This confirmation link will expire in <strong>1 minute</strong>.</em></p>
        <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 25px;">&copy; ${new Date().getFullYear()} A1 Hostels. All rights reserved.</p>
      </div>
    `,
  };

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("EMAIL_USER or EMAIL_PASS not set in .env.local. Skipping email send. Confirmation URL:", confirmUrl);
    return true; 
  }

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending deletion confirmation email:", error);
    return false;
  }
}

export async function sendHostelDeletionConfirmationEmail(
  ownerEmail: string,
  hostelName: string,
  token: string,
  totalRooms: number = 0,
  totalTenants: number = 0
) {
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/confirm-delete?type=property&token=${token}`;

  const mailOptions = {
    from: `"A1 Hostels" <${process.env.EMAIL_USER}>`,
    to: ownerEmail,
    subject: `Confirm Hostel Deletion: ${hostelName} - A1 Hostels`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="color: #4F46E5; margin: 0; font-size: 24px; font-weight: 700;">A1 Hostels</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Hostel Management Security</p>
        </div>

        <h2 style="color: #d93025; font-size: 20px; margin-bottom: 15px;">Confirm Hostel Permanent Deletion</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hello,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">A request was made to <strong>PERMANENTLY</strong> delete the following hostel and all associated data:</p>
        <ul style="background: #fef2f2; padding: 18px 30px; border-radius: 8px; border: 1px solid #fecaca; color: #991b1b; line-height: 1.8; font-size: 15px;">
          <li><strong>Hostel Name:</strong> ${hostelName}</li>
          <li><strong>Rooms:</strong> ${totalRooms}</li>
          <li><strong>Tenants:</strong> ${totalTenants}</li>
          <li><strong>Warning:</strong> All rooms, active tenants, tenant auth accounts, payments, dues, complaints, notices, and expenses will be permanently wiped.</li>
        </ul>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">To confirm and permanently delete this hostel, click the button below:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${confirmUrl}" style="display: inline-block; padding: 14px 28px; background-color: #d93025; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">Confirm Permanent Deletion</a>
        </div>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 20px; line-height: 1.5;"><em>If you did not request this, you can safely ignore this email. This link will expire in <strong>1 minute</strong>.</em></p>
        <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 25px;">&copy; ${new Date().getFullYear()} A1 Hostels. All rights reserved.</p>
      </div>
    `,
  };

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("EMAIL_USER or EMAIL_PASS not set in .env.local. Skipping email send. Confirmation URL:", confirmUrl);
    return true; 
  }

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending hostel deletion confirmation email:", error);
    return false;
  }
}

export async function sendPasswordResetHTMLMail(
  email: string,
  userName: string,
  resetLink: string
) {
  const mailOptions = {
    from: `"A1 Hostels" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Password Reset Request - A1 Hostels`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="color: #4F46E5; margin: 0; font-size: 24px; font-weight: 700;">A1 Hostels</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Premium PG & Hostel Management</p>
        </div>
        
        <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 20px;">Reset Your Password</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          We received a request to reset the password for your A1 Hostels account associated with this email address.
        </p>
        
        <div style="text-align: center; margin: 35px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
            Reset Password
          </a>
        </div>
        
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          If the button doesn't work, you can copy and paste the following link into your browser:
        </p>
        <p style="background-color: #f8fafc; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 14px; color: #3b82f6;">
          <a href="${resetLink}" style="color: #3b82f6; text-decoration: none;">${resetLink}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
          If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; text-align: center; margin-top: 30px;">
          &copy; ${new Date().getFullYear()} A1 Hostels. All rights reserved.
        </p>
      </div>
    `,
  };

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("EMAIL_USER or EMAIL_PASS not set. Skipping real email send. Reset Link:", resetLink);
    return true; 
  }

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
}
