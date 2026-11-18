# VaultPay Financial Core

Secure B2B invoicing portal for **Nexus Corporate Services** (Client: Evelyn Croft, CFO).
Admins create invoices, clients log in and pay through Stripe Checkout, the server confirms payment through a **signed webhook**, generates a **PAID PDF receipt** and **emails it automatically**.

| | |
|---|---|
| Live app | `https://vaultpay-xlc6.onrender.com` |
| GitHub | `https://github.com/Ankan226/vaultpay` |

---

## Features

**Admin**
- Dashboard: total revenue, outstanding balance, paid/pending counts, client count
- Create invoices (live client search, so it scales to thousands of clients)
- Add, edit and delete clients (name, company, email, password)
- Search invoices by invoice number or client name/email/company, filter by status, paginated
- Delete invoices (paid invoices require typing the exact invoice number)

**Client**
- Log in with their own email and password
- See only their own invoices, search by invoice number
- Pay an invoice with Stripe Checkout (pay button locks immediately, shows a spinner)
- Download the invoice or receipt as a PDF
- Receive the PDF receipt by email after payment

**Platform**
- Route guards: a client opening `/#/admin/dashboard` gets a 403 page
- Show/hide eye on every password field

---

## Tech stack

Node.js 18+, Express 4, MongoDB (Mongoose), JSON Web Tokens, bcryptjs, Stripe, PDFKit, Nodemailer, Helmet, express-rate-limit. The UI is plain HTML/CSS/JavaScript served by Express from `/public`.

---

## Security design

