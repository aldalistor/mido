const labels = {
  dashboard: 'لوحة التحكم', journal: 'القيود اليومية', accounts: 'دليل الحسابات',
  reports: 'التقارير المالية', sales: 'المبيعات', purchases: 'المشتريات',
  inventory: 'المخزون', contacts: 'العملاء والموردون', security: 'المستخدمون والصلاحيات'
};

const seed = {
  accounts: [
    { code: '1101', name: 'الصندوق الرئيسي', type: 'أصل', balance: 24500 },
    { code: '1102', name: 'البنك العربي', type: 'أصل', balance: 101990 },
    { code: '1201', name: 'العملاء', type: 'أصل', balance: 58320 },
    { code: '2101', name: 'الموردون', type: 'التزام', balance: 36750 },
    { code: '4101', name: 'إيرادات المبيعات', type: 'إيراد', balance: 184250 },
    { code: '5101', name: 'المصروفات التشغيلية', type: 'مصروف', balance: 42180 }
  ],
  entries: [
    { no: 'JV-0001', date: '2024-09-24', description: 'إثبات فاتورة مبيعات', debit: 12500, credit: 12500, status: 'مرحّل' },
    { no: 'JV-0002', date: '2024-09-23', description: 'فاتورة مشتريات آجلة', debit: 4280, credit: 4280, status: 'مسودة' }
  ],
  invoices: [
    { ref: 'INV-1048', kind: 'مبيعات', party: 'شركة الرواد للتجارة', total: 12500, date: '2024-09-24' },
    { ref: 'PUR-0286', kind: 'مشتريات', party: 'مؤسسة الإمداد', total: 4280, date: '2024-09-23' }
  ],
  items: [
    { code: 'I-001', name: 'حاسب محمول', unit: 'قطعة', qty: 18, cost: 2200, sale: 3100 },
    { code: 'I-002', name: 'شاشة مكتبية', unit: 'قطعة', qty: 26, cost: 650, sale: 890 }
  ],
  contacts: [
    { code: 'C-001', name: 'شركة الرواد للتجارة', type: 'عميل', phone: '0500000000', email: 'sales@rowad.test' },
    { code: 'V-001', name: 'مؤسسة الإمداد', type: 'مورد', phone: '0550000000', email: 'supply@emdad.test' }
  ],
  users: [{ username: 'admin', displayNameAr: 'مدير النظام', role: 'مدير النظام' }]
};

const state = Object.assign({}, seed, JSON.parse(localStorage.getItem('onyx-state') || '{}'));
for (const key of Object.keys(seed)) if (!Array.isArray(state[key])) state[key] = seed[key];
const save = () => localStorage.setItem('onyx-state', JSON.stringify(state));
const money = value => `${Number(value || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ر.س`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const $ = id => document.getElementById(id);
const toast = $('toast');
let dataMode = 'detecting';

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function today() {
  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(new Date());
}

document.querySelector('.top-date').textContent = today();

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  document.querySelectorAll('.view').forEach(item => item.classList.remove('active-view'));
  const target = $(view === 'dashboard' ? 'dashboard-view' : 'generic-view');
  target.classList.add('active-view');
  $('page-title').textContent = labels[view] || 'الوحدة';
  $('generic-title').textContent = labels[view] || 'الوحدة';
  if (view === 'security') renderSecurity();
  else if (view !== 'dashboard') renderModule(view);
  if (view !== 'dashboard' && dataMode === 'oracle') setTimeout(() => loadLiveRows(view), 0);
}

function localRows(view) {
  if (view === 'journal') return state.entries.map(e => [e.no, e.date, e.description, money(e.debit), money(e.credit), `<span class="status ${e.status === 'مرحّل' ? 'paid' : 'pending'}">${e.status}</span>`]);
  if (view === 'accounts') return state.accounts.map(a => [a.code, a.name, a.type, money(a.balance)]);
  if (view === 'sales') return state.invoices.filter(i => i.kind === 'مبيعات').map(i => [i.ref, i.party, i.date, money(i.total), '<span class="status paid">مكتملة</span>']);
  if (view === 'purchases') return state.invoices.filter(i => i.kind === 'مشتريات').map(i => [i.ref, i.party, i.date, money(i.total), '<span class="status pending">مسودة</span>']);
  if (view === 'inventory') return state.items.map(i => [i.code, i.name, i.unit, i.qty, money(i.cost)]);
  if (view === 'contacts') return state.contacts.map(c => [c.code, c.name, c.type, c.phone || '—']);
  return [['قائمة الدخل', 'الشهر الحالي', 'جاهز'], ['ميزان المراجعة', 'الشهر الحالي', 'جاهز'], ['أعمار الذمم', 'الشهر الحالي', 'جاهز']];
}

