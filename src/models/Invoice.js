const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    amountCents: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'usd' },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending', index: true },
    paidAt: Date,
    stripeSessionId: String,
    stripePaymentIntentId: String,
    emailSent: { type: Boolean, default: false },
    clientSnapshot: { name: String, email: String, company: String }, 
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);