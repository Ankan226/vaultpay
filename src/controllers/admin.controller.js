const mongoose = require('mongoose');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const { HttpError, asyncHandler } = require('../middleware/error');
const { searchRegex, parsePaging } = require('../utils/search');

const publicClient = (c) => ({ id: c.id, name: c.name, email: c.email, company: c.company });

exports.dashboard = asyncHandler(async (req, res) => {
  const [stats, clientCount] = await Promise.all([
    Invoice.aggregate([{ $group: { _id: '$status', total: { $sum: '$amountCents' }, count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'client' }),
  ]);
  const by = (s) => stats.find((x) => x._id === s) || { total: 0, count: 0 };
  res.json({
    totalRevenueCents: by('Paid').total,
    outstandingCents: by('Pending').total,
    paidCount: by('Paid').count,
    pendingCount: by('Pending').count,
    clientCount,
  });
});


exports.listClients = asyncHandler(async (req, res) => {
  const rx = searchRegex(req.query.search);
  const filter = { role: 'client' };
  if (rx) filter.$or = [{ name: rx }, { email: rx }, { company: rx }];

  const { page, limit, skip } = parsePaging(req.query, 10);
  const [clients, total] = await Promise.all([
    User.find(filter).sort('name').skip(skip).limit(limit).select('name email company createdAt'),
    User.countDocuments(filter),
  ]);
  res.json({ clients, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

exports.createClient = asyncHandler(async (req, res) => {
  const { name, email, company, password } = req.body;
  if (!name || !email || !password) throw new HttpError(400, 'name, email and password are required');
  if (String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (await User.findOne({ email: String(email).toLowerCase().trim() })) throw new HttpError(409, 'Email already registered');


  const client = await User.create({ name, email, company, password, role: 'client' });
  res.status(201).json({ client: publicClient(client) });
});


exports.updateClient = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid client id');
  const client = await User.findOne({ _id: req.params.id, role: 'client' });
  if (!client) throw new HttpError(404, 'Client not found');

  const { name, email, company, password } = req.body;

  if (name !== undefined) {
    if (!String(name).trim()) throw new HttpError(400, 'Name cannot be empty');
    client.name = String(name).trim();
  }
  if (email !== undefined) {
    const e = String(email).toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) throw new HttpError(400, 'Invalid email address');
    if (e !== client.email && (await User.findOne({ email: e }))) throw new HttpError(409, 'Email already registered');
    client.email = e;
  }
  if (company !== undefined) client.company = String(company).trim();
  if (password) {
    if (String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    client.password = String(password);
  }

  await client.save();
  res.json({ client: publicClient(client) });
});


exports.deleteClient = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid client id');
  const client = await User.findOne({ _id: req.params.id, role: 'client' });
  if (!client) throw new HttpError(404, 'Client not found');

  await Invoice.updateMany(
    { client: client._id },
    { $set: { clientSnapshot: { name: client.name, email: client.email, company: client.company } } }
  );
  const kept = await Invoice.countDocuments({ client: client._id });
  await client.deleteOne();
  res.json({ message: 'Client deleted', invoicesKept: kept });
});