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
