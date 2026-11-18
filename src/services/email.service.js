const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
};

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

exports.sendReceiptEmail = async ({ to, name, invoice, pdfBuffer }) => {
  const total = (invoice.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const subject = `Payment received – Receipt for ${invoice.invoiceNumber}`;
  const text = `Hi ${name},\n\nWe've received your payment of $${total} for invoice ${invoice.invoiceNumber}. Your receipt is attached.\n\nThank you,\nNexus Corporate Services`;
  const html = `<p>Hi ${escapeHtml(name)},</p>
    <p>We've received your payment of <strong>$${total}</strong> for invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong>.</p>
    <p>Your PDF receipt is attached.</p>
    <p>Thank you,<br/>Nexus Corporate Services</p>`;
  const filename = `Receipt-${invoice.invoiceNumber}.pdf`;

  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [to],
        subject,
        text,
        html,
        attachments: [{ filename, content: pdfBuffer.toString('base64') }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return;
  }


  await getTransporter().sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    text,
    html,
    attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
  });
};