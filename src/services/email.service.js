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
    });
  }
  return transporter;
};

exports.sendReceiptEmail = async ({ to, name, invoice, pdfBuffer }) => {
  const total = (invoice.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
  await getTransporter().sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `Payment received – Receipt for ${invoice.invoiceNumber}`,
    text: `Hi ${name},\n\nWe've received your payment of $${total} for invoice ${invoice.invoiceNumber}. Your receipt is attached.\n\nThank you,\nNexus Corporate Services`,
    html: `<p>Hi ${name},</p>
           <p>We've received your payment of <strong>$${total}</strong> for invoice <strong>${invoice.invoiceNumber}</strong>.</p>
           <p>Your PDF receipt is attached.</p>
           <p>Thank you,<br/>Nexus Corporate Services</p>`,
    attachments: [{ filename: `Receipt-${invoice.invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
  });
};