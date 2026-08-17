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
  dueAmount: number
) {
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/confirm-delete?token=${token}`;

  const mailOptions = {
    from: `"StaySync" <${process.env.EMAIL_USER}>`,
    to: ownerEmail,
    subject: `Confirm Tenant Deletion: ${tenantName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #d93025; margin-top: 0;">Confirm Tenant Deletion</h2>
        <p>Hello,</p>
        <p>A request was made to PERMANENTLY delete the following tenant:</p>
        <ul style="background: #f8fafc; padding: 15px 30px; border-radius: 5px;">
          <li><strong>Name:</strong> ${tenantName}</li>
          <li><strong>Hostel:</strong> ${pgName}</li>
          <li><strong>Room:</strong> ${roomNo}</li>
          <li><strong>Pending Due:</strong> ₹${dueAmount}</li>
        </ul>
        <p>To confirm and permanently delete this tenant, please click the button below:</p>
        <a href="${confirmUrl}" style="display: inline-block; padding: 12px 24px; background-color: #d93025; color: #fff; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: bold;">Confirm Deletion</a>
        <p style="color: #64748b; font-size: 0.9em; margin-top: 20px;"><em>If you did not request this, you can safely ignore this email. This link will expire in <strong>1 minute</strong>.</em></p>
      </div>
    `,
  };

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("EMAIL_USER or EMAIL_PASS not set in .env.local. Skipping email send. Confirmation URL:", confirmUrl);
    // In dev, we can pretend it sent if no email config exists
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
