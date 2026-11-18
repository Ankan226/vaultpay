## 1. Prompts and outcomes

| # | Area | What I asked | What AI produced | What I did / verified |
|---|------|--------------|------------------|-----------------------|
| 1 | Architecture | Pasted the Prodesk brief and asked for a folder structure and file-wise code for the Full Stack track | Express + MongoDB + Stripe structure, models, routes, controllers, and a small vanilla-JS frontend | Created all files, installed dependencies, ran the app locally |
| 2 | Zero-Trust API / IDOR | Brief requirement 1: JWT on every route and ownership checks | `protect` and `restrictTo` middleware, and a single `getAuthorizedInvoice()` function used by detail, PDF and checkout | Tested in Postman: client token on admin route returns 403, Client A on Client B's invoice returns 403, no token returns 401 |
| 3 | Stripe webhook | Verify the signature and mark invoices paid only from the webhook | `webhook.controller.js` using `stripe.webhooks.constructEvent` on the raw body, amount re-check, and an atomic idempotent `Pending → Paid` update. Webhook route mounted before `express.json()` | Ran the Stripe CLI forwarder, paid with test card 4242, saw the event delivered with 200 and the invoice flip to Paid. Fake unsigned request returns 400 |
| 4 | PDF receipt | Generate a PDF with a logo and PAID stamp | `pdf.service.js` using PDFKit: vector "N" logo, items table, rotated PAID stamp, payment reference | Opened the PDF received by email and checked the layout and stamp |
| 5 | Email delivery | Email the PDF automatically | `email.service.js` using Nodemailer with a Gmail App Password | Created the App Password, received the receipt in my inbox |
| 6 | Checkout double-click | Prevent double charges | Frontend lock plus disabled button and spinner, and a server-side Stripe idempotency key | Clicked the button and saw it disable immediately |
| 7 | Admin features | Show/hide password eye, edit client, delete client | Edit modal, `PATCH` and `DELETE` client routes, password toggle | Used all three from the dashboard |
| 8 | Search and pagination | Search for many clients and invoices, delete invoices, deletes should remove from Atlas | Server-side regex search with escaping, pagination, a client picker, invoice delete (paid ones need a typed confirmation) | Checked that deleted documents disappear in Atlas Browse Collections |
| 9 | Delete behavior | Delete a client without deleting their invoices | Saves a `clientSnapshot` on invoices before deleting the client, and shows "(deleted client)" | Deleted a client and confirmed the invoices stayed |
| 10 | Postman | Step-by-step setup of the security tests | Postman requests, environment variables and post-response scripts | Built the requests and ran them against my local server |
| 11 | Git, README, video script | Git commit commands, README and demo script | Commit-by-commit commands, README and the recording script | Edited with my own names and links |

---

## 2. Debugging with AI

| Problem | Cause | Fix |
|---|---|---|
| `stripe` not recognized after install | Windows terminal had the old PATH | Refreshed PATH in the session and reopened the terminal |
| `stripe listen` error: "must specify events" | Newer Stripe CLI requires `--events` | Added `--events checkout.session.completed,checkout.session.async_payment_succeeded` |
| Receipt sent but "Address not found" bounce | The client's email in the database was not a real address | Corrected the email through the new Edit client feature. The code was working correctly |
| Server crash: `Route.put() requires a callback function` | `invoice.routes.js` had a `router.put(... c.update)` line that I had added, but the controller had no `update` function | Removed the line |
| Postman IDOR test returned 200 / 404 | Invoice ID variables were empty, so the URL became `/api/invoices/` | Created a second client with an invoice and re-ran the "List invoices" request to fill the variables |
| Real keys ended up in `.env.example` | I had typed them into the wrong file | Restored placeholders in `.env.example`; real values only live in `.env` (git-ignored) |