const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const stripe = require('../services/stripe');
const { buildInvoicePdf } = require('../services/pdf.service');
const { CLIENT_URL } = require('../config/env');
const { HttpError, asyncHandler } = require('../middleware/error');
const { searchRegex, parsePaging } = require('../utils/search');


async function getAuthorizedInvoice(req) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid invoice id');

  const invoice = await Invoice.findById(id).populate('client', 'name email company');
  if (!invoice) throw new HttpError(404, 'Invoice not found');


  const isOwner = !!invoice.client && invoice.client._id.toString() === req.user.id;
  if (req.user.role !== 'admin' && !isOwner) throw new HttpError(403, 'Forbidden: this invoice does not belong to you');
  return invoice;
}


const billTo = (inv) => {
  if (inv.client && inv.client.name) {
    return { id: inv.client._id, name: inv.client.name, email: inv.client.email, company: inv.client.company, deleted: false };
  }
  const s = inv.clientSnapshot || {};
  return { id: null, name: s.name || 'Deleted client', email: s.email || '', company: s.company || '', deleted: true };
};

const serialize = (inv) => ({
  id: inv.id,
  invoiceNumber: inv.invoiceNumber,
  client: billTo(inv),
  items: inv.items,
  amountCents: inv.amountCents,
  currency: inv.currency,
  dueDate: inv.dueDate,
  status: inv.status,
  paidAt: inv.paidAt,
  createdAt: inv.createdAt,
});


exports.list = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const filter = isAdmin ? {} : { client: req.user._id };

  const rx = searchRegex(req.query.search);
  if (rx) {
    if (isAdmin) {
      const ids = await User.find({ role: 'client', $or: [{ name: rx }, { email: rx }, { company: rx }] }).distinct('_id');
      filter.$or = [
        { invoiceNumber: rx },
        { client: { $in: ids } },
        { 'clientSnapshot.name': rx },
        { 'clientSnapshot.email': rx },
        { 'clientSnapshot.company': rx },
      ];
    } else {
      filter.invoiceNumber = rx;
    }
  }

  const status = String(req.query.status || '');
  if (['Pending', 'Paid'].includes(status)) filter.status = status;

  const query = Invoice.find(filter).populate('client', 'name email company').sort('-createdAt');

  if (req.query.page === undefined) {
    const invoices = await query;
    return res.json({ invoices: invoices.map(serialize) });
  }

  const { page, limit, skip } = parsePaging(req.query, 10);
  const [invoices, total] = await Promise.all([query.skip(skip).limit(limit), Invoice.countDocuments(filter)]);
  res.json({ invoices: invoices.map(serialize), total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});


exports.create = asyncHandler(async (req, res) => {
  const { clientId, description, amount, dueDate } = req.body;
  if (!mongoose.isValidObjectId(clientId)) throw new HttpError(400, 'Please select a client');
  if (!description || !String(description).trim()) throw new HttpError(400, 'Description required');

  const dollars = Number(amount);
  if (!Number.isFinite(dollars) || dollars <= 0 || dollars > 1_000_000) throw new HttpError(400, 'Invalid amount');
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) throw new HttpError(400, 'Invalid due date');

  const client = await User.findOne({ _id: clientId, role: 'client' });
  if (!client) throw new HttpError(404, 'Client not found');

  const amountCents = Math.round(dollars * 100);
  const invoice = await Invoice.create({
    invoiceNumber: `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`,
    client: client._id,
    items: [{ description: String(description).trim(), amountCents }],
    amountCents,
    dueDate: due,
  });
  await invoice.populate('client', 'name email company');
  res.status(201).json({ invoice: serialize(invoice) });
});


exports.remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid invoice id');

  const invoice = await Invoice.findById(id);
  if (!invoice) throw new HttpError(404, 'Invoice not found');

  if (invoice.status === 'Paid' && req.query.confirm !== invoice.invoiceNumber) {
    throw new HttpError(409, 'Type the exact invoice number to delete a paid invoice', 'PAID_CONFIRM');
  }

  await invoice.deleteOne();
  res.json({ message: 'Invoice deleted' });
});


exports.getOne = asyncHandler(async (req, res) => {
  res.json({ invoice: serialize(await getAuthorizedInvoice(req)) });
});


exports.downloadPdf = asyncHandler(async (req, res) => {
  const invoice = await getAuthorizedInvoice(req);
  const pdf = await buildInvoicePdf(invoice, billTo(invoice));
  const prefix = invoice.status === 'Paid' ? 'Receipt' : 'Invoice';
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${prefix}-${invoice.invoiceNumber}.pdf"`,
    'Content-Length': pdf.length,
    'Cache-Control': 'no-store',
  });
  res.send(pdf);
});


exports.createCheckout = asyncHandler(async (req, res) => {
  const invoice = await getAuthorizedInvoice(req);
  if (req.user.role !== 'client') throw new HttpError(403, 'Only the billed client can pay an invoice');
  if (invoice.status === 'Paid') throw new HttpError(409, 'Invoice already paid');


  const idempotencyKey = `checkout_${invoice.id}_${Math.floor(Date.now() / 60000)}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      customer_email: invoice.client.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: invoice.currency,
            unit_amount: invoice.amountCents,
            product_data: { name: `Invoice ${invoice.invoiceNumber}` },
          },
        },
      ],
      metadata: { invoiceId: invoice.id, clientId: invoice.client._id.toString() },
      payment_intent_data: { metadata: { invoiceId: invoice.id } },
      success_url: `${CLIENT_URL}/?paid=${invoice.id}#/invoices/${invoice.id}`,
      cancel_url: `${CLIENT_URL}/#/invoices/${invoice.id}`,
    },
    { idempotencyKey }
  );

  res.json({ url: session.url });
});