function renderRows(rows) {
  return rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('') : '<tr><td colspan="8" class="empty-cell">لا توجد سجلات بعد. أضف أول سجل من الزر أعلاه.</td></tr>';
}

function renderModule(view) {
  const configs = {
    journal: { action: 'قيد جديد', columns: ['الرقم', 'التاريخ', 'البيان', 'مدين', 'دائن', 'الحالة'] },
    accounts: { action: 'حساب جديد', columns: ['الرمز', 'اسم الحساب', 'النوع', 'الرصيد'] },
    sales: { action: 'فاتورة مبيعات', columns: ['المرجع', 'العميل', 'التاريخ', 'الإجمالي', 'الحالة'] },
    purchases: { action: 'فاتورة مشتريات', columns: ['المرجع', 'المورد', 'التاريخ', 'الإجمالي', 'الحالة'] },
    inventory: { action: 'إضافة صنف', columns: ['الرمز', 'الصنف', 'الوحدة', 'الكمية', 'سعر التكلفة'] },
    contacts: { action: 'إضافة جهة', columns: ['الرمز', 'الاسم', 'النوع', 'الهاتف'] },
    reports: { action: 'تحديث التقارير', columns: ['التقرير', 'الفترة', 'الحالة'] }
  };
  const config = configs[view] || configs.reports;
  const rows = localRows(view);
  $('generic-content').innerHTML = `<div class="module-toolbar"><div><p class="eyebrow">إدارة ${esc(labels[view])}</p><h2>${esc(labels[view])}</h2></div><button class="primary-button" id="module-action">＋ ${esc(config.action)}</button></div><div class="panel module-panel"><div class="table-tools"><input id="module-search" placeholder="ابحث في ${esc(labels[view])}..." /><span>${rows.length} سجل${dataMode === 'demo' ? ' · تجريبي' : ''}</span></div><div class="table-scroll"><table><thead><tr>${config.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody id="module-body">${renderRows(rows)}</tbody></table></div></div>`;
  $('module-action').addEventListener('click', () => view === 'reports' ? showToast('تم تحديث التقارير التجريبية') : openForm(view));
  $('module-search').addEventListener('input', event => {
    const q = event.target.value.toLowerCase();
    $('module-body').innerHTML = renderRows(rows.filter(row => row.join(' ').toLowerCase().includes(q)));
  });
}

function openForm(view) {
  const titles = { journal: 'قيد يومية جديد', accounts: 'إضافة حساب', sales: 'فاتورة مبيعات جديدة', purchases: 'فاتورة مشتريات جديدة', inventory: 'إضافة صنف جديد', contacts: 'إضافة جهة اتصال' };
  const form = $('form-modal');
  $('modal-title').textContent = titles[view] || 'سجل جديد';
  const fields = {
    journal: [['description', 'البيان'], ['debitAccount', 'الحساب المدين'], ['creditAccount', 'الحساب الدائن'], ['amount', 'المبلغ', 'number']],
    accounts: [['code', 'رمز الحساب'], ['name', 'اسم الحساب'], ['type', 'نوع الحساب']],
    inventory: [['code', 'رمز الصنف'], ['name', 'اسم الصنف'], ['unit', 'الوحدة'], ['qty', 'الكمية', 'number'], ['cost', 'سعر التكلفة', 'number'], ['sale', 'سعر البيع', 'number']],
    contacts: [['code', 'رمز الجهة'], ['name', 'اسم الجهة'], ['type', 'النوع (عميل/مورد)'], ['phone', 'الهاتف'], ['email', 'البريد الإلكتروني']],
    sales: [['party', 'اسم العميل'], ['itemCode', 'رمز الصنف'], ['quantity', 'الكمية', 'number'], ['unitPrice', 'سعر البيع', 'number']],
    purchases: [['party', 'اسم المورد'], ['itemCode', 'رمز الصنف'], ['quantity', 'الكمية', 'number'], ['unitPrice', 'سعر الشراء', 'number']]
  }[view] || [['name', 'الاسم']];
  $('modal-fields').innerHTML = fields.map(([name, label, type = 'text']) => `<label>${label}<input name="${name}" type="${type}" step="0.01" required /></label>`).join('');
  form.dataset.view = view;
  form.classList.add('open');
}

