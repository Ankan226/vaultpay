const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { CLIENT_URL } = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: CLIENT_URL }));


app.use('/api/webhooks', require('./routes/webhook.routes'));

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/invoices', require('./routes/invoice.routes'));


app.use('/api', notFound);


app.use(express.static(path.join(__dirname, '../public')));

app.use(errorHandler);

module.exports = app;