| Threat | Protection |
|---|---|
| Unauthenticated access | `protect` middleware verifies the JWT on every protected route and loads the user from the database |
| Privilege escalation | Role is read from the database, never from the token or request body. There is no public registration; client accounts are created only by an admin, and the role is hard-coded to `client` |
| Client calling admin routes | `restrictTo('admin')` returns **403** |
| **IDOR** (reading another client's invoice) | `getAuthorizedInvoice()` checks `invoice.client === req.user.id` and returns **403** otherwise. Used by invoice detail, PDF download and checkout. The client invoice list is filtered by `client: req.user._id` inside the query |
| Amount tampering | The Stripe amount always comes from the database, never from the request |
| Spoofed payments | The webhook reads the **raw body** and calls `stripe.webhooks.constructEvent` to verify Stripe's signature (invalid signature → **400**). The paid amount and currency are re-checked against the invoice |
| Duplicate webhooks / retries | Atomic `findOneAndUpdate` on `status: { $ne: 'Paid' }` means only the first delivery flips Pending → Paid and sends the receipt |
| Double-click double-charge | Frontend lock and disabled button, plus a server-side Stripe idempotency key |
| Password theft | bcrypt (12 rounds); passwords are `select: false` in queries |
| Brute force | Login rate limit (20 attempts / 15 min / IP) and a generic "Invalid credentials" message |
| Injection | Search input is regex-escaped; request body size limited; Helmet headers |
| Leaked secrets | All secrets live in environment variables; `.env` is git-ignored |

### Deleting clients and invoices
- **Deleting a client** removes only the client profile. Their invoices stay in the database, with a copy of the client's name, email and company saved on each invoice (shown as "deleted client"). That deleted client can no longer log in.
- **Deleting an invoice** removes only that invoice. Deleting a *paid* invoice erases the database record but not the payment in Stripe.

---

## Project structure

```
vaultpay/
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── Prompts.md
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── src/
    ├── server.js
    ├── app.js
    ├── config/        
    ├── models/        
    ├── middleware/    
    ├── controllers/   
    ├── routes/        
    ├── services/      
    ├── utils/         
    └── scripts/       
```

---

## API reference

All routes except login and the webhook require `Authorization: Bearer <token>`.

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/api/health` | public | Health check |
| POST | `/api/auth/login` | public | Log in, returns JWT |
| GET | `/api/auth/me` | any user | Current user |
| GET | `/api/admin/dashboard` | admin | Revenue and counts |
| GET | `/api/admin/clients?search=&page=&limit=` | admin | List/search clients |
| POST | `/api/admin/clients` | admin | Create client |
| PATCH | `/api/admin/clients/:id` | admin | Edit client |
| DELETE | `/api/admin/clients/:id` | admin | Delete client profile (invoices kept) |
| GET | `/api/invoices?search=&status=&page=&limit=` | admin: all, client: own only | List/search invoices |
| POST | `/api/invoices` | admin | Create invoice |
| GET | `/api/invoices/:id` | owner or admin | Invoice detail (403 if not owner) |
| GET | `/api/invoices/:id/pdf` | owner or admin | Invoice or receipt PDF |
| POST | `/api/invoices/:id/checkout` | owning client | Create Stripe Checkout session |
| DELETE | `/api/invoices/:id` | admin | Delete invoice (`?confirm=<invoice number>` if paid) |
| POST | `/api/webhooks/stripe` | Stripe only (signature-verified) | Payment fulfilment |

---

## Run locally

### 1. Install

```bash
git clone https://github.com/Ankan226/vaultpay
cd vaultpay
npm install
cp .env.example .env        
```

### 2. Configure `.env`

| Variable | Description |
|---|---|
| `MONGO_URI` | Atlas connection string ending in `/vaultpay` |
| `JWT_SECRET` | Long random string |
| `JWT_EXPIRES_IN` | Token lifetime, default `1d` |
| `CLIENT_URL` | Public URL of the app, for example `http://localhost:5000` |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (see step 4) |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.gmail.com` / `465` |
| `SMTP_USER` / `SMTP_PASS` | Gmail address and the 16-character App Password |
| `MAIL_FROM` | `"Nexus Corporate Services <you@gmail.com>"` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Demo admin login |
| `SEED_CLIENT_EMAIL` / `SEED_CLIENT_PASSWORD` | Demo client login, use an inbox you can open |

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Seed demo users

```bash
npm run seed
```

### 4. Forward Stripe webhooks (separate terminal)

```bash
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:5000/api/webhooks/stripe
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

> Newer Stripe CLI versions require `--events`, otherwise `stripe listen` exits with an error.

### 5. Run

```bash
npm run dev      
npm start        
```

Open **http://localhost:5000**.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@nexus.test` | `Admin@12345` |
| Client | your `SEED_CLIENT_EMAIL` | `Client@12345` |

Change these before sharing any public deployment.

### Test card

`4242 4242 4242 4242` · any future expiry · any CVC · any ZIP

---

## Security tests (Postman)

| Test | Expected |
|---|---|
| Client token → `GET /api/admin/dashboard` | 403 |
| Client A token → `GET /api/invoices/<Client B's invoice>` | 403 |
| Client A token → `GET /api/invoices/<own invoice>` (control) | 200 |
| No token → `GET /api/invoices` | 401 |
| `POST /api/webhooks/stripe` without a valid signature | 400 |
| Client token → `DELETE /api/invoices/:id` | 403 |
| Client token → `POST /api/invoices` | 403 |

---

## Deployment (Render)

1. Push to GitHub (make sure `.env` is **not** committed).
2. Create a Render **Web Service** from the repo. Build command `npm install`, start command `npm start`.
3. Add every variable from `.env` in Render's Environment tab, and set `CLIENT_URL` to the Render URL.
4. In the Stripe Dashboard → Developers → Webhooks, add `https://<your-app>.onrender.com/api/webhooks/stripe` with events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
5. Put that endpoint's **signing secret** in `STRIPE_WEBHOOK_SECRET` (it differs from the CLI secret), then redeploy.
6. Run `npm run seed` once against the production database.

> **Email on free hosting:** some free hosting tiers block outbound SMTP ports. If receipts fail with a connection timeout in production, switch `email.service.js` to an HTTPS email API (for example Resend or Brevo). The payment is recorded either way.

---

## Author

**Ankan Pal**