function closeForm() { $('form-modal').classList.remove('open'); }
$('modal-close').addEventListener('click', closeForm);
$('modal-cancel').addEventListener('click', closeForm);

async function submitLocal(view, data) {
  const date = new Date().toISOString().slice(0, 10);
  if (view === 'journal') {
    const amount = Number(data.amount);
    if (!data.description || !data.debitAccount || !data.creditAccount || amount <= 0) throw new Error('أكمل بيانات القيد بمبلغ صحيح.');
    state.entries.unshift({ no: `JV-${String(state.entries.length + 1).padStart(4, '0')}`, date, description: data.description, debit: amount, credit: amount, status: 'مسودة' });
  } else if (view === 'accounts') {
    if (state.accounts.some(a => a.code === data.code)) throw new Error('رمز الحساب مستخدم مسبقًا.');
    state.accounts.push({ code: data.code, name: data.name, type: data.type, balance: 0 });
  } else if (view === 'inventory') {
    if (state.items.some(i => i.code === data.code)) throw new Error('رمز الصنف مستخدم مسبقًا.');
    state.items.push({ code: data.code, name: data.name, unit: data.unit, qty: Number(data.qty), cost: Number(data.cost), sale: Number(data.sale) });
  } else if (view === 'contacts') {
    if (state.contacts.some(c => c.code === data.code)) throw new Error('رمز الجهة مستخدم مسبقًا.');
    state.contacts.push({ code: data.code, name: data.name, type: data.type.includes('مورد') ? 'مورد' : 'عميل', phone: data.phone, email: data.email });
  } else if (view === 'sales' || view === 'purchases') {
    const quantity = Number(data.quantity); const price = Number(data.unitPrice);
    if (quantity <= 0 || price < 0) throw new Error('أدخل كمية وسعرًا صحيحين.');
    state.invoices.unshift({ ref: `${view === 'sales' ? 'INV' : 'PUR'}-${String(state.invoices.length + 1).padStart(4, '0')}`, kind: view === 'sales' ? 'مبيعات' : 'مشتريات', party: data.party, total: quantity * price, date });
    const item = state.items.find(i => i.code === data.itemCode);
    if (item && view === 'sales') item.qty = Math.max(0, Number(item.qty) - quantity);
    if (item && view === 'purchases') item.qty = Number(item.qty) + quantity;
  }
  save();
}

$('entry-form').addEventListener('submit', async event => {
  event.preventDefault();
  const view = event.currentTarget.dataset.view;
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    if (dataMode === 'oracle' && window.onyxAPI) {
      if (view === 'accounts') await window.onyxAPI.createAccount({ code: data.code, name: data.name, type: data.type });
      else if (view === 'inventory') await window.onyxAPI.createItem({ code: data.code, name: data.name, unit: data.unit, quantity: data.qty, cost: data.cost, sale: data.sale });
      else if (view === 'contacts') await window.onyxAPI.createContact({ code: data.code, name: data.name, type: data.type.includes('مورد') ? 'VENDOR' : 'CUSTOMER', phone: data.phone, email: data.email });
      else if (view === 'journal') await window.onyxAPI.createJournal({ description: data.description, lines: [{ accountCode: data.debitAccount, debit: Number(data.amount), credit: 0 }, { accountCode: data.creditAccount, debit: 0, credit: Number(data.amount) }] });
      else if (view === 'sales' || view === 'purchases') await window.onyxAPI.createInvoice({ type: view === 'sales' ? 'SALE' : 'PURCHASE', contactCode: data.party, lines: [{ itemCode: data.itemCode, quantity: Number(data.quantity), unitPrice: Number(data.unitPrice) }] });
    } else {
      await submitLocal(view, data);
    }
    closeForm(); renderModule(view); refreshDashboardMetrics(); showToast(dataMode === 'demo' ? 'تم الحفظ في الوضع التجريبي' : 'تم حفظ السجل بنجاح');
  } catch (error) {
    if (dataMode === 'oracle') { dataMode = 'demo'; await submitLocal(view, data); closeForm(); renderModule(view); showToast('تعذر الاتصال بـ Oracle؛ تم الحفظ في الوضع التجريبي'); }
    else showToast(error.message);
  }
});

