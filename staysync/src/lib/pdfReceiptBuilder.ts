import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface PDFReceiptParams {
  receiptId: string;
  dateTimeStr: string;
  tenantName: string;
  roomNumber: string;
  hostelName: string;
  paymentMethod: string;
  pendingFee: number;
  amountPaid: number;
}

export async function createRealReceiptPDFBuffer(params: PDFReceiptParams): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size in points
  const { width, height } = page.getSize();

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Background Page Color
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.97, 0.98, 0.99)
  });

  // Main Card Container
  const cardWidth = 515;
  const cardHeight = 720;
  const cardX = (width - cardWidth) / 2;
  const cardY = (height - cardHeight) / 2;

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.89, 0.91, 0.94),
    borderWidth: 1
  });

  let curY = cardY + cardHeight - 45;

  // 1. BRAND HEADER BAR
  page.drawRectangle({
    x: cardX + 30,
    y: curY - 32,
    width: 36,
    height: 36,
    color: rgb(0.15, 0.39, 0.92)
  });

  page.drawText('H', {
    x: cardX + 41,
    y: curY - 25,
    size: 20,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1)
  });

  page.drawText(params.hostelName || 'Himalaya Hostels', {
    x: cardX + 76,
    y: curY - 16,
    size: 18,
    font: fontHelveticaBold,
    color: rgb(0.06, 0.09, 0.16)
  });

  page.drawText('Smart PG Management', {
    x: cardX + 76,
    y: curY - 30,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.39, 0.45, 0.55)
  });

  // Receipt Badge
  const badgeWidth = 110;
  page.drawRectangle({
    x: cardX + cardWidth - 30 - badgeWidth,
    y: curY - 20,
    width: badgeWidth,
    height: 24,
    color: rgb(0.94, 0.96, 1.0),
    borderColor: rgb(0.86, 0.92, 1.0),
    borderWidth: 1
  });

  page.drawText('Payment Receipt', {
    x: cardX + cardWidth - 30 - badgeWidth + 12,
    y: curY - 14,
    size: 9,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.39, 0.92)
  });

  const displayId = params.receiptId.startsWith('SS-')
    ? params.receiptId
    : `SS-${params.receiptId.substring(0, 8).toUpperCase()}`;

  page.drawText(`Receipt ID: ${displayId}`, {
    x: cardX + cardWidth - 30 - 130,
    y: curY - 34,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.39, 0.45, 0.55)
  });

  curY -= 80;

  // 2. TITLE SECTION
  const titleText = 'PAYMENT RECEIPT';
  const titleWidth = fontHelveticaBold.widthOfTextAtSize(titleText, 22);
  page.drawText(titleText, {
    x: cardX + (cardWidth - titleWidth) / 2,
    y: curY,
    size: 22,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.39, 0.92)
  });

  curY -= 20;
  const subText = '• Official record of payment •';
  const subWidth = fontHelvetica.widthOfTextAtSize(subText, 10);
  page.drawText(subText, {
    x: cardX + (cardWidth - subWidth) / 2,
    y: curY,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.39, 0.45, 0.55)
  });

  curY -= 40;

  // 3. DETAILS CARD
  const innerWidth = cardWidth - 60;
  const innerHeight = 310;
  const innerX = cardX + 30;
  const innerY = curY - innerHeight;

  page.drawRectangle({
    x: innerX,
    y: innerY,
    width: innerWidth,
    height: innerHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.89, 0.91, 0.94),
    borderWidth: 1
  });

  const rows = [
    { label: 'Date & Time', val: params.dateTimeStr },
    { label: 'Tenant Name', val: params.tenantName },
    { label: 'Room Number', val: params.roomNumber },
    { label: 'Hostel Name', val: params.hostelName },
    { label: 'Payment Method', val: params.paymentMethod }
  ];

  let rowY = innerY + innerHeight - 40;

  rows.forEach(r => {
    page.drawText(r.label, {
      x: innerX + 20,
      y: rowY,
      size: 11,
      font: fontHelvetica,
      color: rgb(0.39, 0.45, 0.55)
    });

    const valWidth = fontHelveticaBold.widthOfTextAtSize(r.val, 11);
    page.drawText(r.val, {
      x: innerX + innerWidth - 20 - valWidth,
      y: rowY,
      size: 11,
      font: fontHelveticaBold,
      color: rgb(0.06, 0.09, 0.16)
    });

    rowY -= 15;
    page.drawLine({
      start: { x: innerX + 20, y: rowY },
      end: { x: innerX + innerWidth - 20, y: rowY },
      thickness: 0.5,
      color: rgb(0.89, 0.91, 0.94)
    });
    rowY -= 25;
  });

  // Pending Fee Row
  const isOverdue = params.pendingFee > 0;
  const pendingText = `INR ${params.pendingFee.toLocaleString('en-IN')}`;
  const badgeLabel = isOverdue ? 'Remaining Dues' : 'Paid in Full';

  page.drawText('Pending Fee After Payment', {
    x: innerX + 20,
    y: rowY,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.39, 0.45, 0.55)
  });

  const badgeTextWidth = fontHelveticaBold.widthOfTextAtSize(badgeLabel, 9);
  const valWidth = fontHelveticaBold.widthOfTextAtSize(pendingText, 11);
  const totalValWidth = valWidth + badgeTextWidth + 18;

  page.drawText(pendingText, {
    x: innerX + innerWidth - 20 - totalValWidth,
    y: rowY,
    size: 11,
    font: fontHelveticaBold,
    color: isOverdue ? rgb(0.86, 0.15, 0.15) : rgb(0.08, 0.64, 0.29)
  });

  page.drawRectangle({
    x: innerX + innerWidth - 20 - badgeTextWidth - 12,
    y: rowY - 4,
    width: badgeTextWidth + 12,
    height: 18,
    color: isOverdue ? rgb(0.99, 0.89, 0.89) : rgb(0.86, 0.98, 0.90)
  });

  page.drawText(badgeLabel, {
    x: innerX + innerWidth - 20 - badgeTextWidth - 6,
    y: rowY,
    size: 9,
    font: fontHelveticaBold,
    color: isOverdue ? rgb(0.72, 0.11, 0.11) : rgb(0.08, 0.5, 0.24)
  });

  rowY -= 45;

  // Amount Paid Green Banner
  const bannerHeight = 55;
  page.drawRectangle({
    x: innerX + 15,
    y: rowY - 10,
    width: innerWidth - 30,
    height: bannerHeight,
    color: rgb(0.86, 0.98, 0.90)
  });

  page.drawText('Amount Paid', {
    x: innerX + 35,
    y: rowY + 12,
    size: 14,
    font: fontHelveticaBold,
    color: rgb(0.08, 0.4, 0.2)
  });

  const amtText = `INR ${params.amountPaid.toLocaleString('en-IN')}`;
  const amtWidth = fontHelveticaBold.widthOfTextAtSize(amtText, 22);

  page.drawText(amtText, {
    x: innerX + innerWidth - 35 - amtWidth,
    y: rowY + 8,
    size: 22,
    font: fontHelveticaBold,
    color: rgb(0.08, 0.64, 0.29)
  });

  curY = innerY - 40;

  // 5. SUCCESS CONFIRMATION BOX
  page.drawRectangle({
    x: innerX,
    y: curY - 70,
    width: innerWidth,
    height: 70,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.91, 0.94, 0.98),
    borderWidth: 1
  });

  page.drawCircle({
    x: innerX + 35,
    y: curY - 35,
    size: 20,
    color: rgb(0.86, 0.98, 0.90)
  });

  page.drawText('OK', {
    x: innerX + 27,
    y: curY - 39,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.08, 0.64, 0.29)
  });

  page.drawText('Payment Successful', {
    x: innerX + 68,
    y: curY - 26,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.08, 0.64, 0.29)
  });

  page.drawText('Thank you! Your payment has been received successfully.', {
    x: innerX + 68,
    y: curY - 42,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.39, 0.45, 0.55)
  });

  // QR Code Box Placeholder
  page.drawRectangle({
    x: innerX + innerWidth - 75,
    y: curY - 60,
    width: 55,
    height: 50,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.89, 0.91, 0.94),
    borderWidth: 1
  });

  page.drawText('VERIFIED', {
    x: innerX + innerWidth - 71,
    y: curY - 38,
    size: 7,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.39, 0.92)
  });

  curY -= 100;

  // 6. FOOTER
  const footer1 = 'Generated by Raliven Innovations';
  const f1Width = fontHelveticaBold.widthOfTextAtSize(footer1, 10);
  page.drawText(footer1, {
    x: cardX + (cardWidth - f1Width) / 2,
    y: curY,
    size: 10,
    font: fontHelveticaBold,
    color: rgb(0.39, 0.45, 0.55)
  });

  curY -= 14;
  const footer2 = 'Thank you for your payment!';
  const f2Width = fontHelvetica.widthOfTextAtSize(footer2, 9);
  page.drawText(footer2, {
    x: cardX + (cardWidth - f2Width) / 2,
    y: curY,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.55, 0.60, 0.70)
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function saveStaticReceiptPDF(params: PDFReceiptParams): Promise<string> {
  try {
    const pdfBuffer = await createRealReceiptPDFBuffer(params);
    const receiptsDir = path.join(process.cwd(), 'public', 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }
    const cleanId = params.receiptId.replace(/[^a-zA-Z0-9]/g, '');
    const filename = `Fee_Receipt_${cleanId}.pdf`;
    const filepath = path.join(receiptsDir, filename);
    fs.writeFileSync(filepath, pdfBuffer);
    return `/receipts/${filename}`;
  } catch (err) {
    console.error('Failed to save static receipt PDF:', err);
    return '';
  }
}
