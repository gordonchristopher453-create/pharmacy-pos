export const printReceipt = (receipt, pharmacy) => {
  const name = pharmacy?.name || 'Medicare HMS';
  const logoUrl = pharmacy?.logo_url || '';
  const footer = pharmacy?.receipt_footer || 'Thank you for your purchase!';
  const currency = pharmacy?.currency || 'KES';
  const mpesaCode = receipt.mpesa_code || '';

  const fmt = (n) => `${currency} ${parseFloat(n || 0).toFixed(2)}`;
  const date = new Date(receipt.created_at || Date.now());
  const dateStr = date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  // Use receipt_header from settings — skip first line if it's the pharmacy name
  const rawHeader = pharmacy?.receipt_header || '';
  const headerLines = rawHeader.split('\n').map(l => l.trim()).filter(l => l);
  // Remove first line if it duplicates the pharmacy name
  const subLines = headerLines.length > 0 && headerLines[0].toLowerCase() === name.toLowerCase()
    ? headerLines.slice(1)
    : headerLines;
  const headerHtml = subLines.join('<br>');

  const itemsHtml = (receipt.items || []).map(item => `
    <tr>
      <td style="padding: 3px 0; font-size: 12px;">${item.product_name}</td>
      <td style="padding: 3px 0; font-size: 12px; text-align: center;">${item.quantity}</td>
      <td style="padding: 3px 0; font-size: 12px; text-align: right;">${fmt(item.unit_price)}</td>
      <td style="padding: 3px 0; font-size: 12px; text-align: right; font-weight: 700;">${fmt(item.total_price)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt ${receipt.receipt_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 8px; font-size: 12px; color: #000; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .header { text-align: center; margin-bottom: 8px; }
        .header h2 { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
        .header .sub { font-size: 11px; line-height: 1.7; margin-top: 5px; }
        .receipt-no { text-align: center; font-size: 11px; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th { font-size: 11px; font-weight: 700; padding: 4px 0; border-bottom: 1px solid #000; text-align: left; }
        th:nth-child(2) { text-align: center; }
        th:nth-child(3), th:nth-child(4) { text-align: right; }
        .totals td { padding: 3px 0; font-size: 12px; }
        .totals .total-row td { font-size: 14px; font-weight: 900; padding-top: 6px; }
        .mpesa-code { text-align: center; margin: 6px 0; font-size: 11px; }
        .mpesa-code span { font-weight: 700; font-size: 12px; letter-spacing: 1px; }
        .footer { text-align: center; font-size: 11px; margin-top: 10px; line-height: 1.6; }
        @media print {
          body { width: 80mm; }
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" alt="logo" style="width:70px; height:70px; object-fit:contain; margin-bottom:6px;" />` : ''}
        <h2>${name}</h2>
        ${headerHtml ? `<div class="sub">${headerHtml}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="receipt-no">
        <div><strong>RECEIPT: ${receipt.receipt_number}</strong></div>
        <div>${dateStr} ${timeStr}</div>
        ${receipt.cashier_name ? `<div>Served by: ${receipt.cashier_name}</div>` : ''}
      </div>
      <div class="divider"></div>
      <table>
        <thead>
          <tr>
            <th>Item</th><th>Qty</th><th>Price</th><th>Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="divider"></div>
      <table class="totals">
        <tr>
          <td>Subtotal</td>
          <td style="text-align:right">${fmt(receipt.subtotal)}</td>
        </tr>
        ${parseFloat(receipt.discount) > 0 ? `
        <tr>
          <td>Discount</td>
          <td style="text-align:right">- ${fmt(receipt.discount)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td><strong>TOTAL</strong></td>
          <td style="text-align:right"><strong>${fmt(receipt.total)}</strong></td>
        </tr>
        <tr>
          <td style="padding-top:4px; font-size:11px;">Payment</td>
          <td style="text-align:right; padding-top:4px; font-size:11px; text-transform:capitalize;">${receipt.payment_method}</td>
        </tr>
      </table>
      ${mpesaCode ? `
      <div class="divider"></div>
      <div class="mpesa-code">M-Pesa Code: <span>${mpesaCode}</span></div>
      ` : ''}
      <div class="divider"></div>
      <div class="footer">
        <p>${footer.split('\n').join('<br>')}</p>
        <p style="margin-top:6px; font-size:10px;">Powered by Medicare HMS</p>
      </div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=400,height=600');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
};
