(() => {
  const $app = document.getElementById('app');
  const $ = (id) => document.getElementById(id);
  const state = { token: localStorage.getItem('token'), user: JSON.parse(localStorage.getItem('user') || 'null') };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const date = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const deletedTag = (c) => (c && c.deleted ? ' <small style="color:#dc2626">(deleted client)</small>' : '');

  function logout() {
    state.token = null; state.user = null;
    localStorage.removeItem('token'); localStorage.removeItem('user');
    location.hash = '#/login';
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}), ...opts.headers },
    });
    if (res.status === 401 && path !== '/auth/login') { logout(); throw new Error('Session expired'); }
    if (res.status === 403) { location.hash = '#/403'; throw new Error('Forbidden'); }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.message || 'Request failed');
      err.status = res.status;
      err.code = body.code;
      throw err;
    }
    return res;
  }
  const json = async (p, o) => (await api(p, o)).json();

  const shell = (inner) => `
    <header class="nav">
      <div class="logo">VaultPay <small style="font-weight:400;opacity:.7">· Nexus Corporate Services</small></div>
      <div><span>${esc(state.user.name)} (${esc(state.user.role)})</span><button id="logout" class="secondary">Logout</button></div>
    </header>
    <main>${inner}</main>`;
  const bindLogout = () => $('logout').addEventListener('click', logout);


  const pwField = (id, label) => `
    <label>${label}</label>
    <div class="pw">
      <input id="${id}" type="password" autocomplete="new-password" />
      <button type="button" class="eye" data-eye="${id}" aria-label="Show password" title="Show / hide password">👁</button>
    </div>`;

  function bindEyes(root = document) {
    root.querySelectorAll('[data-eye]').forEach((b) =>
      b.addEventListener('click', () => {
        const input = $(b.dataset.eye);
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.textContent = show ? '🙈' : '👁';
      })
    );
  }


  function pager(el, d, go) {
    if (!d.total) { el.innerHTML = ''; return; }
    el.innerHTML = `<span>${d.total} result${d.total === 1 ? '' : 's'}</span>
      <div class="actions">
        <button class="secondary sm" data-pg="prev" ${d.page <= 1 ? 'disabled' : ''}>← Prev</button>
        <span>Page ${d.page} of ${d.pages}</span>
        <button class="secondary sm" data-pg="next" ${d.page >= d.pages ? 'disabled' : ''}>Next →</button>
      </div>`;
    el.querySelector('[data-pg="prev"]').addEventListener('click', () => go(d.page - 1));
    el.querySelector('[data-pg="next"]').addEventListener('click', () => go(d.page + 1));
  }


  function renderLogin() {
    $app.innerHTML = `
      <div class="card center">
        <h2>Sign in to VaultPay</h2>
        <div id="err" class="error"></div>
        <label>Email</label><input id="email" type="email" autocomplete="username" />
        ${pwField('password', 'Password').replace('new-password', 'current-password')}
        <button id="loginBtn" style="width:100%;justify-content:center">Sign in</button>
      </div>`;
    bindEyes();
    const btn = $('loginBtn');
    const submit = async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const data = await json('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: $('email').value, password: $('password').value }),
        });
        state.token = data.token; state.user = data.user;
        localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
        location.hash = '#/';
      } catch (e) {
        $('err').textContent = e.message;
        btn.disabled = false;
      }
    };
    btn.addEventListener('click', submit);
    $('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  function render403() {
    $app.innerHTML = shell(`<div class="err403"><h1>403</h1><h2>Unauthorized</h2><p>You do not have permission to view this page.</p>
      <a class="btn" href="#/">Go back to my dashboard</a></div>`);
    bindLogout();
  }


  function openEditModal(c, onSaved) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `
      <div class="modal">
        <h3>Edit client</h3>
        <div id="edErr" class="error"></div>
        <label>Name</label><input id="edName" value="${esc(c.name)}" />
        <label>Company</label><input id="edCompany" value="${esc(c.company)}" />
        <label>Email (receipts are sent here)</label><input id="edEmail" type="email" value="${esc(c.email)}" />
        ${pwField('edPass', 'New password (leave blank to keep current)')}
        <div class="actions" style="justify-content:flex-end;margin-top:6px">
          <button id="edCancel" class="secondary">Cancel</button>
          <button id="edSave">Save changes</button>
        </div>
      </div>`;
    document.body.appendChild(bg);
    bindEyes(bg);
    const close = () => bg.remove();
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    bg.querySelector('#edCancel').addEventListener('click', close);
    bg.querySelector('#edSave').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const body = {
        name: bg.querySelector('#edName').value,
        company: bg.querySelector('#edCompany').value,
        email: bg.querySelector('#edEmail').value,
      };
      const pw = bg.querySelector('#edPass').value;
      if (pw) body.password = pw;
      try {
        await json(`/admin/clients/${c._id}`, { method: 'PATCH', body: JSON.stringify(body) });
        close();
        onSaved();
      } catch (err) {
        bg.querySelector('#edErr').textContent = err.message;
        e.target.disabled = false;
      }
    });
  }


  async function renderAdmin() {
    $app.innerHTML = shell(`
      <h1>Admin Dashboard</h1>
      <div class="grid" id="statsBox"></div>

      <div class="card"><h3>Create Invoice</h3><div id="invErr" class="error"></div>
        <label>Client (search by name, email or company)</label>
        <div class="picker">
          <input id="pickSearch" placeholder="Start typing to find a client…" autocomplete="off" />
          <div id="pickList" class="pick-list"></div>
        </div>
        <div id="picked" class="picked"></div>
        <div class="row">
          <div><label>Amount (USD)</label><input id="invAmount" type="number" min="1" step="0.01" /></div>
          <div><label>Due date</label><input id="invDue" type="date" /></div>
        </div>
        <label>Description of service</label><input id="invDesc" />
        <button id="invBtn">Create Invoice</button>
      </div>

      <div class="card"><h3>Add Client</h3><div id="cliErr" class="error"></div>
        <div class="row">
          <div><label>Name</label><input id="cName" /></div>
          <div><label>Company</label><input id="cCompany" /></div>
          <div><label>Email</label><input id="cEmail" type="email" /></div>
          <div>${pwField('cPass', 'Password (min 8)')}</div>
        </div>
        <button id="cliBtn">Add Client</button>
      </div>

      <div class="card"><h3>Clients</h3><div id="cliListErr" class="error"></div>
        <div class="toolbar"><input id="cSearch" placeholder="Search clients by name, email or company…" /></div>
        <table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th></th></tr></thead><tbody id="cBody"></tbody></table>
        <div id="cPager" class="pager"></div>
      </div>

      <div class="card"><h3>All Invoices</h3><div id="invListErr" class="error"></div>
        <div class="toolbar">
          <input id="iSearch" placeholder="Search by invoice # or client name, email, company…" />
          <select id="iStatus"><option value="">All statuses</option><option value="Pending">Pending</option><option value="Paid">Paid</option></select>
        </div>
        <table><thead><tr><th>Invoice #</th><th>Client</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody id="iBody"></tbody></table>
        <div id="iPager" class="pager"></div>
      </div>`);
    bindLogout();
    bindEyes();


    async function loadStats() {
      const s = await json('/admin/dashboard');
      $('statsBox').innerHTML = `
        <div class="stat"><small>Total Revenue</small><strong>${money(s.totalRevenueCents)}</strong></div>
        <div class="stat"><small>Outstanding</small><strong>${money(s.outstandingCents)}</strong></div>
        <div class="stat"><small>Paid / Pending</small><strong>${s.paidCount} / ${s.pendingCount}</strong></div>
        <div class="stat"><small>Clients</small><strong>${s.clientCount}</strong></div>`;
    }


    let picked = null;
    let pickData = [];
    const showPicked = () => {
      $('picked').innerHTML = picked
        ? `Selected: <strong>${esc(picked.name)}</strong> – ${esc(picked.company)} (${esc(picked.email)})`
        : '<span style="color:#6b7280">No client selected</span>';
    };
    const searchPicker = async () => {
      try {
        const { clients } = await json(`/admin/clients?search=${encodeURIComponent($('pickSearch').value)}&limit=6`);
        pickData = clients;
        $('pickList').innerHTML = clients.length
          ? clients.map((c) => `<button type="button" class="pick-item" data-pick="${c._id}">${esc(c.name)} – ${esc(c.company)}<small>${esc(c.email)}</small></button>`).join('')
          : '<div class="pick-empty">No matching clients</div>';
      } catch (e) { /* ignore */ }
    };
    $('pickSearch').addEventListener('input', debounce(searchPicker, 250));
    $('pickSearch').addEventListener('focus', searchPicker);
    $('pickList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      picked = pickData.find((c) => c._id === b.dataset.pick) || null;
      $('pickList').innerHTML = '';
      $('pickSearch').value = '';
      showPicked();
    });
    showPicked();


    const cq = { search: '', page: 1 };
    let cSeq = 0;
    async function loadClients() {
      const seq = ++cSeq;
      try {
        const d = await json(`/admin/clients?search=${encodeURIComponent(cq.search)}&page=${cq.page}&limit=10`);
        if (seq !== cSeq) return;
        if (!d.clients.length && d.total > 0 && cq.page > 1) { cq.page = d.pages; return loadClients(); }
        $('cliListErr').textContent = '';
        $('cBody').innerHTML = d.clients.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.company)}</td><td>${esc(c.email)}</td>
          <td><div class="actions"><button class="secondary sm" data-edit="${c._id}">Edit</button><button class="danger sm" data-del="${c._id}">Delete</button></div></td></tr>`).join('')
          || `<tr><td colspan="4" class="empty">${cq.search ? 'No clients match your search' : 'No clients yet'}</td></tr>`;
        pager($('cPager'), d, (p) => { cq.page = p; loadClients(); });

        $('cBody').querySelectorAll('[data-edit]').forEach((b) =>
          b.addEventListener('click', () => {
            const c = d.clients.find((x) => x._id === b.dataset.edit);
            if (c) openEditModal(c, () => { if (picked && picked._id === c._id) { picked = null; showPicked(); } loadClients(); loadInvoices(); });
          })
        );
        $('cBody').querySelectorAll('[data-del]').forEach((b) =>
          b.addEventListener('click', () => deleteClient(d.clients.find((x) => x._id === b.dataset.del), b))
        );
      } catch (e) { if (seq === cSeq) $('cliListErr').textContent = e.message; }
    }


    async function deleteClient(c, btn) {
      if (!c) return;
      if (!confirm(`Delete client ${c.name} (${c.email})?\n\nOnly the client profile is removed. Their invoices stay in the database.`)) return;
      btn.disabled = true;
      try {
        await json(`/admin/clients/${c._id}`, { method: 'DELETE' });
        if (picked && picked._id === c._id) { picked = null; showPicked(); }
        await Promise.all([loadStats(), loadClients(), loadInvoices()]);
      } catch (err) {
        $('cliListErr').textContent = err.message;
        btn.disabled = false;
      }
    }


    const iq = { search: '', status: '', page: 1 };
    let iSeq = 0;
    async function loadInvoices() {
      const seq = ++iSeq;
      try {
        const d = await json(`/invoices?search=${encodeURIComponent(iq.search)}&status=${iq.status}&page=${iq.page}&limit=10`);
        if (seq !== iSeq) return;
        if (!d.invoices.length && d.total > 0 && iq.page > 1) { iq.page = d.pages; return loadInvoices(); }
        $('invListErr').textContent = '';
        $('iBody').innerHTML = d.invoices.map((i) => `<tr><td>${esc(i.invoiceNumber)}</td><td>${esc(i.client?.name)}${deletedTag(i.client)}</td><td>${money(i.amountCents)}</td><td>${date(i.dueDate)}</td>
          <td><span class="badge ${i.status}">${i.status}</span></td>
          <td><div class="actions"><a href="#/invoices/${i.id}">View</a><button class="danger sm" data-delinv="${i.id}">Delete</button></div></td></tr>`).join('')
          || `<tr><td colspan="6" class="empty">${iq.search || iq.status ? 'No invoices match your search' : 'No invoices yet'}</td></tr>`;
        pager($('iPager'), d, (p) => { iq.page = p; loadInvoices(); });

        $('iBody').querySelectorAll('[data-delinv]').forEach((b) =>
          b.addEventListener('click', () => deleteInvoice(d.invoices.find((x) => x.id === b.dataset.delinv), b))
        );
      } catch (e) { if (seq === iSeq) $('invListErr').textContent = e.message; }
    }

    async function deleteInvoice(inv, btn) {
      if (!inv) return;
      let url = `/invoices/${inv.id}`;
      if (inv.status === 'Paid') {
        const typed = prompt(`⚠ ${inv.invoiceNumber} is PAID.\nDeleting it permanently erases the payment record from your database (the payment itself stays in Stripe).\n\nType the invoice number to confirm:\n${inv.invoiceNumber}`);
        if (typed === null) return;
        url += `?confirm=${encodeURIComponent(typed.trim())}`;
      } else if (!confirm(`Delete invoice ${inv.invoiceNumber}?\nThis permanently removes it from the database.`)) {
        return;
      }
      btn.disabled = true;
      try {
        await json(url, { method: 'DELETE' });
        await Promise.all([loadStats(), loadInvoices()]);
      } catch (err) {
        $('invListErr').textContent = err.message;
        btn.disabled = false;
      }
    }


    $('cSearch').addEventListener('input', debounce((e) => { cq.search = e.target.value; cq.page = 1; loadClients(); }));
    $('iSearch').addEventListener('input', debounce((e) => { iq.search = e.target.value; iq.page = 1; loadInvoices(); }));
    $('iStatus').addEventListener('change', (e) => { iq.status = e.target.value; iq.page = 1; loadInvoices(); });


    $('invBtn').addEventListener('click', async (e) => {
      e.target.disabled = true;
      $('invErr').textContent = '';
      try {
        if (!picked) throw new Error('Please select a client first');
        await json('/invoices', {
          method: 'POST',
          body: JSON.stringify({
            clientId: picked._id,
            amount: $('invAmount').value,
            dueDate: $('invDue').value,
            description: $('invDesc').value,
          }),
        });
        $('invAmount').value = ''; $('invDue').value = ''; $('invDesc').value = '';
        await Promise.all([loadStats(), loadInvoices()]);
      } catch (err) { $('invErr').textContent = err.message; }
      e.target.disabled = false;
    });


    $('cliBtn').addEventListener('click', async (e) => {
      e.target.disabled = true;
      $('cliErr').textContent = '';
      try {
        await json('/admin/clients', {
          method: 'POST',
          body: JSON.stringify({ name: $('cName').value, company: $('cCompany').value, email: $('cEmail').value, password: $('cPass').value }),
        });
        ['cName', 'cCompany', 'cEmail', 'cPass'].forEach((id) => ($(id).value = ''));
        await Promise.all([loadStats(), loadClients()]);
      } catch (err) { $('cliErr').textContent = err.message; }
      e.target.disabled = false;
    });

    await Promise.all([loadStats(), loadClients(), loadInvoices()]);
  }


  async function renderClient() {
    const { invoices } = await json('/invoices');
    const outstanding = invoices.filter((i) => i.status === 'Pending').reduce((s, i) => s + i.amountCents, 0);
    $app.innerHTML = shell(`
      <h1>My Billing</h1>
      <div class="grid"><div class="stat"><small>Outstanding balance</small><strong>${money(outstanding)}</strong></div>
      <div class="stat"><small>Total invoices</small><strong>${invoices.length}</strong></div></div>
      <div class="card">
        <div class="toolbar"><input id="mySearch" placeholder="Search by invoice number…" /></div>
        <table><thead><tr><th>Invoice #</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody id="myBody"></tbody></table>
      </div>`);
    bindLogout();

    const draw = (q = '') => {
      const list = invoices.filter((i) => i.invoiceNumber.toLowerCase().includes(q.toLowerCase().trim()));
      $('myBody').innerHTML = list.map((i) => `<tr><td>${esc(i.invoiceNumber)}</td><td>${money(i.amountCents)}</td><td>${date(i.dueDate)}</td>
        <td><span class="badge ${i.status}">${i.status}</span></td><td><a href="#/invoices/${i.id}">View</a></td></tr>`).join('')
        || `<tr><td colspan="5" class="empty">${q ? 'No invoices match' : 'No invoices'}</td></tr>`;
    };
    draw();
    $('mySearch').addEventListener('input', (e) => draw(e.target.value));
  }

  let paying = false; 

  async function renderInvoice(id) {
    const params = new URLSearchParams(location.search);
    let { invoice } = await json(`/invoices/${id}`);
    const returning = params.get('paid') === id;

    const draw = (banner = '') => {
      const canPay = state.user.role === 'client' && invoice.status === 'Pending';
      $app.innerHTML = shell(`
        <a href="#/">← Back</a>
        <div class="card" style="margin-top:12px">
          ${banner}
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2 style="margin:0">${esc(invoice.invoiceNumber)}</h2><span class="badge ${invoice.status}">${invoice.status}</span>
          </div>
          <p style="color:#6b7280">Billed to <strong>${esc(invoice.client?.name)}</strong>${deletedTag(invoice.client)} (${esc(invoice.client?.company)}) · Due ${date(invoice.dueDate)}${invoice.paidAt ? ' · Paid ' + date(invoice.paidAt) : ''}</p>
          <table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${invoice.items.map((it) => `<tr><td>${esc(it.description)}</td><td style="text-align:right">${money(it.amountCents)}</td></tr>`).join('')}
            <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${money(invoice.amountCents)}</strong></td></tr></tbody></table>
          <div style="margin-top:20px;display:flex;gap:10px">
            ${canPay ? '<button id="payBtn">Pay Invoice</button>' : ''}
            <button id="pdfBtn" class="secondary">Download PDF</button>
          </div>
        </div>`);
      bindLogout();

      const payBtn = $('payBtn');
      if (payBtn) payBtn.addEventListener('click', async () => {
        if (paying) return;
        paying = true;
        payBtn.disabled = true;
        payBtn.innerHTML = '<span class="spinner"></span> Redirecting to secure checkout…';
        try {
          const { url } = await json(`/invoices/${id}/checkout`, { method: 'POST' });
          location.href = url; 
        } catch (e) {
          alert(e.message);
          paying = false; payBtn.disabled = false; payBtn.textContent = 'Pay Invoice';
        }
      });

      $('pdfBtn').addEventListener('click', async (e) => {
        e.target.disabled = true;
        try {
          const res = await api(`/invoices/${id}/pdf`);
          const blob = await res.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${invoice.status === 'Paid' ? 'Receipt' : 'Invoice'}-${invoice.invoiceNumber}.pdf`;
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(a.href);
        } catch (err) { alert(err.message); }
        e.target.disabled = false;
      });
    };

    if (returning && invoice.status !== 'Paid') {
      draw('<div class="notice">Payment received – confirming with the bank…</div>');
      for (let i = 0; i < 10 && invoice.status !== 'Paid'; i++) { // webhook is the source of truth; poll for it
        await new Promise((r) => setTimeout(r, 2000));
        ({ invoice } = await json(`/invoices/${id}`));
      }
    }
    draw(returning && invoice.status === 'Paid' ? '<div class="notice" style="background:#f0fdf4;border-color:#bbf7d0">✅ Payment confirmed. A receipt has been emailed to you.</div>' : '');
  }


  
  async function router() {
    try {
      const h = location.hash.slice(1) || '/';
      if (h === '/login') return renderLogin();
      if (!state.user) { location.hash = '#/login'; return; }
      if (h === '/403') return render403();
      if (h.startsWith('/admin') && state.user.role !== 'admin') { location.hash = '#/403'; return; }
      if (h === '/') { location.hash = state.user.role === 'admin' ? '#/admin/dashboard' : '#/dashboard'; return; }
      if (h === '/admin/dashboard') return await renderAdmin();
      if (h === '/dashboard') {
        if (state.user.role === 'admin') { location.hash = '#/admin/dashboard'; return; }
        return await renderClient();
      }
      const m = h.match(/^\/invoices\/([a-f0-9]{24})$/);
      if (m) return await renderInvoice(m[1]);
      location.hash = '#/';
    } catch (e) {
      if (e.message !== 'Forbidden' && e.message !== 'Session expired') {
        $app.innerHTML = shell(`<div class="card"><h3>Something went wrong</h3><p>${esc(e.message)}</p><a href="#/">Back</a></div>`);
        bindLogout();
      }
    }
  }

  window.addEventListener('hashchange', router);
  router();
})();