document.querySelectorAll('[data-view]').forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));
$('new-entry').addEventListener('click', () => { switchView('journal'); setTimeout(() => openForm('journal'), 0); });
$('generic-action').addEventListener('click', () => openForm('journal'));
document.querySelectorAll('.quick-actions button').forEach(button => button.addEventListener('click', () => { switchView(button.dataset.view); setTimeout(() => { if (button.dataset.view !== 'dashboard') openForm(button.dataset.view); }, 0); }));
document.querySelector('.text-button').addEventListener('click', () => switchView('journal'));
document.querySelector('.notification').addEventListener('click', () => showToast('لا توجد إشعارات جديدة'));
document.querySelector('.icon-button').addEventListener('click', () => showToast('استخدم البحث داخل كل وحدة للوصول السريع'));

function setDemoMode() {
  dataMode = 'demo';
  const status = $('db-status');
  status.classList.remove('checking', 'connected'); status.classList.add('demo'); status.innerHTML = '<i></i> وضع تجريبي';
  $('login-subtitle').textContent = 'وضع تجريبي جاهز للتجربة دون Oracle';
}

async function refreshDbStatus() {
  const status = $('db-status');
  if (!status) return false;
  if (dataMode === 'demo') { status.classList.add('demo'); status.innerHTML = '<i></i> وضع تجريبي'; return false; }
  if (!window.onyxAPI?.dbTest) { setDemoMode(); return false; }
  status.classList.add('checking'); status.innerHTML = '<i></i> جارٍ الاتصال';
  try {
    const info = await window.onyxAPI.dbTest();
    dataMode = 'oracle'; status.classList.remove('checking', 'demo'); status.classList.add('connected'); status.innerHTML = `<i></i> Oracle: ${esc(info.DB_USER)}`;
    return true;
  } catch (error) { setDemoMode(); console.warn('Oracle connection unavailable:', error.message); return false; }
}

async function loadLiveRows(view) {
  if (dataMode !== 'oracle' || !window.onyxAPI) return;
  try {
    let rows = [];
    if (view === 'accounts') { try { rows = await window.onyxAPI.modernAccounts($('module-search')?.value || ''); } catch (_) { rows = await window.onyxAPI.accounts($('module-search')?.value || ''); } }
    if (view === 'contacts') { try { rows = await window.onyxAPI.modernContacts($('module-search')?.value || ''); } catch (_) { rows = await window.onyxAPI.customers($('module-search')?.value || ''); } }
    if (view === 'inventory') rows = await window.onyxAPI.modernItems($('module-search')?.value || '');
    if (view === 'journal') rows = await window.onyxAPI.journal(50);
    if (!rows.length || !$('module-body')) return;
    const mapped = view === 'accounts' ? rows.map(a => [a.ACCOUNT_CODE || a.A_CODE, a.ACCOUNT_NAME_AR || a.A_NAME, a.ACCOUNT_TYPE || a.A_LEVEL || '', money(a.OPENING_BALANCE ?? a.DR)]) : view === 'contacts' ? rows.map(c => [c.CODE || c.C_CODE || '', c.NAME_AR || c.C_A_NAME || '', c.CONTACT_TYPE || 'CUSTOMER', c.PHONE || c.C_PHONE || c.C_MOBILE || '']) : view === 'inventory' ? rows.map(i => [i.ITEM_CODE, i.ITEM_NAME_AR, i.UNIT_NAME, i.QUANTITY, money(i.COST_PRICE)]) : rows.map(j => [j.DOC_NO || j.JV_NO || '', j.DOC_DATE || j.AD_DATE || '', j.DOC_DESC || j.DESCRIPTION || '', money(j.DEBIT || j.DR), money(j.CREDIT || j.CR), '<span class="status paid">مستورد</span>']);
    $('module-body').innerHTML = renderRows(mapped);
    const count = document.querySelector('.table-tools span'); if (count) count.textContent = `${rows.length} سجل من Oracle`;
  } catch (error) { console.warn('Oracle module read unavailable:', error.message); }
}

