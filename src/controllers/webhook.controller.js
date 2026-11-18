const mongoose = require('mongoose');
const stripe = require('../services/stripe');
const Invoice = require('../models/Invoice');
const { buildInvoicePdf } = require('../services/pdf.service');
const { sendReceiptEmail } = require('../services/email.service');
const { STRIPE_WEBHOOK_SECRET } = require('../config/env');

async function fulfill(session) {
  const invoiceId = session.metadata && session.metadata.invoiceId;
  if (!mongoose.isValidObjectId(invoiceId)) return console.warn('[webhook] session without valid invoiceId');

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return console.warn(`[webhook] invoice ${invoiceId} not found`);


  if (session.amount_total !== invoice.amountCents || session.currency !== invoice.currency) {
    return console.error(`[webhook] AMOUNT MISMATCH for ${invoice.invoiceNumber}: got ${session.amount_total} ${session.currency}`);
  }


  const updated = await Invoice.findOneAndUpdate(
    { _id: invoiceId, status: { $ne: 'Paid' } },
    {
      status: 'Paid',
      paidAt: new Date(),
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
    },
    { new: true }
  ).populate('client', 'name email company');

  if (!updated) return console.log(`[webhook] ${invoice.invoiceNumber} already processed – skipping`);
  console.log(`[webhook] ✔ ${updated.invoiceNumber} marked Paid`);


  if (!updated.client) {
    return console.warn(`[webhook] ${updated.invoiceNumber} paid but client was deleted – no receipt emailed`);
  }

  const pdfBuffer = await buildInvoicePdf(updated, updated.client);
  console.log(`[webhook] ✔ PDF receipt generated (${pdfBuffer.length} bytes)`);

  sendReceiptEmail({ to: updated.client.email, name: updated.client.name, invoice: updated, pdfBuffer })
    .then(async () => {
      await Invoice.updateOne({ _id: updated._id }, { emailSent: true });
      console.log(`[webhook] ✔ Receipt emailed to ${updated.client.email}`);
    })
    .catch((err) => console.error('[webhook] ✘ Email failed:', err.message));
}


exports.handleStripeWebhook = async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[webhook] received ${event.type} (${event.id})`);

  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = event.data.object;
      if (session.payment_status === 'paid') await fulfill(session);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook] processing error:', err);
    res.status(500).send('Webhook handler failed'); 
  }
};