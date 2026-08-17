import fs from 'fs';
import path from 'path';

export interface ReceiptData {
  receiptId: string;
  dateTimeStr: string;
  tenantName: string;
  roomNumber: string;
  hostelName: string;
  paymentMethod: string;
  pendingFee: number;
  amountPaid: number;
  collectedByName?: string;
}

export function generateReceiptHTML(data: ReceiptData): string {
  let logoBase64 = '';
  try {
    const logoPath = path.join(process.cwd(), 'public', 'himalaya_logo_premium.png');
    if (fs.existsSync(logoPath)) {
      const buffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
    }
  } catch (e) {
    console.error("Failed to read logo for base64 embed:", e);
  }

  const {
    receiptId,
    dateTimeStr,
    tenantName,
    roomNumber,
    hostelName,
    paymentMethod,
    pendingFee = 0,
    amountPaid = 0,
    collectedByName
  } = data;

  const displayReceiptId = receiptId.startsWith('SS-') ? receiptId : `SS-${receiptId.substring(0, 8).toUpperCase()}`;
  const qrData = encodeURIComponent(`Raliving Receipt\nID: ${displayReceiptId}\nTenant: ${tenantName}\nAmount: ₹${amountPaid}\nPending: ₹${pendingFee}\nStatus: Successful`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - ${displayReceiptId}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #3b82f6;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --bg-page: #f8fafc;
      --bg-card: #ffffff;
      --border: #e2e8f0;
      --success: #16a34a;
      --success-bg: #dcfce7;
    }
    * { box-sizing: border-box; }
    body { 
      font-family: 'Inter', sans-serif; 
      background-color: var(--bg-page); 
      margin: 0; 
      padding: 2rem 1rem; 
      display: flex; 
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-main);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      min-height: 100vh;
    }
    .receipt-wrapper {
      background: var(--bg-card);
      width: 100%;
      max-width: 620px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      position: relative;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .receipt-content {
      padding: 2.5rem;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 38px;
      height: 38px;
      background: #2563eb;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 22px;
      font-style: italic;
    }
    .brand-name {
      font-weight: 800;
      font-size: 1.25rem;
      line-height: 1.1;
      color: #0f172a;
    }
    .brand-sub {
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-top: 2px;
      letter-spacing: 0.3px;
    }
    .receipt-meta {
      text-align: right;
    }
    .receipt-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #2563eb;
      font-size: 0.78rem;
      font-weight: 600;
      background: #eff6ff;
      padding: 5px 12px;
      border-radius: 20px;
      border: 1px solid #dbeafe;
    }
    .receipt-id {
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-top: 6px;
      font-weight: 600;
    }
    .title-section {
      text-align: center;
      margin-bottom: 2rem;
    }
    .title-section h1 {
      margin: 0;
      font-size: 1.85rem;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
    }
    .title-section h1 span {
      color: #3b82f6;
    }
    .title-section p {
      margin: 8px 0 0;
      font-size: 0.875rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-weight: 600;
    }
    .details-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
      margin-bottom: 1.5rem;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.9rem 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.9rem;
      font-weight: 500;
      color: #64748b;
    }
    .detail-value {
      font-weight: 700;
      font-size: 0.95rem;
      color: #0f172a;
    }
    .amount-box {
      background: #dcfce7;
      border-radius: 14px;
      padding: 1.1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.75rem;
    }
    .amount-box .detail-label {
      color: #166534;
      font-weight: 700;
      font-size: 1rem;
    }
    .amount-box .amount-value {
      font-size: 2rem;
      font-weight: 900;
      color: #16a34a;
    }
    .success-box {
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .success-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .success-check {
      width: 52px;
      height: 52px;
      background: #dcfce7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .success-check svg {
      width: 26px;
      height: 26px;
      color: #16a34a;
    }
    .success-text h3 {
      margin: 0 0 4px;
      font-size: 1.05rem;
      font-weight: 700;
      color: #16a34a;
    }
    .success-text p {
      margin: 0;
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .qr-code {
      text-align: center;
      background: white;
      padding: 6px;
      border-radius: 10px;
      border: 1px solid var(--border);
    }
    .qr-code img {
      width: 64px;
      height: 64px;
      display: block;
    }
    .qr-code span {
      display: block;
      font-size: 0.6rem;
      color: #64748b;
      margin-top: 2px;
      font-weight: 600;
    }
    .receipt-footer {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 1rem;
    }
    .download-bar {
      margin-bottom: 1.5rem;
      display: flex;
      gap: 12px;
    }
    .btn-print {
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(37,99,235,0.2);
    }
    @media print {
      body { background: transparent; padding: 0; }
      .download-bar { display: none; }
      .receipt-wrapper { max-width: 100%; box-shadow: none; border-radius: 0; border: none; }
    }
  </style>
  <script>
    function handlePrintOrDownload() {
      var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      if (isMobile) {
        window.location.href = '/api/receipt/pdf/${receiptId}';
      } else {
        window.print();
      }
    }
  </script>
</head>
<body>
  <div class="download-bar">
    <button class="btn-print" onclick="handlePrintOrDownload()">🖨️ Save as PDF / Print Receipt</button>
  </div>
  <div class="receipt-wrapper">
    <div class="receipt-content">
      <div class="header-bar">
        <div class="brand">
          <img src="${logoBase64 || '/himalaya_logo_premium.png'}" alt="Logo" style="width: 34px; height: 34px; object-fit: contain; border-radius: 6px; margin-right: 12px;" />
          <div>
            <div class="brand-name">${hostelName || 'A1 Hostels'}</div>
            <div class="brand-sub">Smart PG Management</div>
          </div>
        </div>
        <div class="receipt-meta">
          <div class="receipt-badge">📄 Payment Receipt</div>
          <div class="receipt-id">Receipt ID: ${displayReceiptId}</div>
        </div>
      </div>
      <div class="title-section">
        <h1>PAYMENT <span>RECEIPT</span></h1>
        <p><span>•</span> Official record of payment <span>•</span></p>
      </div>
      <div class="details-card">
        <div class="detail-row">
          <div class="detail-label">📅 Date & Time</div>
          <div class="detail-value">${dateTimeStr}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">👤 Tenant Name</div>
          <div class="detail-value">${tenantName}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">🏢 Room Number</div>
          <div class="detail-value">${roomNumber}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">⬡ Hostel Name</div>
          <div class="detail-value">${hostelName}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">💳 Payment Method</div>
          <div class="detail-value">${paymentMethod}</div>
        </div>
        ${collectedByName ? `
        <div class="detail-row">
          <div class="detail-label">👤 Collected By</div>
          <div class="detail-value">${collectedByName}</div>
        </div>
        ` : ''}
        <div class="detail-row" style="${pendingFee > 0 ? 'background: #fef2f2; margin: 4px -8px; padding: 10px 8px; border-radius: 8px;' : ''}">
          <div class="detail-label">❗ Pending Fee After Payment</div>
          <div class="detail-value" style="${pendingFee > 0 ? 'color:#dc2626; font-weight:700' : 'color:#16a34a; font-weight:700'}">
            ₹${pendingFee.toLocaleString('en-IN')}
            ${pendingFee > 0 ? 
              `<span style="font-size:0.72rem; background:#fee2e2; color:#b91c1c; padding:3px 10px; border-radius:12px; margin-left:6px; font-weight:700">Remaining Dues</span>` : 
              `<span style="font-size:0.72rem; background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:12px; margin-left:6px; font-weight:700">Paid in Full</span>`
            }
          </div>
        </div>
        <div class="amount-box">
          <div class="detail-label">💲 Amount Paid</div>
          <div class="amount-value">₹${amountPaid.toLocaleString('en-IN')}</div>
        </div>
      </div>
      <div class="success-box">
        <div class="success-left">
          <div class="success-check">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="success-text">
            <h3>Payment Successful</h3>
            <p>Thank you! Your payment has been received successfully.</p>
          </div>
        </div>
        <div class="qr-code">
          <img src="${qrUrl}" alt="QR">
          <span>Scan to Verify</span>
        </div>
      </div>
      <div class="receipt-footer">
        <div>Generated by <strong>Raliven Innovations</strong></div>
        <div style="margin-top: 4px;">Thank you for your payment!</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function saveStaticReceiptHTML(data: ReceiptData): string {
  try {
    const receiptsDir = path.join(process.cwd(), 'public', 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }
    const filename = `Receipt_${data.tenantName.replace(/\s+/g, '_')}_${data.receiptId.replace(/[^a-zA-Z0-9]/g, '')}.html`;
    const filepath = path.join(receiptsDir, filename);
    const html = generateReceiptHTML(data);
    fs.writeFileSync(filepath, html, 'utf8');
    return `/receipts/${filename}`;
  } catch (err) {
    console.error('Failed to save static receipt HTML:', err);
    return '';
  }
}