async function refreshDashboardMetrics() {
  const cards = document.querySelectorAll('.metric-card>strong');
  if (dataMode === 'oracle' && window.onyxAPI?.dashboard) {
    try {
      const data = await window.onyxAPI.dashboard();
      if (cards[0]) cards[0].innerHTML = `${Number(data.journals || 0).toLocaleString('ar-SA')} <small>عملية</small>`;
      if (cards[1]) cards[1].innerHTML = `${Number(data.accounts || 0).toLocaleString('ar-SA')} <small>حساب</small>`;
      if (cards[2]) cards[2].innerHTML = `${Number(data.customers || 0).toLocaleString('ar-SA')} <small>جهة</small>`;
      return;
    } catch (_) { setDemoMode(); }
  }
  const sales = state.invoices.filter(i => i.kind === 'مبيعات').reduce((sum, i) => sum + Number(i.total || 0), 0);
  const purchases = state.invoices.filter(i => i.kind === 'مشتريات').reduce((sum, i) => sum + Number(i.total || 0), 0);
  const expenses = state.entries.reduce((sum, i) => sum + (Number(i.debit || 0) < 5000 ? Number(i.debit || 0) : 0), 0);
  const cash = state.accounts.filter(a => ['أصل', 'Asset'].includes(a.type)).reduce((sum, a) => sum + Number(a.balance || 0), 0);
  if (cards[0]) cards[0].innerHTML = `${sales.toLocaleString('ar-SA')} <small>ر.س</small>`;
  if (cards[1]) cards[1].innerHTML = `${Math.max(0, sales - purchases - expenses).toLocaleString('ar-SA')} <small>ر.س</small>`;
  if (cards[2]) cards[2].innerHTML = `${expenses.toLocaleString('ar-SA')} <small>ر.س</small>`;
  if (cards[3]) cards[3].innerHTML = `${cash.toLocaleString('ar-SA')} <small>ر.س</small>`;
}

async function renderSecurity() {
  $('generic-content').innerHTML = '<div class="module-toolbar"><div><p class="eyebrow">إدارة الأمان</p><h2>المستخدمون والصلاحيات</h2></div></div><div class="security-grid"><div class="panel"><h3>إنشاء مستخدم</h3><form id="security-user-form" class="security-form"><input name="username" placeholder="اسم المستخدم" required /><input name="displayNameAr" placeholder="الاسم الظاهر" required /><input name="password" type="password" placeholder="كلمة المرور (8 أحرف على الأقل)" minlength="8" required /><button class="primary-button" type="submit">إضافة المستخدم</button></form></div><div class="panel"><h3>المستخدمون الحاليون</h3><div id="security-users" class="security-users">جارٍ التحميل...</div></div></div>';
  if (dataMode === 'demo') {
    $('security-users').innerHTML = state.users.map(u => `<div class="security-user"><div><strong>${esc(u.displayNameAr)}</strong><small>${esc(u.username)} · ${esc(u.role)}</small></div><span class="status paid">تجريبي</span></div>`).join('');
  } else {
    try {
      const [users, roles] = await Promise.all([window.onyxAPI.listUsers(), window.onyxAPI.listRoles()]);
      const roleOptions = roles.map(r => `<option value="${esc(r.ROLE_CODE)}">${esc(r.ROLE_NAME_AR)}</option>`).join('');
      $('security-users').innerHTML = users.length ? users.map(u => `<div class="security-user"><div><strong>${esc(u.DISPLAY_NAME_AR)}</strong><small>${esc(u.USERNAME)} · ${Number(u.ACTIVE_FLAG) ? 'نشط' : 'معطل'}</small></div><select data-user-id="${u.USER_ID}" class="role-select"><option value="">تعيين دور...</option>${roleOptions}</select></div>`).join('') : '<p class="empty-cell">لا يوجد مستخدمون.</p>';
      document.querySelectorAll('.role-select').forEach(select => select.addEventListener('change', async event => { if (!event.target.value) return; try { await window.onyxAPI.assignRole({ userId: event.target.dataset.userId, roleCode: event.target.value }); showToast('تم تحديث دور المستخدم'); } catch (error) { showToast(error.message); } }));
    } catch (error) { $('security-users').innerHTML = `<p class="login-error">${esc(error.message)}</p>`; }
  }
  $('security-user-form').addEventListener('submit', async event => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (dataMode === 'demo') { state.users.push({ username: data.username, displayNameAr: data.displayNameAr, role: 'مستخدم' }); save(); showToast('تم إنشاء مستخدم تجريبي'); await renderSecurity(); }
      else { await window.onyxAPI.createUser(data); showToast('تم إنشاء المستخدم'); await renderSecurity(); }
    } catch (error) { showToast(error.message); }
  });
}

async function completeLogin(session) {
  $('login-screen').classList.add('hidden');
  const name = document.querySelector('.user-mini strong'); const role = document.querySelector('.user-mini span:not(.dots)');
  if (name) name.textContent = session.displayNameAr;
  if (role) role.textContent = session.roles?.[0]?.ROLE_NAME_AR || session.role || 'مستخدم';
  refreshDbStatus(); refreshDashboardMetrics();
}

async function bootAuthentication() {
  const online = await refreshDbStatus();
  if (!online) {
    const stored = sessionStorage.getItem('onyx-demo-session');
    if (stored) await completeLogin(JSON.parse(stored));
    return;
  }
  try {
    const hasUsers = await window.onyxAPI.hasUsers();
    if (!hasUsers) { $('login-title').textContent = 'تهيئة مدير النظام'; $('login-subtitle').textContent = 'أنشئ أول مستخدم بصلاحيات كاملة للبدء'; $('setup-fields').classList.remove('hidden'); document.querySelector('.login-submit').textContent = 'إنشاء المدير والدخول'; }
    const session = await window.onyxAPI.currentSession(); if (session) await completeLogin(session);
  } catch (error) { setDemoMode(); $('login-error').textContent = 'تم تفعيل الوضع التجريبي تلقائيًا.'; }
}

$('login-form')?.addEventListener('submit', async event => {
  event.preventDefault(); const errorBox = $('login-error'); errorBox.textContent = '';
  const username = $('login-username').value.trim(); const password = $('login-password').value;
  try {
    if (dataMode === 'demo') {
      if (!((username.toLowerCase() === 'admin' && password === 'demo123') || state.users.some(u => u.username.toLowerCase() === username.toLowerCase()))) throw new Error('للدخول التجريبي استخدم admin / demo123');
      const user = state.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || state.users[0];
      const session = { displayNameAr: user.displayNameAr, role: user.role, permissions: ['ALL'], roles: [{ ROLE_NAME_AR: user.role }] };
      sessionStorage.setItem('onyx-demo-session', JSON.stringify(session)); await completeLogin(session); showToast(`مرحباً ${session.displayNameAr}`); return;
    }
    if (!$('setup-fields').classList.contains('hidden')) { const displayNameAr = $('setup-display').value.trim(); const confirm = $('setup-confirm').value; if (password !== confirm) throw new Error('تأكيد كلمة المرور غير مطابق.'); await window.onyxAPI.createUser({ username, displayNameAr, password }); }
    const session = await window.onyxAPI.login({ username, password }); await completeLogin(session); showToast(`مرحباً ${session.displayNameAr}`);
  } catch (error) { errorBox.textContent = error.message; }
});

document.querySelector('.user-mini')?.addEventListener('click', async () => { if (confirm('هل تريد تسجيل الخروج؟')) { sessionStorage.removeItem('onyx-demo-session'); if (window.onyxAPI) await window.onyxAPI.logout(); location.reload(); } });
window.addEventListener('DOMContentLoaded', bootAuthentication);
