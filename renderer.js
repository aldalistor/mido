const labels = {
  dashboard: 'لوحة التحكم', journal: 'القيود اليومية', accounts: 'دليل الحسابات',
  reports: 'التقارير المالية', revaluation: 'إعادة تقييم العملات', 'year-close': 'إقفال السنة المالية', sales: 'المبيعات', purchases: 'المشتريات',
  inventory: 'المخزون', cash: 'الصندوق والبنوك', expenses: 'المصروفات والإيرادات', contacts: 'العملاء والموردون', security: 'المستخدمون والصلاحيات', database: 'تهيئة قاعدة البيانات'
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
const currencies = [{ code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', rate: 1 }, { code: 'YER', name: 'ريال يمني', symbol: 'ر.ي', rate: 140 }, { code: 'USD', name: 'دولار أمريكي', symbol: '$', rate: 3.75 }, { code: 'EUR', name: 'يورو', symbol: '€', rate: 4.05 }];
const save = () => localStorage.setItem('onyx-state', JSON.stringify(state));
const money = value => `${Number(value || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ر.س`;
const currencyInfo = code => currencies.find(c => c.code === code) || currencies[0];
const moneyInCurrency = (value, code = 'SAR') => `${Number(value || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ${currencyInfo(code).symbol}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const $ = id => document.getElementById(id);
const toast = $('toast');
let dataMode = 'detecting';
let currentView = 'dashboard';
let pendingInvoiceEditId = '';
const dashboardCache = { data: null, fetchedAt: 0, request: null };
const DASHBOARD_CACHE_TTL_MS = 30_000;

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
  if (currentView !== view) closeForm();
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  openScreenTab(view);
  document.querySelectorAll('.view').forEach(item => item.classList.remove('active-view'));
  const target = $(view === 'dashboard' ? 'dashboard-view' : 'generic-view');
  target.classList.add('active-view');
  $('page-title').textContent = labels[view] || 'الوحدة';
  $('generic-title').textContent = labels[view] || 'الوحدة';
  if (view === 'security') renderSecurity();
  else if (view !== 'dashboard') renderModule(view);
  if (view !== 'dashboard' && dataMode === 'oracle') setTimeout(() => loadLiveRows(view), 0);
}

function openScreenTab(view) {
  const tabs = $('screen-tabs');
  const existing = tabs?.querySelector(`.screen-tab[data-view="${view}"]`);
  if (existing) {
    tabs.querySelectorAll('.screen-tab').forEach(tab => tab.classList.toggle('active', tab === existing));
    return;
  }
  if (!tabs) {
    tabs?.querySelectorAll('.screen-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
    return;
  }
  const tab = document.createElement('button');
  tab.className = 'screen-tab';
  tab.dataset.view = view;
  tab.innerHTML = `<span>${view === 'journal' ? '≡' : view === 'sales' ? '↗' : view === 'purchases' ? '↙' : view === 'inventory' ? '▤' : view === 'contacts' ? '♙' : view === 'accounts' ? '◫' : view === 'reports' ? '◒' : view === 'revaluation' ? '⇄' : '⚙'}</span> ${esc(labels[view] || 'الوحدة')} <b class="tab-close" aria-label="إغلاق">×</b>`;
  tab.addEventListener('click', event => {
    if (event.target.classList.contains('tab-close')) {
      event.stopPropagation();
      tab.remove();
      const remaining = tabs.querySelectorAll('.screen-tab');
      if (tab.classList.contains('active')) switchView(remaining.length ? remaining[remaining.length - 1].dataset.view : 'dashboard');
      return;
    }
    switchView(view);
  });
  tabs.appendChild(tab);
  tabs.querySelectorAll('.screen-tab').forEach(item => item.classList.toggle('active', item === tab));
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

function accountTreeRows(accounts) {
  const groups = [{ code: '1', name: 'الأصول', type: 'أصل', tone: 'tree-blue' }, { code: '2', name: 'الالتزامات', type: 'التزام', tone: 'tree-orange' }, { code: '4', name: 'الإيرادات', type: 'إيراد', tone: 'tree-green' }, { code: '5', name: 'المصروفات', type: 'مصروف', tone: 'tree-purple' }];
  return groups.map(group => {
    const children = accounts.filter(a => String(a.code).startsWith(group.code));
    return `<div class="tree-group"><button class="tree-row group-row"><span class="tree-chevron">⌄</span><span class="tree-folder ${group.tone}">◫</span><strong>${group.code} · ${group.name}</strong><small>${children.length} حساب</small></button>${children.map(a => `<button class="tree-row child-row" data-account-code="${esc(a.code)}"><span class="tree-indent"></span><span class="tree-dot ${group.tone}"></span><span>${esc(a.code)} · ${esc(a.name)}</span><small>${money(a.balance)}</small></button>`).join('')}</div>`;
  }).join('');
}

function renderAccountsWorkspace() {
  const selected = state.accounts[0] || { code: '—', name: 'لا يوجد حساب', type: '—', balance: 0 };
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">المحاسبة والمالية / دليل الحسابات</p><h2>دليل الحسابات</h2><p class="toolbar-description">إدارة شجرة الحسابات والأرصدة والحسابات التحليلية</p></div><div class="toolbar-actions"><button class="secondary-button" id="import-accounts">⇩ استيراد</button><button class="primary-button" id="module-action">＋ حساب جديد</button></div></div><div class="account-summary"><div><span>إجمالي الحسابات</span><strong>${state.accounts.length}</strong></div><div><span>حسابات نشطة</span><strong>${state.accounts.length}</strong></div><div><span>الأصول</span><strong>${money(state.accounts.filter(a => a.type === 'أصل').reduce((s, a) => s + Number(a.balance || 0), 0))}</strong></div><div><span>صافي الحركة</span><strong class="summary-positive">${money(state.accounts.reduce((s, a) => s + (a.type === 'إيراد' ? Number(a.balance || 0) : -Number(a.balance || 0)), 0))}</strong></div></div><div class="account-workspace"><section class="panel account-tree-panel"><div class="workspace-heading"><div><span class="section-kicker">الهيكل المحاسبي</span><h3>شجرة الحسابات</h3></div><button class="more">•••</button></div><div class="tree-tools"><input id="account-tree-search" placeholder="ابحث برمز أو اسم الحساب..." /><button id="expand-tree">توسيع الكل</button></div><div id="account-tree" class="account-tree">${accountTreeRows(state.accounts)}</div></section><section class="panel account-detail-panel"><div class="detail-header"><div><span class="section-kicker">بطاقة الحساب</span><h3 id="selected-account-name">${esc(selected.name)}</h3><span class="account-code-badge">${esc(selected.code)} · ${esc(selected.type)}</span></div><button class="secondary-button" id="account-ledger">دفتر الأستاذ</button></div><div class="detail-balance"><span>الرصيد الحالي</span><strong>${money(selected.balance)}</strong><small>حتى 24 سبتمبر 2024</small></div><div class="detail-stats"><div><span>مدين</span><strong>${money(24500)}</strong></div><div><span>دائن</span><strong>${money(0)}</strong></div><div><span>عدد الحركات</span><strong>24</strong></div></div><div class="detail-section"><div class="workspace-heading"><h4>آخر الحركات</h4><button class="text-button">عرض السجل الكامل</button></div><table class="mini-ledger"><thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th></tr></thead><tbody><tr><td>24 سبتمبر</td><td>إثبات فاتورة مبيعات</td><td>${money(12500)}</td><td>—</td></tr><tr><td>22 سبتمبر</td><td>تحصيل نقدي</td><td>—</td><td>${money(4800)}</td></tr><tr><td>18 سبتمبر</td><td>رصيد افتتاحي</td><td>${money(16800)}</td><td>—</td></tr></tbody></table></div></section></div>`;
  $('module-action').addEventListener('click', () => openForm('accounts'));
  $('import-accounts').addEventListener('click', () => showToast('استيراد دليل الحسابات سيكون متاحًا بعد ربط ملف Excel'));
  $('account-ledger').addEventListener('click', () => { switchView('journal'); showToast('تم فتح دفتر الأستاذ العام'); });
  $('account-tree-search').addEventListener('input', event => { const q = event.target.value.toLowerCase(); document.querySelectorAll('.child-row').forEach(row => { row.style.display = row.textContent.toLowerCase().includes(q) ? 'flex' : 'none'; }); });
  document.querySelectorAll('[data-account-code]').forEach(row => row.addEventListener('click', () => { const account = state.accounts.find(a => String(a.code) === row.dataset.accountCode); if (account) { $('selected-account-name').textContent = account.name; document.querySelector('.account-code-badge').textContent = `${account.code} · ${account.type}`; document.querySelector('.detail-balance strong').textContent = money(account.balance); } }));
}

function renderJournalWorkspace() {
  const rows = state.entries;
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">المحاسبة والمالية / اليومية العامة</p><h2>القيود اليومية</h2><p class="toolbar-description">تسجيل ومراجعة وترحيل الحركات المحاسبية</p></div><div class="toolbar-actions"><button class="secondary-button" id="journal-export">⇩ تصدير</button><button class="primary-button" id="module-action">＋ قيد جديد</button></div></div><div class="journal-layout"><section class="panel journal-list-panel"><div class="journal-tabs"><button class="journal-tab active" data-filter="all">كل القيود <b>${rows.length}</b></button><button class="journal-tab" data-filter="مرحّل">مرحّلة <b>${rows.filter(e => e.status === 'مرحّل').length}</b></button><button class="journal-tab" data-filter="مسودة">مسودات <b>${rows.filter(e => e.status === 'مسودة').length}</b></button></div><div class="table-tools journal-tools"><input id="journal-search" placeholder="ابحث برقم القيد أو البيان..." /><div class="filter-group"><button>هذا الشهر ▾</button><button>كل الفروع ▾</button></div></div><div class="table-scroll"><table class="journal-table"><thead><tr><th>رقم القيد</th><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الحالة</th><th></th></tr></thead><tbody id="journal-body">${journalRows(rows)}</tbody></table></div></section><aside class="journal-side"><div class="panel period-card"><div class="workspace-heading"><div><span class="section-kicker">الفترة الحالية</span><h3>سبتمبر 2024</h3></div><span class="open-pill">مفتوحة</span></div><div class="period-progress"><span style="width:78%"></span></div><div class="period-meta"><span>78% من الفترة</span><strong>6 أيام متبقية</strong></div><button class="secondary-button full-button">إدارة الفترات المالية</button></div><div class="panel journal-health"><div class="workspace-heading"><h3>ملخص اليومية</h3><button class="more">•••</button></div><div class="health-row"><span>إجمالي المدين</span><strong>${money(rows.reduce((s, e) => s + Number(e.debit || 0), 0))}</strong></div><div class="health-row"><span>إجمالي الدائن</span><strong>${money(rows.reduce((s, e) => s + Number(e.credit || 0), 0))}</strong></div><div class="health-row"><span>قيود تحتاج مراجعة</span><strong class="warning-text">${rows.filter(e => e.status === 'مسودة').length}</strong></div><div class="balanced-note">✓ اليومية متوازنة حتى الآن</div></div></aside></div>`;
  $('module-action').addEventListener('click', () => openForm('journal'));
  $('journal-export').addEventListener('click', () => showToast('تم تجهيز تصدير اليومية بصيغة Excel'));
  const applyFilter = filter => { const q = $('journal-search').value.toLowerCase(); const filtered = rows.filter(e => (filter === 'all' || e.status === filter) && `${e.no} ${e.description}`.toLowerCase().includes(q)); $('journal-body').innerHTML = journalRows(filtered); };
  document.querySelectorAll('.journal-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.journal-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); applyFilter(tab.dataset.filter); }));
  $('journal-search').addEventListener('input', () => applyFilter(document.querySelector('.journal-tab.active').dataset.filter));
}

function journalRows(rows) { return rows.length ? rows.map(e => `<tr><td><strong class="journal-number">${esc(e.no)}</strong></td><td>${esc(e.date)}</td><td><strong>${esc(e.description)}</strong><small class="cell-muted">قيد عام · فرع الرئيسي</small></td><td>${money(e.debit)}</td><td>${money(e.credit)}</td><td><span class="status ${e.status === 'مرحّل' ? 'paid' : 'pending'}">${esc(e.status)}</span></td><td><button class="row-menu">•••</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty-cell">لا توجد قيود مطابقة للبحث.</td></tr>'; }

function renderPurchasesWorkspace() {
  const purchases = state.invoices.filter(i => i.kind === 'مشتريات');
  const total = purchases.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">العمليات / المشتريات</p><h2>المشتريات</h2><p class="toolbar-description">دورة الشراء من أمر التوريد حتى الفاتورة والسداد</p></div><div class="toolbar-actions"><button class="secondary-button" id="purchase-report">◒ تقرير المشتريات</button><button class="primary-button" id="module-action">＋ فاتورة شراء</button></div></div><div class="purchase-tabs"><button class="purchase-tab active" data-purchase-tab="invoices">فواتير المشتريات</button><button class="purchase-tab" data-purchase-tab="orders">أوامر الشراء <b>4</b></button><button class="purchase-tab" data-purchase-tab="returns">مرتجعات المشتريات</button><button class="purchase-tab" data-purchase-tab="payments">دفعات الموردين</button></div><div class="account-summary purchase-summary"><div><span>إجمالي المشتريات</span><strong>${money(total || 4280)}</strong><small class="summary-trend">↑ 9.4% هذا الشهر</small></div><div><span>فواتير غير مسددة</span><strong>${money(12750)}</strong><small class="summary-warning">5 فواتير مستحقة</small></div><div><span>أوامر قيد التوريد</span><strong>4</strong><small>12 صنفًا</small></div><div><span>عدد الموردين النشطين</span><strong>${state.contacts.filter(c => c.type === 'مورد').length || 1}</strong><small>آخر تحديث اليوم</small></div></div><div class="purchase-layout"><section class="panel purchase-list-panel"><div class="workspace-heading"><div><span class="section-kicker">المستندات الشرائية</span><h3>آخر فواتير المشتريات</h3></div><button class="more">•••</button></div><div class="table-tools purchase-tools"><input id="purchase-search" placeholder="ابحث برقم الفاتورة أو المورد..." /><div class="filter-group"><button>هذا الشهر ▾</button><button>كل الحالات ▾</button></div></div><div class="table-scroll"><table class="purchase-table"><thead><tr><th>رقم الفاتورة</th><th>المورد</th><th>التاريخ</th><th>الإجمالي</th><th>المستحق</th><th>الحالة</th><th></th></tr></thead><tbody id="purchase-body">${purchaseRows(purchases)}</tbody></table></div></section><aside class="purchase-side"><div class="panel quick-purchase"><div class="workspace-heading"><div><span class="section-kicker">اختصارات المشتريات</span><h3>إجراء سريع</h3></div></div><button id="new-purchase-order">＋ إنشاء أمر شراء</button><button id="new-purchase-return">↩ تسجيل مرتجع شراء</button><button id="new-supplier-payment">▣ تسجيل دفعة مورد</button></div><div class="panel due-suppliers"><div class="workspace-heading"><div><span class="section-kicker">الاستحقاقات</span><h3>أرصدة الموردين</h3></div><button class="text-button" data-view="contacts">عرض الكل</button></div>${supplierDueRows()}</div></aside></div>`;
  $('module-action').addEventListener('click', () => openForm('purchases'));
  $('purchase-report').addEventListener('click', () => showToast('تم تجهيز تقرير المشتريات للفترة الحالية'));
  $('new-purchase-order').addEventListener('click', () => showToast('سيتم فتح شاشة أمر الشراء عند تفعيل دورة الاعتماد'));
  $('new-purchase-return').addEventListener('click', () => showToast('اختر فاتورة شراء لتسجيل المرتجع'));
  $('new-supplier-payment').addEventListener('click', () => openForm('ap-payment'));
  document.querySelectorAll('.purchase-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.purchase-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); if (tab.dataset.purchaseTab !== 'invoices') showToast(`شاشة ${tab.textContent.trim()} جاهزة للتوسع`); }));
  $('purchase-search').addEventListener('input', event => { const q = event.target.value.toLowerCase(); $('purchase-body').innerHTML = purchaseRows(purchases.filter(i => `${i.ref} ${i.party}`.toLowerCase().includes(q))); });
}

function purchaseRows(purchases) { return purchases.length ? purchases.map(i => `<tr><td><strong class="journal-number">#${esc(i.ref)}</strong><small class="cell-muted">فاتورة مشتريات</small></td><td><strong>${esc(i.party)}</strong><small class="cell-muted">مورد محلي</small></td><td>${esc(i.date)}</td><td><strong>${money(i.total)}</strong></td><td>${money(i.total)}</td><td><span class="status ${i.ref === 'PUR-0286' ? 'pending' : 'paid'}">${i.ref === 'PUR-0286' ? 'معلّقة' : 'مكتملة'}</span></td><td><button class="row-menu">•••</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty-cell">لا توجد فواتير مشتريات.</td></tr>'; }

function supplierDueRows() { const suppliers = state.contacts.filter(c => c.type === 'مورد'); return (suppliers.length ? suppliers : [{ name: 'مؤسسة الإمداد', code: 'V-001' }]).map((s, index) => `<div class="supplier-due-row"><span class="supplier-avatar">${esc((s.name || 'م').slice(0, 1))}</span><div><strong>${esc(s.name)}</strong><small>${index === 0 ? 'مستحق خلال 7 أيام' : 'حساب منتظم'}</small></div><b>${money(index === 0 ? 4280 : 850)}</b></div>`).join(''); }

function renderSuppliersWorkspace() {
  const suppliers = state.contacts.filter(c => c.type === 'مورد');
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">العمليات / المشتريات / دليل الموردين</p><h2>الموردون</h2><p class="toolbar-description">ملفات الموردين وأرصدة الحسابات وكشوف المعاملات</p></div><div class="toolbar-actions"><button class="secondary-button" id="supplier-export">⇩ تصدير القائمة</button><button class="primary-button" id="module-action">＋ مورد جديد</button></div></div><div class="supplier-summary account-summary"><div><span>إجمالي الموردين</span><strong>${suppliers.length || 1}</strong></div><div><span>أرصدة مستحقة</span><strong>${money(12750)}</strong></div><div><span>موردون نشطون</span><strong>${suppliers.length || 1}</strong></div><div><span>متوسط مدة السداد</span><strong>28 <small>يومًا</small></strong></div></div><div class="supplier-layout"><section class="panel supplier-list-panel"><div class="table-tools"><input id="supplier-search" placeholder="ابحث باسم المورد أو الرمز..." /><span>${suppliers.length || 1} مورد</span></div><div class="table-scroll"><table class="supplier-table"><thead><tr><th>المورد</th><th>الرمز</th><th>الهاتف</th><th>الرصيد المستحق</th><th>آخر معاملة</th><th>الحالة</th><th></th></tr></thead><tbody id="supplier-body">${supplierRows(suppliers)}</tbody></table></div></section><aside class="panel supplier-card"><div class="supplier-card-head"><span class="large-supplier-avatar">م</span><div><span class="section-kicker">المورد المحدد</span><h3>مؤسسة الإمداد</h3><small>V-001 · مورد محلي</small></div><button class="more">•••</button></div><div class="supplier-balance"><span>الرصيد المستحق</span><strong>${money(4280)}</strong><small>آخر سداد منذ 12 يومًا</small></div><div class="supplier-actions"><button id="supplier-ledger">كشف الحساب</button><button id="supplier-payment">تسجيل دفعة</button></div><div class="supplier-contact"><div><span>الهاتف</span><strong>0550000000</strong></div><div><span>البريد الإلكتروني</span><strong>supply@emdad.test</strong></div></div></aside></div>`;
  $('module-action').addEventListener('click', () => openForm('contacts'));
  $('supplier-export').addEventListener('click', () => showToast('تم تجهيز قائمة الموردين للتصدير'));
  $('supplier-ledger').addEventListener('click', () => { switchView('journal'); showToast('تم فتح كشف حساب المورد'); });
  $('supplier-payment').addEventListener('click', () => showToast('سيتم فتح سند صرف للمورد المحدد'));
  $('supplier-search').addEventListener('input', event => { const q = event.target.value.toLowerCase(); $('supplier-body').innerHTML = supplierRows(suppliers.filter(s => `${s.name} ${s.code}`.toLowerCase().includes(q))); });
}

function supplierRows(suppliers) { const list = suppliers.length ? suppliers : [{ name: 'مؤسسة الإمداد', code: 'V-001', phone: '0550000000' }]; return list.map((s, index) => `<tr><td><div class="supplier-cell"><span class="supplier-avatar">${esc((s.name || 'م').slice(0, 1))}</span><div><strong>${esc(s.name)}</strong><small>${index === 0 ? 'مورد محلي' : 'مورد نشط'}</small></div></div></td><td>${esc(s.code || 'V-001')}</td><td>${esc(s.phone || '—')}</td><td><strong>${money(index === 0 ? 4280 : 0)}</strong></td><td>23 سبتمبر 2024</td><td><span class="status paid">نشط</span></td><td><button class="row-menu">•••</button></td></tr>`).join(''); }

function renderInventoryWorkspace() {
  const lowStock = state.items.filter(i => Number(i.qty) <= 10);
  const purchaseQty = state.invoices.filter(i => i.kind === 'مشتريات').reduce((s, i) => s + 1, 0);
  const salesQty = state.invoices.filter(i => i.kind === 'مبيعات').reduce((s, i) => s + 1, 0);
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">العمليات / المخزون والمستودعات</p><h2>المخازن والمستودعات</h2><p class="toolbar-description">متابعة الأصناف والكميات وحركات التوريد والصرف بين المستودعات</p></div><div class="toolbar-actions"><button class="secondary-button" id="inventory-report">◒ تقرير المخزون</button><button class="primary-button" id="module-action">＋ إضافة صنف</button></div></div><div class="inventory-tabs"><button class="inventory-tab active" data-inventory-tab="items">الأصناف</button><button class="inventory-tab" data-inventory-tab="movements">حركات المخزون</button><button class="inventory-tab" data-inventory-tab="warehouses">المستودعات <b>2</b></button><button class="inventory-tab" data-inventory-tab="transfers">التحويلات</button><button class="inventory-tab" data-inventory-tab="count">الجرد</button></div><div class="account-summary inventory-summary"><div><span>قيمة المخزون</span><strong>${money(state.items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.cost || 0), 0))}</strong><small>حسب متوسط التكلفة</small></div><div><span>إجمالي الأصناف</span><strong>${state.items.length}</strong><small>${state.items.length} أصناف نشطة</small></div><div><span>أصناف منخفضة</span><strong class="inventory-warning">${lowStock.length || 0}</strong><small class="summary-warning">تحتاج إعادة طلب</small></div><div><span>حركات هذا الشهر</span><strong>${purchaseQty + salesQty}</strong><small>شراء وصرف</small></div></div><div class="inventory-layout"><section class="panel inventory-list-panel"><div class="workspace-heading"><div><span class="section-kicker">سجل الأصناف</span><h3>الأصناف والكميات الحالية</h3></div><button class="more">•••</button></div><div class="table-tools inventory-tools"><input id="inventory-search" placeholder="ابحث برمز الصنف أو اسمه..." /><div class="filter-group"><button>كل المستودعات ▾</button><button>كل الحالات ▾</button></div></div><div class="table-scroll"><table class="inventory-table"><thead><tr><th>الصنف</th><th>الرمز</th><th>الوحدة</th><th>المتاح</th><th>محجوز</th><th>متوسط التكلفة</th><th>الحالة</th><th></th></tr></thead><tbody id="inventory-body">${inventoryRows(state.items)}</tbody></table></div></section><aside class="inventory-side"><div class="panel warehouse-card"><div class="workspace-heading"><div><span class="section-kicker">المستودعات</span><h3>ملخص المستودعات</h3></div><button class="text-button" id="manage-warehouses">إدارة</button></div><div class="warehouse-row"><span class="warehouse-icon blue-bg">▤</span><div><strong>المستودع الرئيسي</strong><small>الرياض · 24 صنفًا</small></div><b>${money(286400)}</b></div><div class="warehouse-row"><span class="warehouse-icon green-bg">▤</span><div><strong>مستودع الفرع</strong><small>جدة · 8 أصناف</small></div><b>${money(40440)}</b></div><button class="secondary-button full-button" id="new-transfer">⇄ تحويل بين المستودعات</button></div><div class="panel movement-card"><div class="workspace-heading"><div><span class="section-kicker">آخر الحركات</span><h3>المشتريات والمبيعات</h3></div><button class="text-button" id="all-movements">عرض الكل</button></div><div class="movement-row"><span class="movement-icon purchase">↙</span><div><strong>توريد من فاتورة شراء</strong><small>مؤسسة الإمداد · اليوم</small></div><b class="movement-in">+ 12</b></div><div class="movement-row"><span class="movement-icon sale">↗</span><div><strong>صرف من فاتورة مبيعات</strong><small>شركة الرواد · أمس</small></div><b class="movement-out">− 4</b></div><div class="movement-row"><span class="movement-icon count">⌗</span><div><strong>تسوية جرد</strong><small>المستودع الرئيسي · 22 سبتمبر</small></div><b>± 0</b></div></div></aside></div>`;
  $('module-action').addEventListener('click', () => openForm('inventory'));
  $('inventory-report').addEventListener('click', () => showToast('تم تجهيز تقرير المخزون والتكلفة'));
  $('manage-warehouses').addEventListener('click', () => showToast('إدارة المستودعات جاهزة للتوسع'));
  $('new-transfer').addEventListener('click', () => showToast('حدد المستودع المصدر والوجهة لإنشاء التحويل'));
  $('all-movements').addEventListener('click', () => showToast('تم فتح سجل حركات المخزون'));
  document.querySelectorAll('.inventory-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.inventory-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); if (tab.dataset.inventoryTab !== 'items') showToast(`شاشة ${tab.textContent.trim()} جاهزة للتوسع`); }));
  $('inventory-search').addEventListener('input', event => { const q = event.target.value.toLowerCase(); $('inventory-body').innerHTML = inventoryRows(state.items.filter(i => `${i.code} ${i.name}`.toLowerCase().includes(q))); });
}

function inventoryRows(items) { return items.length ? items.map(i => { const qty = Number(i.qty || 0); const low = qty <= 10; return `<tr><td><div class="item-cell"><span class="item-icon">▤</span><div><strong>${esc(i.name)}</strong><small>${low ? 'تحت حد إعادة الطلب' : 'متاح للبيع'}</small></div></div></td><td class="item-code">${esc(i.code)}</td><td>${esc(i.unit)}</td><td><strong>${qty.toLocaleString('ar-SA')}</strong></td><td>0</td><td>${money(i.cost)}</td><td><span class="status ${low ? 'pending' : 'paid'}">${low ? 'منخفض' : 'متاح'}</span></td><td><button class="row-menu">•••</button></td></tr>`; }).join('') : '<tr><td colspan="8" class="empty-cell">لا توجد أصناف مطابقة للبحث.</td></tr>'; }

function renderSalesWorkspace() {
  const sales = state.invoices.filter(i => i.kind === 'مبيعات');
  const customers = state.contacts.filter(c => c.type === 'عميل');
  const total = sales.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">العمليات / المبيعات</p><h2>المبيعات والعملاء</h2><p class="toolbar-description">إدارة دورة البيع من العرض والفاتورة حتى التحصيل والقيد المحاسبي</p></div><div class="toolbar-actions"><button class="secondary-button" id="sales-report">◒ تقرير المبيعات</button><button class="primary-button" id="module-action">＋ فاتورة مبيعات</button></div></div><div class="sales-tabs"><button class="sales-tab active" data-sales-tab="invoices">فواتير المبيعات</button><button class="sales-tab" data-sales-tab="quotes">عروض الأسعار <b>6</b></button><button class="sales-tab" data-sales-tab="returns">مرتجعات المبيعات</button><button class="sales-tab" data-sales-tab="receipts">سندات القبض</button><button class="sales-tab" data-sales-tab="customers">العملاء</button></div><div class="account-summary sales-summary"><div><span>إجمالي المبيعات</span><strong>${money(total || 12500)}</strong><small class="summary-trend">↑ 12.8% هذا الشهر</small></div><div><span>ذمم العملاء</span><strong>${money(58320)}</strong><small class="summary-warning">8 فواتير مستحقة</small></div><div><span>فواتير مكتملة</span><strong>${sales.length || 1}</strong><small>من أصل ${sales.length || 1}</small></div><div><span>العملاء النشطون</span><strong>${customers.length || 1}</strong><small>آخر تحديث اليوم</small></div></div><div class="sales-layout"><section class="panel sales-list-panel"><div class="workspace-heading"><div><span class="section-kicker">المستندات البيعية</span><h3>آخر فواتير المبيعات</h3></div><button class="more">•••</button></div><div class="table-tools sales-tools"><input id="sales-search" placeholder="ابحث برقم الفاتورة أو العميل..." /><div class="filter-group"><button>هذا الشهر ▾</button><button>كل الحالات ▾</button></div></div><div class="table-scroll"><table class="sales-table"><thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>التاريخ</th><th>الإجمالي</th><th>المحصل</th><th>الحالة</th><th></th></tr></thead><tbody id="sales-body">${salesRows(sales)}</tbody></table></div></section><aside class="sales-side"><div class="panel sales-quick"><div class="workspace-heading"><div><span class="section-kicker">اختصارات المبيعات</span><h3>إجراء سريع</h3></div></div><button id="new-sales-quote">＋ إنشاء عرض سعر</button><button id="new-sales-return">↩ تسجيل مرتجع بيع</button><button id="new-customer-receipt">▣ تسجيل سند قبض</button></div><div class="panel customer-dues"><div class="workspace-heading"><div><span class="section-kicker">التحصيلات</span><h3>أرصدة العملاء</h3></div><button class="text-button" id="view-customers">عرض الكل</button></div>${customerDueRows(customers)}</div></aside></div>`;
  $('module-action').addEventListener('click', () => openForm('sales'));
  $('sales-report').addEventListener('click', () => showToast('تم تجهيز تقرير المبيعات للفترة الحالية'));
  $('new-sales-quote').addEventListener('click', () => showToast('تم فتح شاشة عروض الأسعار'));
  $('new-sales-return').addEventListener('click', () => showToast('اختر فاتورة مبيعات لتسجيل المرتجع'));
  $('new-customer-receipt').addEventListener('click', () => openForm('ar-receipt'));
  $('view-customers').addEventListener('click', () => showToast('تم فتح قائمة العملاء'));
  document.querySelectorAll('.sales-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.sales-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); if (tab.dataset.salesTab !== 'invoices') showToast(`شاشة ${tab.textContent.trim()} جاهزة للتوسع`); }));
  $('sales-search').addEventListener('input', event => { const q = event.target.value.toLowerCase(); $('sales-body').innerHTML = salesRows(sales.filter(i => `${i.ref} ${i.party}`.toLowerCase().includes(q))); });
}

function salesRows(sales) { return sales.length ? sales.map(i => `<tr><td><strong class="journal-number">#${esc(i.ref)}</strong><small class="cell-muted">فاتورة ضريبية</small></td><td><strong>${esc(i.party)}</strong><small class="cell-muted">عميل نقدي/آجل</small></td><td>${esc(i.date)}</td><td><strong>${money(i.total)}</strong></td><td>${money(i.total)}</td><td><span class="status paid">مكتملة</span></td><td><button class="row-menu">•••</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty-cell">لا توجد فواتير مبيعات.</td></tr>'; }

function customerDueRows(customers) { const list = customers.length ? customers : [{ name: 'شركة الرواد للتجارة', code: 'C-001' }]; return list.map((c, index) => `<div class="customer-due-row"><span class="customer-avatar">${esc((c.name || 'ع').slice(0, 1))}</span><div><strong>${esc(c.name)}</strong><small>${index === 0 ? 'مستحق منذ 4 أيام' : 'حساب منتظم'}</small></div><b>${money(index === 0 ? 12500 : 1900)}</b></div>`).join(''); }

async function renderReportsWorkspace() {
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">المحاسبة والمالية / التقارير</p><h2>التقارير المالية</h2><p class="toolbar-description">تقارير مبنية على القيود والفواتير المرحّلة في Oracle</p></div><div class="toolbar-actions"><button class="secondary-button" id="print-report">▣ طباعة</button><button class="secondary-button" id="export-report">⇩ تصدير CSV</button></div></div><div class="report-controls"><div class="report-period"><label for="report-start">من</label><input type="date" id="report-start" /><label for="report-end">إلى</label><input type="date" id="report-end" /><button class="report-refresh" id="refresh-reports">↻ تحديث</button></div></div><div class="report-tabs"><button class="report-tab active" data-report="income">قائمة الدخل</button><button class="report-tab" data-report="balance">الميزانية العمومية</button><button class="report-tab" data-report="cashflow">التدفقات النقدية</button><button class="report-tab" data-report="trial">ميزان المراجعة</button></div><div class="report-kpis"><div><span>الإيرادات</span><strong id="report-revenue">—</strong><small>من البيانات المرحّلة</small></div><div><span>صافي الربح</span><strong id="report-profit">—</strong><small>الإيرادات ناقص المصروفات</small></div><div><span>إجمالي الأصول</span><strong id="report-assets">—</strong><small>حتى نهاية الفترة</small></div><div><span>النقد المتاح</span><strong id="report-cash">—</strong><small>حسب تصنيف الحسابات</small></div></div><div id="report-content"><div class="panel"><p>جارٍ تحميل التقرير...</p></div></div>`;
  const end = new Date(); const start = new Date(end.getFullYear(), end.getMonth(), 1);
  $('report-start').value = start.toISOString().slice(0, 10); $('report-end').value = end.toISOString().slice(0, 10);
  let reportData = null; let activeReport = 'income';
  const demoData = () => { const sales = state.invoices.filter(i => i.kind === 'مبيعات').reduce((s, i) => s + Number(i.total || 0), 0); const purchases = state.invoices.filter(i => i.kind === 'مشتريات').reduce((s, i) => s + Number(i.total || 0), 0); const expenses = state.entries.filter(e => e.source !== 'SALE' && e.source !== 'PURCHASE').reduce((s, e) => s + Number(e.debit || 0), 0); return { period: { startDate: $('report-start').value, endDate: $('report-end').value }, demo: true, kpis: { revenue: sales, expenses: purchases + expenses, profit: sales - purchases - expenses, assets: 0, liabilities: 0, equity: 0, cash: 0 }, trialBalance: state.accounts.map(a => ({ ACCOUNT_CODE: a.code, ACCOUNT_NAME_AR: a.name, ACCOUNT_TYPE: a.type, TOTAL_DEBIT: 0, TOTAL_CREDIT: 0, BALANCE: Number(a.balance || 0) })) }; };
  const updateKpis = data => { const k = data.kpis || {}; $('report-revenue').textContent = money(k.revenue); $('report-profit').textContent = money(k.profit); $('report-assets').textContent = money(k.assets); $('report-cash').textContent = money(k.cash); };
  const load = async () => { const filters = { startDate: $('report-start').value, endDate: $('report-end').value }; if (dataMode === 'oracle' && window.onyxAPI?.financialReports) { try { const base = await window.onyxAPI.financialReports(filters); if (activeReport === 'income' && window.onyxAPI.incomeStatementReport) { const report = await window.onyxAPI.incomeStatementReport(filters); reportData = { ...base, kpis: { ...base.kpis, revenue: report.totals.revenue, expenses: report.totals.expenses, profit: report.totals.profit }, trialBalance: report.rows }; } else if (activeReport === 'balance' && window.onyxAPI.balanceSheetReport) { const report = await window.onyxAPI.balanceSheetReport(filters); reportData = { ...base, kpis: { ...base.kpis, assets: report.totals.assets, liabilities: report.totals.liabilities, equity: report.totals.equity }, trialBalance: report.rows }; } else if (activeReport === 'trial' && window.onyxAPI.trialBalanceReport) { const report = await window.onyxAPI.trialBalanceReport(filters); reportData = { ...base, trialBalance: report.rows }; } else reportData = base; } catch (error) { console.error('Financial report load failed:', error); showToast('تعذر تحميل التقرير من Oracle.'); reportData = null; } } else reportData = demoData(); if (reportData) { updateKpis(reportData); renderReportContent(activeReport, reportData); } };
  document.querySelectorAll('.report-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); activeReport = tab.dataset.report; if (reportData) renderReportContent(activeReport, reportData); }));
  $('refresh-reports').addEventListener('click', load); $('print-report').addEventListener('click', () => window.print()); $('export-report').addEventListener('click', () => exportReportCsv(reportData, activeReport)); await load();
}
function exportReportCsv(data, type) { if (!data) return showToast('لا توجد بيانات لتصديرها.'); const rows = type === 'trial' ? [['رمز الحساب', 'اسم الحساب', 'النوع', 'مدين', 'دائن', 'الرصيد'], ...(data.trialBalance || []).map(r => [r.ACCOUNT_CODE, r.ACCOUNT_NAME_AR, r.ACCOUNT_TYPE, r.TOTAL_DEBIT, r.TOTAL_CREDIT, r.BALANCE])] : [['المؤشر', 'القيمة'], ['الإيرادات', data.kpis?.revenue || 0], ['المصروفات', data.kpis?.expenses || 0], ['صافي الربح', data.kpis?.profit || 0], ['الأصول', data.kpis?.assets || 0], ['النقد', data.kpis?.cash || 0]]; const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `mido-${type}-report-${data.period?.endDate || 'export'}.csv`; link.click(); URL.revokeObjectURL(link.href); }
function renderReportContent(type, data) { const content = $('report-content'); if (type === 'balance') content.innerHTML = balanceReport(data); else if (type === 'cashflow') content.innerHTML = cashflowReport(data); else if (type === 'trial') content.innerHTML = trialReport(data); else content.innerHTML = incomeReport(data); }
function reportRows(data, predicate) { return (data.trialBalance || []).filter(predicate).map(r => `<div class="statement-line indent"><span>${esc(r.ACCOUNT_CODE)} · ${esc(r.ACCOUNT_NAME_AR)}</span><b>${money(Math.abs(Number(r.BALANCE || 0)))}</b></div>`).join('') || '<div class="statement-line indent"><span>لا توجد أرصدة مصنفة للفترة</span><b>—</b></div>'; }
function incomeReport(data) { const k = data.kpis || {}; return `<section class="panel financial-statement"><div class="statement-head"><div><span class="section-kicker">${data.demo ? 'تجريبي' : 'Oracle'}</span><h3>قائمة الدخل</h3><p>من ${esc(data.period.startDate)} إلى ${esc(data.period.endDate)}</p></div><span class="verified-badge">${data.demo ? 'تجريبي' : 'بيانات فعلية'}</span></div><div class="statement-group"><div class="statement-line group-title"><strong>الإيرادات</strong><b>${money(k.revenue)}</b></div>${reportRows(data, r => ['REVENUE','INCOME'].includes(String(r.ACCOUNT_TYPE).toUpperCase()))}<div class="statement-line total-line"><strong>إجمالي الإيرادات</strong><b>${money(k.revenue)}</b></div></div><div class="statement-group"><div class="statement-line group-title"><strong>المصروفات والتكلفة</strong><b>${money(k.expenses)}</b></div>${reportRows(data, r => ['EXPENSE','COST','COGS'].includes(String(r.ACCOUNT_TYPE).toUpperCase()))}<div class="statement-line total-line"><strong>إجمالي المصروفات</strong><b>${money(k.expenses)}</b></div></div><div class="net-profit"><span>صافي الربح للفترة</span><strong>${money(k.profit)}</strong><small>محسوب من الأرصدة المرحّلة</small></div></section>`; }
function balanceReport(data) { const k = data.kpis || {}; return `<section class="panel financial-statement"><div class="statement-head"><div><span class="section-kicker">${data.demo ? 'تجريبي' : 'Oracle'}</span><h3>الميزانية العمومية</h3><p>كما في ${esc(data.period.endDate)}</p></div><span class="verified-badge">${data.demo ? 'تجريبي' : 'من قاعدة البيانات'}</span></div><div class="statement-group"><div class="statement-line group-title"><strong>الأصول</strong><b>${money(k.assets)}</b></div>${reportRows(data, r => String(r.ACCOUNT_TYPE).toUpperCase() === 'ASSET')}<div class="statement-line total-line"><strong>إجمالي الأصول</strong><b>${money(k.assets)}</b></div></div><div class="statement-group"><div class="statement-line group-title"><strong>الالتزامات وحقوق الملكية</strong><b>${money(k.liabilities + k.equity)}</b></div>${reportRows(data, r => ['LIABILITY','EQUITY'].includes(String(r.ACCOUNT_TYPE).toUpperCase()))}<div class="statement-line total-line"><strong>الإجمالي</strong><b>${money(k.liabilities + k.equity)}</b></div></div></section>`; }
function cashflowReport(data) { return `<section class="panel financial-statement"><div class="statement-head"><div><span class="section-kicker">حالة التقرير</span><h3>التدفقات النقدية</h3><p>من ${esc(data.period.startDate)} إلى ${esc(data.period.endDate)}</p></div><span class="verified-badge">يتطلب وحدة المدفوعات</span></div><div class="statement-group"><p>لا توجد في المخطط الحالي جداول مستقلة للقبض والصرف أو تسوية البنوك؛ لذلك لا يجوز عرض أرقام نقدية تقديرية على أنها تدفقات فعلية. سيتم تفعيل هذا التقرير بعد إضافة وحدة المدفوعات.</p></div></section>`; }
function trialReport(data) { const rows = data.trialBalance || []; const totalDebit = rows.reduce((s, r) => s + Number(r.TOTAL_DEBIT || 0), 0); const totalCredit = rows.reduce((s, r) => s + Number(r.TOTAL_CREDIT || 0), 0); return `<section class="panel trial-panel"><div class="statement-head"><div><span class="section-kicker">${data.demo ? 'تجريبي' : 'Oracle'}</span><h3>ميزان المراجعة</h3><p>حتى ${esc(data.period.endDate)}</p></div><span class="verified-badge">${Math.abs(totalDebit - totalCredit) < 0.01 ? 'متوازن' : 'يحتاج مراجعة'}</span></div><div class="table-scroll"><table class="trial-table"><thead><tr><th>رمز الحساب</th><th>اسم الحساب</th><th>النوع</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.ACCOUNT_CODE)}</td><td><strong>${esc(r.ACCOUNT_NAME_AR)}</strong></td><td>${esc(r.ACCOUNT_TYPE)}</td><td>${money(r.TOTAL_DEBIT)}</td><td>${money(r.TOTAL_CREDIT)}</td><td>${money(r.BALANCE)}</td></tr>`).join('') || '<tr><td colspan="6">لا توجد بيانات</td></tr>'}</tbody><tfoot><tr><th colspan="3">الإجمالي</th><th>${money(totalDebit)}</th><th>${money(totalCredit)}</th><th>${money(totalDebit - totalCredit)}</th></tr></tfoot></table></div></section>`; }

function renderRevaluationWorkspace() {
  const rows = [{ account: 'العملاء – USD', code: '1201-USD', currency: 'USD', foreign: 2000, previous: 7500, current: 7800, result: 'ربح' }, { account: 'الموردون – USD', code: '2101-USD', currency: 'USD', foreign: 1000, previous: 3750, current: 3900, result: 'خسارة' }, { account: 'البنك – USD', code: '1102-USD', currency: 'USD', foreign: 5000, previous: 18750, current: 19500, result: 'ربح' }, { account: 'الموردون – EUR', code: '2101-EUR', currency: 'EUR', foreign: 1200, previous: 4860, current: 4980, result: 'خسارة' }];
  const totalProfit = rows.filter(r => r.result === 'ربح').reduce((s, r) => s + (r.current - r.previous), 0); const totalLoss = rows.filter(r => r.result === 'خسارة').reduce((s, r) => s + (r.current - r.previous), 0); const net = totalProfit + totalLoss;
  const tableRows = data => data.map((r, index) => `<tr><td><div class="revaluation-account"><span class="revaluation-icon">⇄</span><div><strong>${r.account}</strong><small>${r.code}</small></div></div></td><td><span class="currency-chip">${r.currency}</span></td><td>${r.foreign.toLocaleString('ar-SA')}</td><td>${money(r.previous)}</td><td>${money(r.current)}</td><td class="${r.result === 'ربح' ? 'cash-in' : 'cash-out'}"><strong>${r.result === 'ربح' ? '+' : '−'} ${money(Math.abs(r.current - r.previous))}</strong></td><td><span class="status ${r.result === 'ربح' ? 'paid' : 'pending'}">${r.result}</span></td><td><input class="revaluation-select" type="checkbox" checked data-row="${index}" /></td></tr>`).join('');
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">المحاسبة والمالية / العملات الأجنبية</p><h2>إعادة تقييم العملات الأجنبية</h2><p class="toolbar-description">احتساب فروق أسعار الصرف وإنشاء قيود الأرباح والخسائر غير المحققة</p></div><div class="toolbar-actions"><button class="secondary-button" id="revaluation-history">◷ سجل التقييمات</button><button class="primary-button" id="post-revaluation">✓ اعتماد وترحيل</button></div></div><div class="revaluation-controls panel"><div class="revaluation-control"><label>الفترة المالية</label><select id="revaluation-period"><option>سبتمبر 2024</option><option>أغسطس 2024</option><option>الربع الثالث 2024</option></select></div><div class="revaluation-control"><label>تاريخ التقييم</label><input type="date" id="revaluation-date" value="2024-09-30" /></div><div class="revaluation-control"><label>العملة</label><select id="revaluation-currency"><option>كل العملات الأجنبية</option><option>USD · دولار أمريكي</option><option>EUR · يورو</option><option>YER · ريال يمني</option></select></div><div class="revaluation-control"><label>سعر الإقفال</label><div class="rate-input"><input id="revaluation-rate" type="number" value="3.90" step="0.0001" /><span>ر.س / USD</span></div></div><button class="secondary-button revaluation-calculate" id="calculate-revaluation">↻ احتساب الفروق</button></div><div class="revaluation-notice"><span>ⓘ</span><div><strong>تنبيه محاسبي</strong><p>سيتم تقييم الأرصدة النقدية والعملاء والموردين فقط. الأرصدة غير النقدية بالتكلفة التاريخية مستثناة من هذه العملية.</p></div><span class="notice-date">آخر تقييم: 31 أغسطس 2024 · لم يتم الترحيل</span></div><div class="revaluation-kpis"><div><span>الحسابات المشمولة</span><strong>${rows.length}</strong><small>3 عملات أجنبية</small></div><div><span>أرباح تقييم</span><strong class="cash-in">+ ${money(totalProfit)}</strong><small>حساب 4202</small></div><div><span>خسائر تقييم</span><strong class="cash-out">− ${money(Math.abs(totalLoss))}</strong><small>حساب 5202</small></div><div><span>صافي الأثر</span><strong class="${net >= 0 ? 'cash-in' : 'cash-out'}">${net >= 0 ? '+' : '−'} ${money(Math.abs(net))}</strong><small>على قائمة الدخل</small></div></div><section class="panel revaluation-table-panel"><div class="workspace-heading"><div><span class="section-kicker">نتائج الاحتساب</span><h3>الأرصدة المراد إعادة تقييمها</h3><p>تم العثور على ${rows.length} أرصدة تحتاج إلى تقييم بسعر الإقفال المحدد</p></div><div class="filter-group"><button id="select-all-revaluation">تحديد الكل</button><button>تصدير Excel ⇩</button></div></div><div class="table-scroll"><table class="revaluation-table"><thead><tr><th>الحساب</th><th>العملة</th><th>الرصيد الأجنبي</th><th>القيمة السابقة</th><th>القيمة الجديدة</th><th>فرق التقييم</th><th>النتيجة</th><th>تضمين</th></tr></thead><tbody id="revaluation-body">${tableRows(rows)}</tbody><tfoot><tr><th colspan="5">إجمالي الفروق المحددة</th><th class="cash-in">+ ${money(totalProfit)}</th><th colspan="2">صافي ${money(net)}</th></tr></tfoot></table></div></section><div class="revaluation-bottom"><section class="panel journal-preview"><div class="workspace-heading"><div><span class="section-kicker">معاينة القيد</span><h3>قيد إعادة التقييم المقترح</h3></div><span class="draft-badge">مسودة قبل الاعتماد</span></div><div class="journal-preview-meta"><span>المصدر: <b>REVALUATION</b></span><span>التاريخ: <b>30 سبتمبر 2024</b></span><span>العكس التلقائي: <label class="permission-toggle"><input id="auto-reverse" type="checkbox" checked /><span></span></label></span></div><table><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead><tbody><tr><td>خسائر فروق تقييم غير محققة</td><td>${money(Math.abs(totalLoss))}</td><td>—</td></tr><tr><td>العملاء والبنوك – فروق تقييم</td><td>${money(totalProfit)}</td><td>—</td></tr><tr><td>أرباح فروق تقييم غير محققة</td><td>—</td><td>${money(totalProfit)}</td></tr><tr><td>الموردون – فروق تقييم</td><td>—</td><td>${money(Math.abs(totalLoss))}</td></tr></tbody><tfoot><tr><th>الإجمالي</th><th>${money(totalProfit + Math.abs(totalLoss))}</th><th>${money(totalProfit + Math.abs(totalLoss))}</th></tr></tfoot></table></section><aside class="panel revaluation-history-panel"><div class="workspace-heading"><div><span class="section-kicker">آخر العمليات</span><h3>سجل إعادة التقييم</h3></div><button class="text-button" id="view-revaluation-history">عرض الكل</button></div><div class="revaluation-history-row"><span class="history-icon paid">✓</span><div><strong>أغسطس 2024</strong><small>USD · قيد RV-0003</small></div><b>+ ${money(1240)}</b></div><div class="revaluation-history-row"><span class="history-icon paid">✓</span><div><strong>يوليو 2024</strong><small>USD / EUR · قيد RV-0002</small></div><b>− ${money(860)}</b></div><div class="revaluation-history-row"><span class="history-icon pending">◷</span><div><strong>يونيو 2024</strong><small>مسودة · تحتاج اعتماد</small></div><b>+ ${money(430)}</b></div></aside></div>`;
  $('calculate-revaluation').addEventListener('click', () => showToast('تم إعادة احتساب فروق الصرف بسعر الإقفال المحدد'));
  $('post-revaluation').addEventListener('click', () => { state.entries.unshift({ no: `RV-${String(state.entries.length + 1).padStart(4, '0')}`, date: '2024-09-30', description: 'قيد إعادة تقييم العملات الأجنبية', debit: Math.abs(totalLoss) + totalProfit, credit: Math.abs(totalLoss) + totalProfit, status: 'مرحّل', source: 'REVALUATION' }); save(); showToast('تم اعتماد وترحيل قيد إعادة التقييم'); });
  $('revaluation-history').addEventListener('click', () => showToast('تم فتح سجل عمليات إعادة التقييم'));
  $('view-revaluation-history').addEventListener('click', () => showToast('عرض سجل التقييمات الكامل'));
  $('select-all-revaluation').addEventListener('click', () => document.querySelectorAll('.revaluation-select').forEach(input => { input.checked = true; }));
}

function renderYearCloseWorkspace() {
  const revenue = state.accounts.filter(a => a.type === 'إيراد').reduce((s, a) => s + Number(a.balance || 0), 0) || 184250; const expenses = state.accounts.filter(a => a.type === 'مصروف').reduce((s, a) => s + Number(a.balance || 0), 0) || 42180; const netProfit = revenue - expenses; const assets = state.accounts.filter(a => a.type === 'أصل').reduce((s, a) => s + Number(a.balance || 0), 0) || 184810; const liabilities = state.accounts.filter(a => a.type === 'التزام').reduce((s, a) => s + Number(a.balance || 0), 0) || 36750; const equity = assets - liabilities;
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">المحاسبة والمالية / إقفال الفترات</p><h2>إقفال السنة المالية</h2><p class="toolbar-description">إقفال حسابات الأرباح والخسائر وترحيل الأرصدة إلى السنة المالية الجديدة</p></div><div class="toolbar-actions"><button class="secondary-button" id="close-year-report">⇩ تقرير الإقفال</button><button class="primary-button" id="start-year-close">بدء معالج الإقفال</button></div></div><div class="year-close-header panel"><div class="year-selector"><span>السنة المراد إقفالها</span><select id="closing-year"><option>2024</option><option>2023</option></select><b>→</b><span>السنة الجديدة</span><select id="opening-year"><option>2025</option><option>2024</option></select></div><div class="close-status"><span class="status pending">لم يتم الإقفال</span><small>الفترة الحالية: مفتوحة</small></div></div><div class="close-steps"><div class="close-step active"><span>1</span><div><strong>فحص الجاهزية</strong><small>مراجعة القيود والفترات</small></div></div><i></i><div class="close-step"><span>2</span><div><strong>إقفال الأرباح والخسائر</strong><small>ترحيل صافي نتيجة العام</small></div></div><i></i><div class="close-step"><span>3</span><div><strong>ترحيل الأرصدة</strong><small>إنشاء الأرصدة الافتتاحية</small></div></div><i></i><div class="close-step"><span>4</span><div><strong>اعتماد السنة</strong><small>قفل الفترة نهائيًا</small></div></div></div><div class="year-close-kpis"><div><span>إجمالي الإيرادات</span><strong>${money(revenue)}</strong><small>حسابات الإيرادات</small></div><div><span>إجمالي المصروفات</span><strong>${money(expenses)}</strong><small>حسابات المصروفات</small></div><div><span>صافي نتيجة العام</span><strong class="${netProfit >= 0 ? 'cash-in' : 'cash-out'}">${netProfit >= 0 ? '+' : '−'} ${money(Math.abs(netProfit))}</strong><small>${netProfit >= 0 ? 'صافي ربح' : 'صافي خسارة'}</small></div><div><span>الأرصدة المرحّلة</span><strong>${money(assets + liabilities)}</strong><small>أصول والتزامات وحقوق ملكية</small></div></div><div class="year-close-grid"><section class="panel readiness-panel"><div class="workspace-heading"><div><span class="section-kicker">قبل الإقفال</span><h3>فحص جاهزية السنة المالية</h3><p>يجب اجتياز جميع الفحوصات قبل السماح بالإقفال النهائي.</p></div><span class="readiness-score">5 / 6</span></div><div class="readiness-progress"><span style="width:83%"></span></div><div class="readiness-row done"><span>✓</span><div><strong>ميزان المراجعة متوازن</strong><small>إجمالي المدين والدائن متساوٍ</small></div><b>مكتمل</b></div><div class="readiness-row done"><span>✓</span><div><strong>لا توجد قيود مسودة غير معالجة</strong><small>تمت مراجعة القيود قبل تاريخ الإقفال</small></div><b>مكتمل</b></div><div class="readiness-row done"><span>✓</span><div><strong>تم تنفيذ إعادة تقييم العملات</strong><small>آخر تقييم في 30 سبتمبر 2024</small></div><b>مكتمل</b></div><div class="readiness-row done"><span>✓</span><div><strong>تسوية المخزون مكتملة</strong><small>تم اعتماد الجرد النهائي</small></div><b>مكتمل</b></div><div class="readiness-row done"><span>✓</span><div><strong>أرصدة العملاء والموردين مطابقة</strong><small>تمت مراجعة أعمار الذمم</small></div><b>مكتمل</b></div><div class="readiness-row warning"><span>!</span><div><strong>توجد فاتورة مسودة تحتاج مراجعة</strong><small>فاتورة مشتريات PUR-0287 · 1,250 ر.س</small></div><button class="text-button" id="review-draft">مراجعة</button></div></section><aside class="panel closing-policy"><div class="workspace-heading"><div><span class="section-kicker">سياسة الإقفال</span><h3>خيارات الترحيل</h3></div></div><label class="close-setting"><input type="checkbox" checked /><span><strong>إقفال حسابات الإيرادات</strong><small>ترحيلها إلى ملخص الدخل</small></span></label><label class="close-setting"><input type="checkbox" checked /><span><strong>إقفال حسابات المصروفات</strong><small>ترحيلها إلى ملخص الدخل</small></span></label><label class="close-setting"><input type="checkbox" checked /><span><strong>ترحيل صافي الربح</strong><small>إلى الأرباح المحتجزة 3201</small></span></label><label class="close-setting"><input type="checkbox" checked /><span><strong>إنشاء قيد عكسي</strong><small>لإتاحة المراجعة قبل الاعتماد</small></span></label><div class="policy-note">سيتم إنشاء أرقام قيود مستقلة بمصدر <b>YEAR_CLOSE</b> مع حفظ سجل تدقيق كامل.</div></aside></div><div class="year-close-bottom"><section class="panel closing-entry-preview"><div class="workspace-heading"><div><span class="section-kicker">معاينة القيود</span><h3>قيود الإقفال والترحيل</h3></div><span class="draft-badge">مسودة قبل الاعتماد</span></div><div class="closing-tabs"><button class="active">قيد إقفال الأرباح والخسائر</button><button>قيد الأرصدة الافتتاحية</button></div><table><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>الوصف</th></tr></thead><tbody><tr><td>إيرادات المبيعات</td><td>${money(revenue)}</td><td>—</td><td>إقفال حسابات الإيرادات</td></tr><tr><td>ملخص الدخل</td><td>—</td><td>${money(revenue)}</td><td>ترحيل الإيرادات</td></tr><tr><td>ملخص الدخل</td><td>${money(expenses)}</td><td>—</td><td>ترحيل المصروفات</td></tr><tr><td>المصروفات التشغيلية</td><td>—</td><td>${money(expenses)}</td><td>إقفال حسابات المصروفات</td></tr><tr class="profit-line"><td>ملخص الدخل → الأرباح المحتجزة</td><td>${netProfit >= 0 ? '—' : money(Math.abs(netProfit))}</td><td>${netProfit >= 0 ? money(netProfit) : '—'}</td><td>${netProfit >= 0 ? 'ترحيل صافي الربح' : 'ترحيل صافي الخسارة'}</td></tr></tbody><tfoot><tr><th>الإجمالي</th><th>${money(revenue + expenses)}</th><th>${money(revenue + expenses)}</th><th>متوازن</th></tr></tfoot></table></section><aside class="panel opening-balance-panel"><div class="workspace-heading"><div><span class="section-kicker">السنة الجديدة</span><h3>الأرصدة الافتتاحية</h3></div><span class="verified-badge">متوازن</span></div><div class="opening-total"><span>إجمالي الأرصدة المرحّلة</span><strong>${money(assets + liabilities)}</strong><small>في 01 يناير 2025</small></div><div class="opening-row"><span>الأصول</span><b>${money(assets)}</b></div><div class="opening-row"><span>الالتزامات</span><b>${money(liabilities)}</b></div><div class="opening-row"><span>حقوق الملكية والأرباح المحتجزة</span><b>${money(equity)}</b></div><div class="balanced-note">✓ الأرصدة الافتتاحية متوازنة</div></aside></div><div class="year-close-footer"><div><strong>تنبيه: هذا الإجراء غير قابل للتراجع بعد الاعتماد النهائي.</strong><small>تأكد من أخذ نسخة احتياطية ومراجعة التقارير قبل المتابعة.</small></div><div><button class="secondary-button" id="preview-opening">معاينة الأرصدة الافتتاحية</button><button class="primary-button" id="finalize-year-close">اعتماد وإقفال السنة</button></div></div>`;
  $('start-year-close').addEventListener('click', () => showToast('تم تشغيل فحص الجاهزية؛ راجع التنبيه المتبقي'));
  $('close-year-report').addEventListener('click', () => showToast('تم تجهيز تقرير إقفال السنة المالية'));
  $('review-draft').addEventListener('click', () => { switchView('purchases'); showToast('تم فتح المشتريات لمراجعة الفاتورة المسودة'); });
  $('preview-opening').addEventListener('click', () => showToast('تم فتح معاينة الأرصدة الافتتاحية للسنة الجديدة'));
  $('finalize-year-close').addEventListener('click', () => { state.entries.unshift({ no: `YC-${String(state.entries.length + 1).padStart(4, '0')}`, date: '2024-12-31', description: 'قيد إقفال السنة وترحيل الأرصدة الافتتاحية', debit: revenue + expenses, credit: revenue + expenses, status: 'مرحّل', source: 'YEAR_CLOSE' }); save(); showToast('تم اعتماد قيد الإقفال وإنشاء الأرصدة الافتتاحية'); });
}

async function renderDatabaseWorkspace() {
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">الإدارة / البنية التقنية</p><h2>تهيئة قاعدة البيانات</h2><p class="toolbar-description">أنشئ اتصال النظام وتهيئة المخطط المحاسبي حسب بيئة العمل المطلوبة</p></div><div class="toolbar-actions"><button class="secondary-button" id="db-backup">⇩ نسخة احتياطية</button><button class="primary-button" id="db-save-config">حفظ الإعدادات</button></div></div><div class="db-setup-steps"><div class="db-step active"><b>1</b><span>نوع قاعدة البيانات</span></div><i></i><div class="db-step"><b>2</b><span>بيانات الاتصال</span></div><i></i><div class="db-step"><b>3</b><span>مخطط المحاسبة</span></div><i></i><div class="db-step"><b>4</b><span>التحقق والتشغيل</span></div></div><div class="db-setup-grid"><section class="panel db-config-panel"><div class="workspace-heading"><div><span class="section-kicker">مصدر البيانات</span><h3>اختر محرك قاعدة البيانات</h3><p>يمكن تغيير الاتصال لاحقًا دون فقد البيانات بعد أخذ نسخة احتياطية.</p></div><span class="db-config-status"><i></i> غير مهيأ</span></div><div class="db-engine-cards"><button class="db-engine selected" data-engine="oracle"><span class="db-engine-icon oracle">O</span><strong>Oracle Database</strong><small>مناسب للبيئات المؤسسية</small><b>موصى به</b></button><button class="db-engine" data-engine="sqlserver"><span class="db-engine-icon sql">S</span><strong>SQL Server</strong><small>اتصال عبر SQL Server</small></button><button class="db-engine" data-engine="access"><span class="db-engine-icon access">A</span><strong>Microsoft Access</strong><small>ملف محلي بصيغة .accdb</small></button></div><div class="db-form-heading"><span class="section-kicker">بيانات الاتصال</span><h3 id="db-form-title">اتصال Oracle</h3></div><div class="db-form-grid"><label>اسم الاتصال<input id="db-connection-name" value="الاتصال الرئيسي" /></label><label>اسم المستخدم<input id="db-username" placeholder="SYSTEM أو اسم المستخدم" /></label><label>كلمة المرور<input id="db-password" type="password" placeholder="كلمة المرور" /></label><label>اسم الخادم / Host<input id="db-host" value="localhost" /></label><label>المنفذ<input id="db-port" value="1521" /></label><label>اسم الخدمة / SID<input id="db-service" value="ORCL" /></label><label class="db-full-field">مسار ملف قاعدة البيانات (لـ Access)<input id="db-file" placeholder="C:\\data\\mido.accdb" disabled /></label></div><div class="db-actions"><button class="secondary-button" id="db-test">اختبار الاتصال</button><button class="primary-button" id="db-next">حفظ والانتقال للتهيئة ←</button></div><div id="db-test-result" class="db-test-result"></div><div id="db-live-log" class="db-live-log"><div class="db-log-head"><span>سجل الاختبار</span><small>جاهز</small></div><div class="db-log-line"><i class="log-dot idle"></i><span>بانتظار بدء اختبار الاتصال</span><time>—</time></div></div></section><aside class="db-setup-side"><div class="panel db-security-note"><div class="db-note-icon">✓</div><h3>تهيئة آمنة</h3><p>بيانات كلمة المرور لا تُحفظ في الواجهة. يتم تمريرها إلى طبقة الاتصال المشفرة عند تفعيل الموصل المناسب.</p><div class="db-check">✓ فحص صلاحيات إنشاء الجداول</div><div class="db-check">✓ اختبار المعاملات والـ rollback</div><div class="db-check">✓ التحقق من توازن القيد</div></div><div class="panel db-current-card"><div class="workspace-heading"><div><span class="section-kicker">الاتصال الحالي</span><h3>حالة النظام</h3></div></div><div class="current-db-row"><span class="current-db-icon">◉</span><div><strong id="current-db-name">الوضع التجريبي</strong><small id="current-db-detail">لا يوجد اتصال إنتاجي محفوظ</small></div><span class="status pending">تجريبي</span></div><button class="text-button" id="db-open-schema">عرض مخطط الجداول ←</button></div><div class="panel db-security-note db-environment-card"><div class="workspace-heading"><div><span class="section-kicker">بيئة التشغيل</span><h3>جاهزية الموصلات</h3></div></div><div class="connector-status"><span class="connector-mark ready">✓</span><div><strong>Oracle</strong><small>متصل عبر oracledb</small></div><b>جاهز</b></div><div class="connector-status"><span class="connector-mark ready">✓</span><div><strong>SQL Server</strong><small>mssql 12 · TCP</small></div><b>جاهز</b></div><div class="connector-status"><span class="connector-mark ready">✓</span><div><strong>Access / ODBC</strong><small>ODBC 2.5 · ملف محلي</small></div><b>جاهز</b></div></div></aside></div><div class="panel db-schema-preview"><div class="workspace-heading"><div><span class="section-kicker">المخطط المحاسبي</span><h3>الوحدات والجداول التي سيتم تهيئتها</h3></div><span class="schema-count">18 جدولًا · 42 قيدًا</span></div><div class="schema-grid"><div><strong>البيانات الأساسية</strong><span>الشركات والفروع · المستخدمون والأدوار · العملات والضرائب</span></div><div><strong>المحاسبة العامة</strong><span>دليل الحسابات · القيود · الفترات · مراكز التكلفة</span></div><div><strong>المبيعات والمشتريات</strong><span>الفواتير · العملاء والموردون · الدفعات · المرتجعات</span></div><div><strong>المخزون</strong><span>الأصناف · المستودعات · حركات المخزون · الجرد</span></div></div></div>`;
  const organizationPanel = document.createElement('section');
  organizationPanel.className = 'panel module-panel';
  organizationPanel.innerHTML = `<div class="workspace-heading"><div><span class="section-kicker">الإعدادات الأساسية</span><h3>بيانات الشركة والفرع الافتراضي</h3><p>تعديل هذه البيانات ينعكس على شاشة الدخول والتقارير والمستندات الجديدة.</p></div></div><form id="organization-settings-form" class="db-form-grid"><label>اسم الشركة<input id="settings-company-name" required /></label><label>رمز الشركة<input id="settings-company-code" required /></label><label>اسم الفرع الافتراضي<input id="settings-branch-name" required /></label><label>رمز الفرع<input id="settings-branch-code" required /></label><label>السنة المالية<input id="settings-fiscal-year" type="number" required /></label><label>العملة الأساسية<input id="settings-currency" value="SAR" maxlength="3" required /></label><div class="db-actions db-full-field"><button class="primary-button" type="submit">حفظ بيانات المؤسسة</button><span id="organization-settings-result" class="db-test-result"></span></div></form>`;
  $('generic-content').prepend(organizationPanel);
  try {
    const settings = await window.onyxAPI.organizationSettings();
    $('settings-company-name').value = settings.company.COMPANY_NAME_AR || '';
    $('settings-company-code').value = settings.company.COMPANY_CODE || '';
    $('settings-branch-name').value = settings.branch.BRANCH_NAME_AR || '';
    $('settings-branch-code').value = settings.branch.BRANCH_CODE || '';
    $('settings-fiscal-year').value = settings.fiscalYear.FISCAL_YEAR || new Date().getFullYear();
    $('settings-currency').value = settings.company.BASE_CURRENCY || 'SAR';
  } catch (error) { $('organization-settings-result').textContent = `تعذر قراءة الإعدادات: ${error.message}`; }
  $('organization-settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const result = $('organization-settings-result');
    result.className = 'db-test-result checking';
    result.textContent = 'جارٍ حفظ بيانات المؤسسة...';
    try {
      const saved = await window.onyxAPI.updateOrganizationSettings({ companyName: $('settings-company-name').value, companyCode: $('settings-company-code').value, branchName: $('settings-branch-name').value, branchCode: $('settings-branch-code').value, fiscalYear: $('settings-fiscal-year').value, currency: $('settings-currency').value });
      const workspaceName = document.querySelector('.workspace-name');
      const workspaceMode = document.querySelector('.workspace-mode');
      if (workspaceName) workspaceName.innerHTML = `${esc(saved.companyName)} <span>⌄</span>`;
      if (workspaceMode) workspaceMode.textContent = `فرع ${esc(saved.branchName)} · السنة ${saved.fiscalYear}`;
      result.className = 'db-test-result success';
      result.textContent = 'تم حفظ بيانات الشركة والفرع والسنة المالية.';
      showToast('تم تحديث إعدادات المؤسسة');
    } catch (error) { result.className = 'db-test-result error'; result.textContent = error.message; }
  });
  let engine = 'oracle';
  const engines = { oracle: ['اتصال Oracle', '1521', 'ORCL'], sqlserver: ['اتصال SQL Server', '1433', 'MIDO'], access: ['ملف Microsoft Access', '', ''] };
  document.querySelectorAll('.db-engine').forEach(card => card.addEventListener('click', () => { document.querySelectorAll('.db-engine').forEach(c => c.classList.remove('selected')); card.classList.add('selected'); engine = card.dataset.engine; const config = engines[engine]; $('db-form-title').textContent = config[0]; $('db-port').value = config[1]; $('db-service').value = config[2]; $('db-file').disabled = engine !== 'access'; $('db-host').disabled = engine === 'access'; $('db-username').disabled = engine === 'access'; $('db-password').disabled = engine === 'access'; }));
  const dbPayload = () => ({ engine, host: $('db-host').value, port: $('db-port').value, service: $('db-service').value, username: $('db-username').value, password: $('db-password').value, filePath: $('db-file').value }); const logDb = (message, tone = 'idle') => { const log = $('db-live-log'); if (!log) return; const line = document.createElement('div'); line.className = 'db-log-line'; line.innerHTML = `<i class=\"log-dot ${tone}\"></i><span>${esc(message)}</span><time>${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</time>`; log.appendChild(line); log.querySelectorAll('.db-log-line').forEach((item, index, all) => { if (index < all.length - 4) item.remove(); }); };
  $('db-test').addEventListener('click', async () => { const result = $('db-test-result'); result.className = 'db-test-result checking'; result.textContent = 'جارٍ فحص الاتصال وصلاحيات قاعدة البيانات عبر Backend...'; logDb(`بدء اختبار ${engine.toUpperCase()}`, 'checking'); try { const info = await window.onyxAPI.setupTestConnection(dbPayload()); let schemaNote = ''; if (engine === 'oracle') { const schema = await window.onyxAPI.setupInspectSchema(dbPayload()); schemaNote = schema.schemaReady ? ' والمخطط جاهز' : ` والمخطط ناقص ${schema.missingTables.length} جدولًا`; logDb(schema.schemaReady ? 'المخطط جاهز للاستخدام' : `الجداول الناقصة: ${schema.missingTables.join(', ')}`, schema.schemaReady ? 'success' : 'checking'); } result.className = 'db-test-result success'; result.textContent = `✓ تم الاتصال بـ ${info.engine} · المستخدم ${info.DB_USER || 'تم التحقق'}${schemaNote}.`; logDb(`نجح الاتصال بـ ${info.engine.toUpperCase()}`, 'success'); $('current-db-name').textContent = info.engine.toUpperCase(); $('current-db-detail').textContent = schemaNote || 'تم اختبار الاتصال بنجاح'; } catch (error) { result.className = 'db-test-result error'; result.textContent = `✕ ${error.message}`; logDb(error.message, 'error'); } });
  $('db-next').addEventListener('click', async () => { const result = $('db-test-result'); result.className = 'db-test-result checking'; result.textContent = 'جارٍ إنشاء الجداول وتهيئة قاعدة البيانات...'; logDb('بدء إنشاء الجداول وتهيئة قاعدة البيانات', 'checking'); try { const info = await window.onyxAPI.setupInitializeSchema(dbPayload()); document.querySelectorAll('.db-step')[0].classList.remove('active'); document.querySelectorAll('.db-step')[1].classList.add('active'); const count = info.migrations?.length || info.tables || 0; const demo = info.demoData ? ` تمت إضافة ${info.demoData.contacts} عملاء/موردين و${info.demoData.items} أصناف و${info.demoData.invoices} فواتير تجريبية.` : ''; result.className = 'db-test-result success'; result.textContent = `✓ اكتملت تهيئة المخطط الإصدار ${info.version}. تم تجهيز ${count} مكونات.${demo}`; logDb(`اكتملت التهيئة: ${info.version}`, 'success'); dataMode = 'detecting'; await refreshDbStatus(); await refreshDashboardMetrics(true); showToast('تم إنشاء القاعدة وإضافة البيانات التجريبية'); } catch (error) { result.className = 'db-test-result error'; result.textContent = `✕ تعذر إنشاء الجداول: ${error.message}`; logDb(error.message, 'error'); } });
  $('db-save-config').addEventListener('click', () => showToast('يتم حفظ الإعدادات الحساسة عبر Backend عند تفعيل مخزن الأسرار'));
  $('db-backup').addEventListener('click', () => showToast('تم تجهيز نسخة احتياطية قبل تغيير الاتصال'));
  $('db-open-schema').addEventListener('click', () => document.querySelector('.db-schema-preview').scrollIntoView({ behavior: 'smooth' }));
}


async function renderCashWorkspace() {
  const render = rows => { $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">الخزينة / السندات</p><h2>الصندوق والبنوك</h2><p class="toolbar-description">إنشاء ومراجعة سندات القبض والصرف مع حفظها في Oracle.</p></div><div class="toolbar-actions"><button class="secondary-button" id="new-payment">＋ سند صرف</button><button class="primary-button" id="new-receipt">＋ سند قبض</button></div></div><div class="panel module-panel"><div class="table-tools"><input id="cash-search" placeholder="ابحث برقم السند أو البيان..." /><span>${rows.length} سند</span></div><div class="table-scroll"><table><thead><tr><th>الرقم</th><th>النوع</th><th>التاريخ</th><th>حساب النقدية</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody id="cash-body">${renderRows(rows.map(row => [row.VOUCHER_NO || row.voucherNo, row.VOUCHER_TYPE || row.voucherType, row.VOUCHER_DATE || row.voucherDate, row.CASH_ACCOUNT_CODE || row.cashAccountCode, money(row.TOTAL_AMOUNT || row.total), row.STATUS_CODE || row.status, `<button class="text-button cash-void" data-id="${row.VOUCHER_ID || row.voucherId}">إلغاء</button>`]))}</tbody></table></div></div>`; $('new-receipt').onclick = () => openForm('cash-receipt'); $('new-payment').onclick = () => openForm('cash-payment'); $('cash-search').oninput = event => { const q = event.target.value.toLowerCase(); $('cash-body').innerHTML = renderRows(rows.filter(row => JSON.stringify(row).toLowerCase().includes(q)).map(row => [row.VOUCHER_NO, row.VOUCHER_TYPE, row.VOUCHER_DATE, row.CASH_ACCOUNT_CODE, money(row.TOTAL_AMOUNT), row.STATUS_CODE, `<button class="text-button cash-void" data-id="${row.VOUCHER_ID}">إلغاء</button>`])); bindCashVoid(); }; bindCashVoid(); }; const bindCashVoid = () => document.querySelectorAll('.cash-void').forEach(button => { button.onclick = async () => { if (!confirm('هل تريد إلغاء السند؟')) return; try { await window.onyxAPI.voidCashVoucher({ voucherId: button.dataset.id }); showToast('تم إلغاء السند'); renderCashWorkspace(); } catch (error) { showToast(error.message); } }; }); if (dataMode === 'oracle' && window.onyxAPI?.listCashVouchers) { try { render(await window.onyxAPI.listCashVouchers()); } catch (error) { render([]); showToast(error.message); } } else render([]);
}

async function renderExpensesWorkspace() {
  const render = rows => { $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">الخزينة / العمليات المالية</p><h2>المصروفات والإيرادات</h2><p class="toolbar-description">تسجيل المصروفات والإيرادات وربطها بحساب النقدية والحساب التصنيفي.</p></div><div class="toolbar-actions"><button class="secondary-button" id="new-income">＋ إيراد</button><button class="primary-button" id="new-expense">＋ مصروف</button></div></div><div class="panel module-panel"><div class="table-tools"><input id="expense-search" placeholder="ابحث برقم العملية أو البيان..." /><span>${rows.length} عملية</span></div><div class="table-scroll"><table><thead><tr><th>الرقم</th><th>النوع</th><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody id="expense-body">${renderRows(rows.map(row => [row.OPERATION_NO, row.OPERATION_TYPE, row.OPERATION_DATE, row.DESCRIPTION_AR, money(row.AMOUNT), row.STATUS_CODE, `<button class="text-button expense-void" data-id="${row.OPERATION_ID}">إلغاء</button>`]))}</tbody></table></div></div>`; $('new-expense').onclick = () => openForm('expense'); $('new-income').onclick = () => openForm('income'); document.querySelectorAll('.expense-void').forEach(button => { button.onclick = async () => { if (!confirm('هل تريد إلغاء العملية؟')) return; try { await window.onyxAPI.voidExpenseIncome({ operationId: button.dataset.id }); showToast('تم إلغاء العملية'); renderExpensesWorkspace(); } catch (error) { showToast(error.message); } }; }); }; if (dataMode === 'oracle' && window.onyxAPI?.listExpenseIncome) { try { render(await window.onyxAPI.listExpenseIncome()); } catch (error) { render([]); showToast(error.message); } } else render([]);
}

function renderModule(view) {
  if (view === 'cash') return renderCashWorkspace();
  if (view === 'expenses') return renderExpensesWorkspace();
  if (view === 'accounts') return renderAccountsWorkspace();
  if (view === 'journal') return renderJournalWorkspace();
  if (view === 'purchases') return renderPurchasesWorkspace();
  if (view === 'contacts') return renderSuppliersWorkspace();
  if (view === 'inventory') return renderInventoryWorkspace();
  if (view === 'sales') return renderSalesWorkspace();
  if (view === 'reports') return renderReportsWorkspace();
  if (view === 'revaluation') return renderRevaluationWorkspace();
  if (view === 'database') return renderDatabaseWorkspace();
  if (view === 'year-close') return renderYearCloseWorkspace();
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
  $('generic-content').innerHTML = `<div class="module-toolbar"><div><p class="eyebrow">إدارة ${esc(labels[view])}</p><h2>${esc(labels[view])}</h2></div><div class="toolbar-actions"><button class="secondary-button" id="module-report">⇩ تقرير ${esc(labels[view])}</button><button class="primary-button" id="module-action">＋ ${esc(config.action)}</button></div></div><div class="panel module-panel"><div class="table-tools"><input id="module-search" placeholder="ابحث في ${esc(labels[view])}..." /><span>${rows.length} سجل${dataMode === 'demo' ? ' · تجريبي' : ''}</span></div><div class="table-scroll"><table><thead><tr>${config.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody id="module-body">${renderRows(rows)}</tbody></table></div></div>`;
  $('module-action').addEventListener('click', () => view === 'reports' ? showToast('تم تحديث التقارير التجريبية') : openForm(view));
  $('module-report').addEventListener('click', () => showToast(`تم تجهيز تقرير ${labels[view]} للفترة الحالية`));
  $('module-search').addEventListener('input', event => {
    const q = event.target.value.toLowerCase();
    $('module-body').innerHTML = renderRows(rows.filter(row => row.join(' ').toLowerCase().includes(q)));
  });
}

function openForm(view) {
  const titles = { journal: 'قيد يومية جديد', accounts: 'إضافة حساب', sales: 'فاتورة مبيعات جديدة', purchases: 'فاتورة مشتريات جديدة', inventory: 'إضافة صنف جديد', contacts: 'إضافة جهة اتصال', 'cash-receipt': 'سند قبض جديد', 'cash-payment': 'سند صرف جديد', 'ar-receipt': 'تحصيل من عميل', 'ap-payment': 'سداد لمورد', expense: 'مصروف جديد', income: 'إيراد جديد' };
  const form = $('form-modal');
  $('entry-form').dataset.editingInvoiceId = pendingInvoiceEditId;
  pendingInvoiceEditId = '';
  $('modal-title').textContent = titles[view] || 'سجل جديد';
  if (['cash-receipt', 'cash-payment', 'expense', 'income', 'ar-receipt', 'ap-payment'].includes(view)) {
    if (view === 'ar-receipt' || view === 'ap-payment') { const fields = [['contactCode', view === 'ar-receipt' ? 'رمز العميل' : 'رمز المورد'], ['cashAccountCode', 'حساب الصندوق أو البنك'], ['invoiceNo', 'رقم الفاتورة'], ['allocationAmount', 'المبلغ المخصص', 'number'], ['amount', 'إجمالي الدفعة', 'number'], ['paymentDate', 'تاريخ الدفعة', 'date'], ['description', 'البيان']]; $('modal-fields').innerHTML = fields.map(([name, label, type = 'text']) => `<label>${label}<input name="${name}" type="${type}" step="0.01" value="${type === 'date' ? new Date().toISOString().slice(0, 10) : ''}" required /></label>`).join(''); form.dataset.view = view; form.classList.add('open'); return; }
    const isCash = view.startsWith('cash-');
    const fields = isCash ? [['cashAccountCode', 'حساب الصندوق أو البنك'], ['accountCode', view === 'cash-receipt' ? 'الحساب المقابل' : 'حساب المصروف أو الجهة'], ['amount', 'المبلغ', 'number'], ['voucherDate', 'التاريخ', 'date'], ['description', 'البيان']] : [['cashAccountCode', 'حساب الصندوق أو البنك'], [view === 'income' ? 'incomeAccountCode' : 'expenseAccountCode', view === 'income' ? 'حساب الإيراد' : 'حساب المصروف'], ['amount', 'المبلغ', 'number'], ['operationDate', 'التاريخ', 'date'], ['description', 'البيان']];
    $('modal-fields').innerHTML = fields.map(([name, label, type = 'text']) => `<label>${label}<input name="${name}" type="${type}" step="0.01" value="${type === 'date' ? new Date().toISOString().slice(0, 10) : ''}" required /></label>`).join('');
    form.dataset.view = view; form.classList.add('open'); return;
  }
  if (view === 'sales' || view === 'purchases') {
    const isSales = view === 'sales';
    const partyLabel = isSales ? 'العميل' : 'المورد';
    const partyPlaceholder = isSales ? 'ابحث باسم العميل أو رقمه...' : 'ابحث باسم المورد أو رقمه...';
    const partyButton = isSales ? '＋ عميل' : '＋ مورد';
    $('modal-fields').innerHTML = `<div class="invoice-workflow-header"><div><span class="section-kicker">دورة المستند</span><strong>${isSales ? 'مبيعات' : 'مشتريات'} · مستند جديد</strong><small>مسودة قابلة للاعتماد والترحيل</small></div><div class="invoice-shortcuts"><span class="invoice-status-pill draft">مسودة</span><kbd>F9</kbd><small>بحث</small><kbd>Ctrl+S</kbd><small>حفظ</small><kbd>Ctrl+Shift+N</kbd><small>بند</small><kbd>Esc</kbd><small>إغلاق</small></div></div><div class="customer-lookup-field invoice-party-block"><label>${partyLabel}</label><div class="lookup-inline"><input name="party" id="invoice-party-search" autocomplete="off" placeholder="${partyPlaceholder}" required /><button type="button" id="add-party-inline" class="lookup-add">${partyButton}</button></div><input name="partyCode" id="invoice-party-code" type="hidden" /><div id="invoice-party-results" class="customer-search-results"></div><div id="invoice-party-preview" class="customer-balance-preview"><span>♙</span><div><strong>لم يتم اختيار ${partyLabel}</strong><small>سيظهر الرصيد عند اختياره</small></div><b>الرصيد: —</b></div></div><label>نوع المستند<select name="documentType" id="invoice-document-type">${(isSales ? [['SALES_ORDER','أمر بيع'],['DELIVERY_NOTE','إذن تسليم'],['SALES_INVOICE','فاتورة مبيعات'],['SALES_RETURN','مردود مبيعات']] : [['PURCHASE_ORDER','أمر شراء'],['RECEIPT_NOTE','إذن استلام'],['PURCHASE_INVOICE','فاتورة مشتريات'],['PURCHASE_RETURN','مردود مشتريات']]).map(([value, label]) => `<option value="${value}" ${value === (isSales ? 'SALES_INVOICE' : 'PURCHASE_INVOICE') ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>تاريخ المستند<input name="invoiceDate" type="date" value="${new Date().toISOString().slice(0, 10)}" required /></label><label>العملة<select name="currency" id="invoice-currency">${currencies.map(c => `<option value="${c.code}">${c.name} (${c.symbol})</option>`).join('')}</select></label><label>سعر الصرف<input name="exchangeRate" id="invoice-rate" type="number" min="0.000001" step="0.000001" value="1" required /></label><label>طريقة الدفع<select name="paymentMethod"><option value="CASH">نقدًا</option><option value="CREDIT">آجل</option><option value="CHEQUE">شيك</option><option value="TRANSFER">تحويل</option><option value="MIXED">نقد وشيك</option></select></label><label>تاريخ الاستحقاق<input name="dueDate" type="date" /></label><label class="invoice-note-field">ملاحظة المستند<input name="documentNote" placeholder="مرجع أو ملاحظة داخلية" /></label><div class="invoice-lines-editor"><div class="invoice-lines-head"><strong>بنود المستند</strong><button type="button" class="lookup-add" id="invoice-add-line">＋ إضافة بند</button></div><div class="invoice-line-table-wrap"><table class="invoice-line-table"><thead><tr><th>رمز الصنف</th><th>الوصف</th><th>الكمية</th><th>${isSales ? 'سعر البيع' : 'سعر الشراء'}</th><th>الإجمالي</th><th></th></tr></thead><tbody id="invoice-lines"></tbody></table></div><div class="invoice-summary"><span>قبل الضريبة <b id="invoice-subtotal">0</b></span><label>الضريبة<input name="taxAmount" id="invoice-tax" type="number" min="0" step="0.01" value="0" /></label><strong>الإجمالي <b id="invoice-total">0</b></strong></div></div>`;
    form.dataset.view = view; form.classList.add('open');
    setupInvoicePartyLookup(isSales ? 'عميل' : 'مورد');
    setupInvoiceLines(view);
    if ($('entry-form').dataset.editingInvoiceId) loadInvoiceIntoForm(Number($('entry-form').dataset.editingInvoiceId), view);
    const warehouseLabel = document.createElement('label'); warehouseLabel.innerHTML = 'رمز المستودع<input name="warehouseCode" placeholder="WH-001" />'; $('invoice-rate')?.closest('label')?.before(warehouseLabel);
    setupInvoiceHotkeys();
    $('add-party-inline').addEventListener('click', () => { closeForm(); openForm('contacts'); });
    return;
  }
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

async function loadInvoiceIntoForm(invoiceId) {
  try { const invoice = await window.onyxAPI.getInvoice(invoiceId); $('invoice-party-code').value = invoice.CONTACT_CODE || ''; $('invoice-party-search').value = invoice.CONTACT_CODE || ''; $('entry-form').querySelector('[name="invoiceDate"]').value = String(invoice.INVOICE_DATE || '').slice(0, 10); $('entry-form').querySelector('[name="paymentMethod"]').value = invoice.PAYMENT_METHOD || 'CREDIT'; for (let i = 1; i < invoice.lines.length; i += 1) $('invoice-add-line').click(); const lineRows = document.querySelectorAll('#invoice-lines .invoice-line'); invoice.lines.forEach((line, index) => { const row = lineRows[index]; if (!row) return; row.querySelector('[data-field="itemCode"]').value = line.itemCode || ''; row.querySelector('[data-field="description"]').value = line.description || ''; row.querySelector('[data-field="quantity"]').value = line.quantity; row.querySelector('[data-field="unitPrice"]').value = line.unitPrice; }); showToast(`تحرير الفاتورة ${invoice.INVOICE_NO}`); } catch (error) { closeForm(); showToast(error.message); }
}

async function editInvoice(invoiceId) { const invoice = await window.onyxAPI.getInvoice(invoiceId); const view = invoice.INVOICE_TYPE === 'PURCHASE' ? 'purchases' : 'sales'; pendingInvoiceEditId = String(invoiceId); switchView(view); setTimeout(() => openForm(view), 0); }
async function deleteInvoice(invoiceId) { if (!window.confirm('سيتم إلغاء الفاتورة وعكس حركة المخزون. هل تريد المتابعة؟')) return; try { await window.onyxAPI.voidInvoice(invoiceId); showToast('تم إلغاء الفاتورة وعكس حركة المخزون'); await loadLiveRows(currentView); } catch (error) { showToast(error.message); } }

function setupInvoiceHotkeys() { const form = $('entry-form'); if (form.dataset.invoiceHotkeysBound === '1') return; form.dataset.invoiceHotkeysBound = '1'; form.addEventListener('keydown', event => { const view = form.dataset.view; if (view !== 'sales' && view !== 'purchases') return; const target = event.target; const typing = ['INPUT','TEXTAREA','SELECT'].includes(target.tagName); if (event.key === 'Escape') { event.preventDefault(); closeForm(); return; } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); form.requestSubmit(); return; } if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); form.requestSubmit(); return; } if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); $('invoice-add-line')?.click(); return; } if (event.ctrlKey && event.key === 'Backspace') { const row = target.closest('.invoice-line'); const remove = row?.querySelector('.line-remove'); if (remove && document.querySelectorAll('#invoice-lines .invoice-line').length > 1) { event.preventDefault(); remove.click(); } return; } if (event.key === 'F9') { event.preventDefault(); const party = $('invoice-party-search'); const item = document.querySelector('#invoice-lines .invoice-line:last-child [data-field="itemCode"]'); (party && !party.value ? party : item || party)?.focus(); return; } if (event.altKey && /^[1-6]$/.test(event.key)) { event.preventDefault(); const fields = { 1: 'invoice-document-type', 2: 'invoice-party-search', 3: 'invoice-currency', 4: 'invoice-rate', 5: 'invoice-tax', 6: 'invoice-add-line' }; const field = $(fields[event.key]); if (field) field.focus(); return; } if (typing && event.key === 'Enter' && target.matches('[data-field="itemCode"], [data-field="unitPrice"], [data-field="quantity"]')) { event.preventDefault(); const next = target.closest('.invoice-line')?.nextElementSibling?.querySelector('[data-field="itemCode"]'); if (next) next.focus(); else $('invoice-add-line')?.click(); } }); }

function setupInvoiceLines(view) {
  const tbody = $('invoice-lines'); const currency = $('invoice-currency'); const tax = $('invoice-tax');
  const format = value => moneyInCurrency(value, currency?.value || 'SAR');
  const recalc = () => { let subtotal = 0; tbody.querySelectorAll('.invoice-line').forEach(row => { const qty = Number(row.querySelector('[data-field="quantity"]').value || 0); const price = Number(row.querySelector('[data-field="unitPrice"]').value || 0); const total = Math.max(0, qty * price); subtotal += total; row.querySelector('[data-field="lineTotal"]').textContent = format(total); }); const taxAmount = Number(tax?.value || 0); $('invoice-subtotal').textContent = format(subtotal); $('invoice-total').textContent = format(subtotal + taxAmount); };
  const addRow = () => { const row = document.createElement('tr'); row.className = 'invoice-line'; row.innerHTML = `<td><input data-field="itemCode" placeholder="رمز الصنف" required /></td><td><input data-field="description" placeholder="وصف اختياري" /></td><td><input data-field="quantity" type="number" min="0.01" step="0.01" value="1" required /></td><td><input data-field="unitPrice" type="number" min="0" step="0.01" value="0" required /></td><td data-field="lineTotal">${format(0)}</td><td><button type="button" class="line-remove" aria-label="حذف البند">×</button></td>`; row.querySelectorAll('input').forEach(input => input.addEventListener('input', recalc)); row.querySelector('.line-remove').addEventListener('click', () => { if (tbody.children.length > 1) { row.remove(); recalc(); } }); tbody.appendChild(row); recalc(); };
  $('invoice-add-line').addEventListener('click', addRow); tax.addEventListener('input', recalc); currency.addEventListener('change', recalc); addRow();
}

function customerBalance(customer) { return state.invoices.filter(i => i.kind === 'مبيعات' && (i.party === customer.name || i.party === customer.code)).reduce((sum, i) => sum + Number(i.total || 0), 0); }

function supplierBalance(supplier) { return state.invoices.filter(i => i.kind === 'مشتريات' && (i.party === supplier.name || i.party === supplier.code)).reduce((sum, i) => sum + Number(i.total || 0), 0); }

function setupInvoicePartyLookup(type) {
  const search = $('invoice-party-search'); const results = $('invoice-party-results'); const code = $('invoice-party-code'); const preview = $('invoice-party-preview'); let liveParties = [];
  const normalize = party => ({ code: party.code || party.CODE, name: party.name || party.NAME_AR, phone: party.phone || party.PHONE, type: party.type || party.CONTACT_TYPE });
  const selectParty = partyCode => { const party = liveParties.find(c => c.code === partyCode) || state.contacts.find(c => c.code === partyCode); if (!party) return; const balance = type === 'عميل' ? customerBalance(party) : supplierBalance(party); code.value = party.code; search.value = `${party.name} · ${party.code}`; preview.innerHTML = `<span class="customer-selected-icon">✓</span><div><strong>${esc(party.name)}</strong><small>${esc(party.code)} · ${esc(party.phone || 'بدون هاتف')}</small></div><b>الرصيد: ${money(balance)}</b>`; results.classList.remove('visible'); };
  const render = async () => { const q = search.value.trim().toLowerCase(); if (dataMode === 'oracle' && window.onyxAPI?.modernContacts) { try { liveParties = (await window.onyxAPI.modernContacts(q)).map(normalize).filter(c => c.type === (type === 'عميل' ? 'CUSTOMER' : 'VENDOR')); } catch (_) { liveParties = []; } } else liveParties = state.contacts.filter(c => c.type === type); const parties = liveParties.filter(c => `${c.code} ${c.name} ${c.phone || ''}`.toLowerCase().includes(q)).slice(0, 8); results.innerHTML = parties.length ? parties.map(c => `<button type="button" class="customer-result" data-party-code="${esc(c.code)}"><span class="customer-result-icon">♙</span><span><strong>${esc(c.name)}</strong><small>${esc(c.code)} · ${esc(c.phone || 'بدون هاتف')}</small></span><b>الرصيد ${money(type === 'عميل' ? customerBalance(c) : supplierBalance(c))}</b></button>`).join('') : '<div class="item-no-results">لا توجد نتائج مطابقة</div>'; results.classList.add('visible'); results.querySelectorAll('.customer-result').forEach(button => button.addEventListener('click', () => selectParty(button.dataset.partyCode))); };
  search.addEventListener('focus', render); search.addEventListener('input', render); document.addEventListener('click', event => { if (!event.target.closest('.customer-lookup-field')) results.classList.remove('visible'); }, { once: true });
}

function setupInvoiceItemLookup(view) {
  const search = $('invoice-item-search'); const results = $('invoice-item-results'); const code = $('invoice-item-code'); const price = $('invoice-unit-price'); const qty = document.querySelector('#modal-fields input[name="quantity"]'); const currency = $('invoice-currency'); const rate = $('invoice-rate'); const preview = $('invoice-item-preview');
  const updateTotal = () => { const item = state.items.find(i => i.code === code.value); const quantity = Number(qty.value || 0); const unitPrice = Number(price.value || 0); const selectedCurrency = currencyInfo(currency.value); $('invoice-item-cost').textContent = item ? moneyInCurrency(item.cost / Number(rate.value || 1), currency.value) : '—'; $('invoice-item-stock').textContent = item ? `${Number(item.qty).toLocaleString('ar-SA')} ${item.unit}` : '—'; $('invoice-total').textContent = moneyInCurrency(quantity * unitPrice, currency.value); $('invoice-total-base').textContent = money(quantity * unitPrice * Number(rate.value || selectedCurrency.rate)); };
  const selectItem = itemCode => { const item = state.items.find(i => i.code === itemCode); if (!item) return; code.value = item.code; search.value = `${item.name} · ${item.code}`; price.value = view === 'sales' ? item.sale : item.cost; preview.innerHTML = `<span class="selected-item-icon">✓</span><div><strong>${esc(item.name)}</strong><small>${esc(item.code)} · ${esc(item.unit)} · تكلفة ${money(item.cost)}</small></div><b>${Number(item.qty).toLocaleString('ar-SA')} متاح</b>`; results.classList.remove('visible'); updateTotal(); };
  const render = () => { const q = search.value.trim().toLowerCase(); const matches = state.items.filter(item => !q || `${item.code} ${item.name} ${item.unit}`.toLowerCase().includes(q)).slice(0, 8); results.innerHTML = matches.length ? matches.map(item => `<button type="button" class="item-result" data-item-code="${esc(item.code)}"><span class="item-result-icon">▤</span><span><strong>${esc(item.name)}</strong><small>${esc(item.code)} · ${esc(item.unit)}</small></span><b>${Number(item.qty).toLocaleString('ar-SA')} متاح</b><em>${moneyInCurrency(view === 'sales' ? item.sale : item.cost, currency.value)}</em></button>`).join('') : '<div class="item-no-results">لا توجد أصناف مطابقة للبحث</div>'; results.classList.add('visible'); results.querySelectorAll('.item-result').forEach(button => button.addEventListener('click', () => selectItem(button.dataset.itemCode))); };
  search.addEventListener('focus', render); search.addEventListener('input', render); currency.addEventListener('change', () => { rate.value = currencyInfo(currency.value).rate; updateTotal(); if (search.value) render(); }); rate.addEventListener('input', updateTotal); price.addEventListener('input', updateTotal); qty.addEventListener('input', updateTotal); document.addEventListener('click', event => { if (!event.target.closest('.item-lookup-field')) results.classList.remove('visible'); }, { once: true }); updateTotal();
}

function setupSalesCustomerLookup() {
  const search = $('sales-customer-search'); const results = $('sales-customer-results'); const code = $('sales-customer-code'); const preview = $('sales-customer-preview');
  const selectCustomer = customerCode => { const customer = state.contacts.find(c => c.code === customerCode); if (!customer) return; const balance = customerBalance(customer); code.value = customer.code; search.value = `${customer.name} · ${customer.code}`; preview.innerHTML = `<span class="customer-selected-icon">✓</span><div><strong>${esc(customer.name)}</strong><small>${esc(customer.code)} · ${esc(customer.phone || 'بدون هاتف')}</small></div><b>الرصيد: ${money(balance)}</b>`; results.classList.remove('visible'); };
  const render = () => { const q = search.value.trim().toLowerCase(); const customers = state.contacts.filter(c => c.type === 'عميل' && `${c.code} ${c.name} ${c.phone || ''}`.toLowerCase().includes(q)).slice(0, 8); results.innerHTML = customers.length ? customers.map(c => `<button type="button" class="customer-result" data-customer-code="${esc(c.code)}"><span class="customer-result-icon">♙</span><span><strong>${esc(c.name)}</strong><small>${esc(c.code)} · ${esc(c.phone || 'بدون هاتف')}</small></span><b>الرصيد ${money(customerBalance(c))}</b></button>`).join('') : '<div class="item-no-results">لا توجد نتائج عملاء مطابقة</div>'; results.classList.add('visible'); results.querySelectorAll('.customer-result').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.customerCode))); };
  search.addEventListener('focus', render); search.addEventListener('input', render); document.addEventListener('click', event => { if (!event.target.closest('.customer-lookup-field')) results.classList.remove('visible'); }, { once: true });
}

function setupSalesItemLookup() {
  const search = $('sales-item-search'); const results = $('sales-item-results'); const code = $('sales-item-code'); const price = $('sales-unit-price'); const qty = document.querySelector('#modal-fields input[name="quantity"]'); const preview = $('sales-item-preview');
  const render = () => { const query = search.value.trim().toLowerCase(); const matches = state.items.filter(item => !query || `${item.code} ${item.name} ${item.unit}`.toLowerCase().includes(query)).slice(0, 8); results.innerHTML = matches.length ? matches.map(item => `<button type="button" class="item-result" data-item-code="${esc(item.code)}"><span class="item-result-icon">▤</span><span><strong>${esc(item.name)}</strong><small>${esc(item.code)} · ${esc(item.unit)}</small></span><b>${Number(item.qty).toLocaleString('ar-SA')} متاح</b><em>${money(item.sale)}</em></button>`).join('') : '<div class="item-no-results">لا توجد أصناف مطابقة للبحث</div>'; results.classList.add('visible'); results.querySelectorAll('.item-result').forEach(button => button.addEventListener('click', () => selectItem(button.dataset.itemCode))); };
  const selectItem = itemCode => { const item = state.items.find(i => i.code === itemCode); if (!item) return; code.value = item.code; search.value = `${item.name} · ${item.code}`; price.value = item.sale; preview.innerHTML = `<span class="selected-item-icon">✓</span><div><strong>${esc(item.name)}</strong><small>${esc(item.code)} · ${esc(item.unit)} · تكلفة ${money(item.cost)}</small></div><b>${Number(item.qty).toLocaleString('ar-SA')} متاح</b>`; results.classList.remove('visible'); updateTotal(); };
  const updateTotal = () => { const item = state.items.find(i => i.code === code.value); const quantity = Number(qty.value || 0); $('sales-item-cost').textContent = item ? money(item.cost) : '—'; $('sales-item-stock').textContent = item ? `${Number(item.qty).toLocaleString('ar-SA')} ${item.unit}` : '—'; $('sales-item-total').textContent = money(quantity * Number(price.value || 0)); };
  search.addEventListener('focus', render); search.addEventListener('input', render); price.addEventListener('input', updateTotal); qty.addEventListener('input', updateTotal); document.addEventListener('click', event => { if (!event.target.closest('.item-lookup-field')) results.classList.remove('visible'); }, { once: true }); updateTotal();
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
    const lines = Array.isArray(data.lines) ? data.lines : [];
    const isSales = view === 'sales'; const invoiceType = isSales ? 'SALES_INVOICE' : 'PURCHASE_INVOICE';
    if (data.documentType && data.documentType !== invoiceType) { const docs = Array.isArray(state.tradeDocuments) ? state.tradeDocuments : []; const ref = `${data.documentType.slice(0, 3)}-${String(docs.length + 1).padStart(4, '0')}`; const movement = { DELIVERY_NOTE: -1, RECEIPT_NOTE: 1, SALES_RETURN: 1, PURCHASE_RETURN: -1 }[data.documentType] || 0; for (const line of lines) { const item = state.items.find(i => i.code === line.itemCode); if (!item) throw new Error(`الصنف غير موجود: ${line.itemCode}`); const delta = movement * Number(line.quantity || 0); if (delta < 0 && Number(item.qty) < Math.abs(delta)) throw new Error(`الرصيد المخزني غير كافٍ للصنف ${item.name}.`); if (movement) item.qty = Number(item.qty) + delta; } docs.unshift({ ref, documentType: data.documentType, party: data.party, partyCode: data.partyCode, date: data.invoiceDate || date, status: 'مسودة', lines }); state.tradeDocuments = docs; save(); return; }
    if (!lines.length) throw new Error('أضف بندًا واحدًا على الأقل.');
    const sale = view === 'sales'; const quantityTotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0); const tax = Number(data.taxAmount || 0); const total = subtotal + tax; const currency = data.currency || 'SAR'; const exchangeRate = Number(data.exchangeRate || currencyInfo(currency).rate || 1); const baseTotal = total * exchangeRate;
    for (const line of lines) { const item = state.items.find(i => i.code === line.itemCode); if (!item) throw new Error(`الصنف غير موجود: ${line.itemCode}`); if (sale && Number(item.qty) < Number(line.quantity)) throw new Error(`الرصيد المخزني غير كافٍ للصنف ${item.name}.`); }
    const ref = `${sale ? 'INV' : 'PUR'}-${String(state.invoices.length + 1).padStart(4, '0')}`; const costTotal = lines.reduce((sum, line) => { const item = state.items.find(i => i.code === line.itemCode); return sum + Number(item.cost || 0) * Number(line.quantity || 0); }, 0);
    state.invoices.unshift({ ref, kind: sale ? 'مبيعات' : 'مشتريات', party: data.party, partyCode: data.partyCode, total, baseTotal, currency, exchangeRate, date: data.invoiceDate || date, status: 'مرحّل', lines, tax, stockMovement: { count: lines.length, quantity: sale ? -quantityTotal : quantityTotal } });
    state.entries.unshift({ no: `JV-${String(state.entries.length + 1).padStart(4, '0')}`, date: data.invoiceDate || date, description: sale ? `قيد فاتورة مبيعات ${ref}` : `قيد فاتورة مشتريات ${ref}`, debit: baseTotal + (sale ? costTotal * exchangeRate : 0), credit: baseTotal + (sale ? costTotal * exchangeRate : 0), currency, exchangeRate, status: 'مرحّل', source: sale ? 'SALE_INVOICE' : 'PURCHASE_INVOICE' });
    state.stockMovements = Array.isArray(state.stockMovements) ? state.stockMovements : [];
    for (const line of lines) { const item = state.items.find(i => i.code === line.itemCode); const qty = Number(line.quantity || 0); const price = Number(line.unitPrice || 0); state.stockMovements.unshift({ ref, itemCode: item.code, type: sale ? 'SALE' : 'PURCHASE', quantity: sale ? -qty : qty, unitCost: sale ? item.cost : price, date: data.invoiceDate || date }); item.qty = Number(item.qty) + (sale ? -qty : qty); }
  }
  save();
}

function collectInvoiceFormData(view) { const form = $('entry-form'); const data = Object.fromEntries(new FormData(form)); if (view !== 'sales' && view !== 'purchases') return data; const lines = [...document.querySelectorAll('#invoice-lines .invoice-line')].map(row => ({ itemCode: row.querySelector('[data-field="itemCode"]').value.trim(), description: row.querySelector('[data-field="description"]').value.trim(), quantity: Number(row.querySelector('[data-field="quantity"]').value), unitPrice: Number(row.querySelector('[data-field="unitPrice"]').value) })).filter(line => line.itemCode); if (!lines.length) throw new Error('أضف بندًا واحدًا على الأقل إلى الفاتورة.'); return { ...data, lines, taxAmount: Number(data.taxAmount || 0), exchangeRate: Number(data.exchangeRate || 1), invoiceDate: data.invoiceDate || new Date().toISOString().slice(0, 10) }; }

$('entry-form').addEventListener('submit', async event => {
  event.preventDefault();
  const view = event.currentTarget.dataset.view;
  const data = collectInvoiceFormData(view);
  if (view === 'security-user') {
    try {
      if (dataMode === 'demo') { state.users.push({ username: data.username, displayNameAr: data.displayNameAr, role: data.role || 'مستخدم' }); save(); }
      else await window.onyxAPI.createUser(data);
      closeForm(); await renderSecurity(); showToast('تم إنشاء المستخدم بنجاح');
    } catch (error) { showToast(error.message); }
    return;
  }
  try {
    if (dataMode === 'oracle' && window.onyxAPI) {
      if (view === 'accounts') await window.onyxAPI.createAccount({ code: data.code, name: data.name, type: data.type });
      else if (view === 'inventory') await window.onyxAPI.createItem({ code: data.code, name: data.name, unit: data.unit, quantity: data.qty, cost: data.cost, sale: data.sale });
      else if (view === 'contacts') await window.onyxAPI.createContact({ code: data.code, name: data.name, type: data.type.includes('مورد') ? 'VENDOR' : 'CUSTOMER', phone: data.phone, email: data.email });
      else if (view === 'journal') await window.onyxAPI.createJournal({ description: data.description, lines: [{ accountCode: data.debitAccount, debit: Number(data.amount), credit: 0 }, { accountCode: data.creditAccount, debit: 0, credit: Number(data.amount) }] });
      else if (view === 'cash-receipt' || view === 'cash-payment') await window.onyxAPI.createCashVoucher({ voucherType: view === 'cash-receipt' ? 'RECEIPT' : 'PAYMENT', cashAccountCode: data.cashAccountCode, lines: [{ accountCode: data.accountCode, amount: Number(data.amount), description: data.description }], voucherDate: data.voucherDate, description: data.description });
      else if (view === 'ar-receipt' || view === 'ap-payment') { const result = await window.onyxAPI.createReceivablePayment({ paymentType: view === 'ar-receipt' ? 'RECEIPT' : 'PAYMENT', contactCode: data.contactCode, cashAccountCode: data.cashAccountCode, amount: Number(data.amount), paymentDate: data.paymentDate, description: data.description, allocations: [{ invoiceNo: data.invoiceNo, amount: Number(data.allocationAmount) }] }); await window.onyxAPI.postReceivablePayment({ paymentId: result.paymentId }); }
      else if (view === 'expense' || view === 'income') await window.onyxAPI.createExpenseIncome({ operationType: view === 'income' ? 'INCOME' : 'EXPENSE', cashAccountCode: data.cashAccountCode, [view === 'income' ? 'incomeAccountCode' : 'expenseAccountCode']: data.incomeAccountCode || data.expenseAccountCode, amount: Number(data.amount), description: data.description, operationDate: data.operationDate });
      else if (view === 'sales' || view === 'purchases') { const invoiceType = view === 'sales' ? 'SALES_INVOICE' : 'PURCHASE_INVOICE'; if (data.documentType && data.documentType !== invoiceType) await window.onyxAPI.createTradeDocument({ documentType: data.documentType, contactCode: data.partyCode || data.party, currencyCode: data.currency || 'SAR', exchangeRate: data.exchangeRate, documentDate: data.invoiceDate, paymentMethod: data.paymentMethod, dueDate: data.dueDate || null, documentNote: data.documentNote || null, lines: data.lines }); else if ($('entry-form').dataset.editingInvoiceId) await window.onyxAPI.updateInvoice({ invoiceId: Number($('entry-form').dataset.editingInvoiceId), type: view === 'sales' ? 'SALE' : 'PURCHASE', contactCode: data.partyCode || data.party, currency: data.currency || 'SAR', exchangeRate: data.exchangeRate, taxAmount: data.taxAmount, invoiceDate: data.invoiceDate, paymentMethod: data.paymentMethod || 'CREDIT', paidAmount: data.paymentMethod === 'CASH' ? undefined : Number(data.paidAmount || 0), lines: data.lines }); else await window.onyxAPI.createInvoice({ type: view === 'sales' ? 'SALE' : 'PURCHASE', contactCode: data.partyCode || data.party, currency: data.currency || 'SAR', exchangeRate: data.exchangeRate, warehouseCode: data.warehouseCode || null, taxAmount: data.taxAmount, invoiceDate: data.invoiceDate, paymentMethod: data.paymentMethod || 'CREDIT', paidAmount: data.paymentMethod === 'CASH' ? undefined : Number(data.paidAmount || 0), lines: data.lines }); }
    } else {
      await submitLocal(view, data);
    }
    $('entry-form').dataset.editingInvoiceId = ''; closeForm(); renderModule(view); refreshDashboardMetrics(true); showToast(dataMode === 'demo' ? 'تم الحفظ في الوضع التجريبي' : 'تم حفظ السجل بنجاح');
  } catch (error) {
    if (dataMode === 'oracle') {
      console.error('Oracle write failed; no demo fallback was performed:', error);
      showToast('تعذر الحفظ في Oracle. لم تُحفظ بيانات بديلة؛ تحقق من الاتصال والصلاحيات.');
    } else showToast(error.message);
  }
});

document.querySelectorAll('[data-view]').forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));
$('new-entry').addEventListener('click', () => { switchView('journal'); setTimeout(() => openForm('journal'), 0); });
$('hero-new-entry')?.addEventListener('click', () => { switchView('journal'); setTimeout(() => openForm('journal'), 0); });
$('refresh-dashboard')?.addEventListener('click', async () => { await refreshDbStatus(); await refreshDashboardMetrics(true); showToast('تم تحديث مؤشرات لوحة التحكم'); });
$('global-search')?.addEventListener('click', () => showToast('استخدم البحث داخل الوحدة للوصول السريع'));
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
  if (!window.onyxAPI?.dbTest) { setDemoMode(); return false; }
  status.classList.add('checking'); status.innerHTML = '<i></i> جارٍ الاتصال';
  try {
    const info = await window.onyxAPI.dbTest();
    dataMode = 'oracle'; status.classList.remove('checking', 'demo'); status.classList.add('connected'); const engineLabel = info.engine === 'access' ? 'Access MDB' : info.engine === 'sqlite' ? 'SQLite' : 'Oracle'; status.innerHTML = `<i></i> ${engineLabel}: ${esc(info.DB_USER || info.DB_PATH || '')}`;
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
    if (view === 'sales' || view === 'purchases') { rows = await window.onyxAPI.listInvoices({ invoiceType: view === 'sales' ? 'SALE' : 'PURCHASE' }); const body = $(view === 'sales' ? 'sales-body' : 'purchase-body'); if (body) { body.innerHTML = rows.map(i => `<tr><td><strong class="journal-number">#${esc(i.INVOICE_NO)}</strong></td><td><strong>${esc(i.CONTACT_NAME || i.CONTACT_CODE || '—')}</strong></td><td>${esc(i.INVOICE_DATE || '')}</td><td><strong>${money(i.TOTAL_AMOUNT)}</strong></td><td>${money(i.OUTSTANDING_AMOUNT)}</td><td><span class="status ${i.STATUS_CODE === 'POSTED' ? 'paid' : 'pending'}">${esc(i.STATUS_CODE)}</span></td><td><button class="row-action invoice-edit" data-invoice-id="${i.INVOICE_ID}">تعديل</button><button class="row-action invoice-delete" data-invoice-id="${i.INVOICE_ID}">حذف</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-cell">لا توجد فواتير في قاعدة البيانات.</td></tr>'; body.querySelectorAll('.invoice-edit').forEach(button => button.addEventListener('click', () => editInvoice(Number(button.dataset.invoiceId)))); body.querySelectorAll('.invoice-delete').forEach(button => button.addEventListener('click', () => deleteInvoice(Number(button.dataset.invoiceId)))); } return; }
    if (view === 'cash' || view === 'expenses') return;
    if (view === 'journal') rows = await window.onyxAPI.journal(50);
    if (view === 'inventory') { const body = $('inventory-body'); if (body) body.innerHTML = rows.map(i => `<tr><td><strong>${esc(i.ITEM_NAME_AR)}</strong></td><td>${esc(i.ITEM_CODE)}</td><td>${esc(i.UNIT_NAME)}</td><td>${Number(i.QUANTITY || 0).toLocaleString('ar-SA')}</td><td>—</td><td>${money(i.COST_PRICE)}</td><td><span class="status paid">نشط</span></td><td><button class="row-menu">•••</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty-cell">لا توجد أصناف في Oracle.</td></tr>'; return; }
    if (!rows.length || !$('module-body')) return;
    const mapped = view === 'accounts' ? rows.map(a => [a.ACCOUNT_CODE || a.A_CODE, a.ACCOUNT_NAME_AR || a.A_NAME, a.ACCOUNT_TYPE || a.A_LEVEL || '', money(a.OPENING_BALANCE ?? a.DR)]) : view === 'contacts' ? rows.map(c => [c.CODE || c.C_CODE || '', c.NAME_AR || c.C_A_NAME || '', c.CONTACT_TYPE || 'CUSTOMER', c.PHONE || c.C_PHONE || c.C_MOBILE || '']) : view === 'inventory' ? rows.map(i => [i.ITEM_CODE, i.ITEM_NAME_AR, i.UNIT_NAME, i.QUANTITY, money(i.COST_PRICE)]) : rows.map(j => [j.DOC_NO || j.JV_NO || '', j.DOC_DATE || j.AD_DATE || '', j.DOC_DESC || j.DESCRIPTION || '', money(j.DEBIT || j.DR), money(j.CREDIT || j.CR), '<span class="status paid">مستورد</span>']);
    $('module-body').innerHTML = renderRows(mapped);
    const count = document.querySelector('.table-tools span'); if (count) count.textContent = `${rows.length} سجل من Oracle`;
  } catch (error) { console.warn('Oracle module read unavailable:', error.message); }
}

async function refreshDashboardMetrics(force = false) {
  const cards = document.querySelectorAll('.metric-card>strong');
  if (dataMode === 'oracle' && window.onyxAPI?.dashboard) {
    try {
      const cacheIsFresh = dashboardCache.data && Date.now() - dashboardCache.fetchedAt < DASHBOARD_CACHE_TTL_MS;
      if (!force && cacheIsFresh) {
        const data = dashboardCache.data;
        if (cards[0]) cards[0].innerHTML = `${Number(data.journals || 0).toLocaleString('ar-SA')} <small>عملية</small>`;
        if (cards[1]) cards[1].innerHTML = `${Number(data.accounts || 0).toLocaleString('ar-SA')} <small>حساب</small>`;
        if (cards[2]) cards[2].innerHTML = `${Number(data.customers || 0).toLocaleString('ar-SA')} <small>جهة</small>`;
        return;
      }
      if (force) dashboardCache.data = null;
      if (!dashboardCache.request) dashboardCache.request = window.onyxAPI.dashboard();
      const data = await dashboardCache.request;
      dashboardCache.data = data;
      dashboardCache.fetchedAt = Date.now();
      dashboardCache.request = null;
      if (cards[0]) cards[0].innerHTML = `${Number(data.journals || 0).toLocaleString('ar-SA')} <small>عملية</small>`;
      if (cards[1]) cards[1].innerHTML = `${Number(data.accounts || 0).toLocaleString('ar-SA')} <small>حساب</small>`;
      if (cards[2]) cards[2].innerHTML = `${Number(data.customers || 0).toLocaleString('ar-SA')} <small>جهة</small>`;
      return;
    } catch (error) {
      dashboardCache.request = null;
      console.error('Oracle dashboard read failed; demo metrics were not shown:', error);
      showToast('تعذر تحديث مؤشرات Oracle. لم تُعرض مؤشرات تجريبية بدلًا منها.');
      return;
    }
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
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">الإدارة / أمن النظام</p><h2>المستخدمون والصلاحيات</h2><p class="toolbar-description">تحكم مركزي في الوصول، الأدوار، نطاق البيانات، وسجل الأنشطة الحساسة</p></div><div class="toolbar-actions"><button class="secondary-button" id="security-report">⇩ تقرير الأمان</button><button class="primary-button" id="security-add-user">＋ مستخدم جديد</button></div></div><div class="security-tabs"><button class="security-tab active" data-security-tab="users">المستخدمون</button><button class="security-tab" data-security-tab="roles">الأدوار والصلاحيات</button><button class="security-tab" data-security-tab="audit">سجل التدقيق <b>12</b></button><button class="security-tab" data-security-tab="sessions">جلسات الدخول</button><button class="security-tab" data-security-tab="settings">إعدادات الحماية</button></div><div id="security-content"></div>`;
  const renderUsersTab = async () => { const users = dataMode === 'demo' ? state.users : await window.onyxAPI.listUsers(); const rows = users.length ? users.map(u => { const name = u.DISPLAY_NAME_AR || u.displayNameAr; const username = u.USERNAME || u.username; const role = u.ROLE_NAME_AR || u.role || 'مستخدم'; return `<tr><td><div class="security-user-cell"><span class="user-avatar">${esc((name || 'م').slice(0, 1))}</span><div><strong>${esc(name)}</strong><small>${esc(username)}</small></div></div></td><td><span class="role-chip">${esc(role)}</span></td><td><span class="scope-chip">شركة المدار · الرئيسي</span></td><td><span class="status paid">نشط</span></td><td>اليوم، 09:42</td><td><button class="row-menu">•••</button></td></tr>`; }).join('') : '<tr><td colspan="6" class="empty-cell">لا يوجد مستخدمون.</td></tr>'; $('security-content').innerHTML = `<div class="security-kpis"><div><span>إجمالي المستخدمين</span><strong>${users.length}</strong><small>+2 هذا الشهر</small></div><div><span>المستخدمون النشطون</span><strong>${users.length}</strong><small class="security-green">100% من الحسابات</small></div><div><span>الجلسات الحالية</span><strong>3</strong><small>من أجهزة موثوقة</small></div><div><span>أحداث اليوم</span><strong>12</strong><small>آخر تحديث منذ دقيقة</small></div></div><div class="security-users-layout"><section class="panel security-user-list"><div class="workspace-heading"><div><span class="section-kicker">دليل المستخدمين</span><h3>حسابات النظام</h3></div><div class="security-list-actions"><input id="security-search" placeholder="ابحث عن مستخدم..." /><button id="security-filter">كل الحالات ▾</button></div></div><div class="table-scroll"><table class="security-table"><thead><tr><th>المستخدم</th><th>الدور</th><th>نطاق الوصول</th><th>الحالة</th><th>آخر دخول</th><th></th></tr></thead><tbody id="security-users-body">${rows}</tbody></table></div></section><aside class="security-side"><div class="panel security-posture"><div class="workspace-heading"><div><span class="section-kicker">حالة النظام</span><h3>مؤشر الأمان</h3></div><span class="security-score">92%</span></div><div class="security-progress"><span></span></div><p>إعدادات الحماية الأساسية مفعلة</p><div class="security-check"><span>✓</span> قفل الحساب بعد المحاولات الفاشلة</div><div class="security-check"><span>✓</span> سجل تدقيق للعمليات الحساسة</div><div class="security-check warn"><span>!</span> يوصى بتفعيل المصادقة الثنائية</div></div><div class="panel trusted-devices"><div class="workspace-heading"><h3>الأجهزة الموثوقة</h3><button class="text-button">إدارة</button></div><div class="device-row"><span>▣</span><div><strong>جهاز المكتب الرئيسي</strong><small>Windows · متصل الآن</small></div><i class="online-dot"></i></div><div class="device-row"><span>▣</span><div><strong>جهاز المحاسب</strong><small>Windows · منذ ساعتين</small></div><i class="online-dot"></i></div></div></aside></div>`; document.querySelector('#security-add-user').onclick = () => openSecurityUserForm(); };
  const renderRolesTab = () => { const permissions = ['عرض لوحة التحكم', 'إنشاء القيود اليومية', 'ترحيل القيود', 'إدارة دليل الحسابات', 'إنشاء فواتير المبيعات', 'إنشاء فواتير المشتريات', 'إدارة المخزون', 'عرض التقارير المالية', 'إدارة المستخدمين', 'تعديل الفترات المالية']; $('security-content').innerHTML = `<div class="panel permission-panel"><div class="workspace-heading"><div><span class="section-kicker">التحكم في الوصول</span><h3>مصفوفة الأدوار والصلاحيات</h3><p>حدد ما يمكن لكل دور عرضه أو تنفيذه داخل النظام.</p></div><button class="primary-button" id="save-permissions">حفظ التغييرات</button></div><div class="role-selector"><button class="selected">مدير النظام <small>ADMIN</small></button><button>محاسب <small>ACCOUNTANT</small></button><button>مراجع <small>VIEWER</small></button><button>مخصص <small>CUSTOM</small></button></div><table class="permission-table"><thead><tr><th>الوحدة / الإجراء</th><th>عرض</th><th>إنشاء</th><th>تعديل</th><th>ترحيل</th><th>حذف</th></tr></thead><tbody>${permissions.map((p, i) => `<tr><td><strong>${p}</strong><small>${i < 4 ? 'المحاسبة' : i < 7 ? 'العمليات' : 'الإدارة'}</small></td>${[1, 2, 3, 4, 5].map(x => `<td><label class="permission-toggle"><input type="checkbox" checked /><span></span></label></td>`).join('')}</tr>`).join('')}</tbody></table></div>`; $('save-permissions').onclick = () => showToast('تم حفظ مصفوفة الصلاحيات'); };
async function renderAuditTab() {
  if (dataMode !== 'oracle' || !window.onyxAPI?.auditEvents) { $('security-content').innerHTML = `<div class="panel audit-panel"><div class="workspace-heading"><h3>سجل التدقيق</h3></div><p>سجل التدقيق الفعلي متاح عند الاتصال بـ Oracle بعد تشغيل migration 008.</p></div>`; return; }
  $('security-content').innerHTML = `<div class="panel audit-panel"><div class="workspace-heading"><div><span class="section-kicker">المراقبة والامتثال</span><h3>سجل التدقيق الفعلي</h3><p>الأحداث المسجلة من طبقة التطبيق داخل Oracle</p></div><button class="secondary-button" id="audit-refresh">↻ تحديث</button></div><div class="report-controls"><label>من <input type="date" id="audit-start" /></label><label>إلى <input type="date" id="audit-end" /></label><select id="audit-entity"><option value="">كل الكيانات</option><option value="INVOICE">الفواتير</option><option value="JOURNAL_ENTRY">القيود</option><option value="ACCOUNT">الحسابات</option><option value="USER">المستخدمون</option><option value="USER_ROLE">الأدوار</option></select></div><div class="table-scroll"><table class="security-table"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الكيان</th><th>الإجراء</th><th>المعرف</th><th>بعد العملية</th></tr></thead><tbody id="audit-body"><tr><td colspan="6">جارٍ التحميل...</td></tr></tbody></table></div></div>`;
  const end = new Date(); const start = new Date(end.getFullYear(), end.getMonth(), 1); $('audit-start').value = start.toISOString().slice(0, 10); $('audit-end').value = end.toISOString().slice(0, 10);
  const load = async () => { try { const rows = await window.onyxAPI.auditEvents({ startDate: $('audit-start').value, endDate: $('audit-end').value, entityType: $('audit-entity').value || null, limit: 200 }); $('audit-body').innerHTML = rows.map(row => `<tr><td>${esc(row.CREATED_AT || '')}</td><td>${esc(row.DISPLAY_NAME_AR || row.USERNAME || 'النظام')}</td><td>${esc(row.ENTITY_TYPE)}</td><td>${esc(row.ACTION_CODE)}</td><td>${esc(row.ENTITY_ID || '')}</td><td><code>${esc(row.AFTER_JSON || '')}</code></td></tr>`).join('') || '<tr><td colspan="6">لا توجد أحداث ضمن الفترة المحددة.</td></tr>'; } catch (error) { console.error('Audit load failed:', error); $('audit-body').innerHTML = `<tr><td colspan="6">تعذر تحميل سجل التدقيق: ${esc(error.message)}</td></tr>`; } };
  $('audit-refresh').addEventListener('click', load); $('audit-start').addEventListener('change', load); $('audit-end').addEventListener('change', load); $('audit-entity').addEventListener('change', load); await load();
}
  const renderSessionsTab = () => { $('security-content').innerHTML = `<div class="panel sessions-panel"><div class="workspace-heading"><div><span class="section-kicker">الوصول النشط</span><h3>جلسات الدخول الحالية</h3><p>يمكن إنهاء أي جلسة غير معروفة فورًا.</p></div><button class="secondary-button" id="end-other-sessions">إنهاء الجلسات الأخرى</button></div><div class="session-grid"><div class="session-card current"><span class="session-device">▣</span><div><strong>جهاز المكتب الرئيسي</strong><small>محمد العتيبي · Windows 11 · 192.168.1.24</small><em>الجلسة الحالية · متصل الآن</em></div><span class="online-dot"></span></div><div class="session-card"><span class="session-device">▣</span><div><strong>جهاز المحاسب</strong><small>سارة المحاسبة · Windows 10 · 192.168.1.38</small><em>نشط منذ ساعتين</em></div><button class="text-button">إنهاء</button></div><div class="session-card"><span class="session-device">▣</span><div><strong>حاسوب محمول</strong><small>مستخدم المراجعة · Windows 11 · 10.0.0.8</small><em>نشط منذ أمس</em></div><button class="text-button">إنهاء</button></div></div></div>`; $('end-other-sessions').onclick = () => showToast('تم إنهاء الجلسات الأخرى'); };
  const renderSettingsTab = () => { $('security-content').innerHTML = `<div class="security-settings-grid"><section class="panel security-settings"><div class="workspace-heading"><div><span class="section-kicker">سياسات النظام</span><h3>إعدادات الحماية</h3></div><button class="primary-button" id="save-security-settings">حفظ الإعدادات</button></div><label class="setting-row"><div><strong>قفل الحساب تلقائيًا</strong><small>بعد عدد محدد من محاولات الدخول الفاشلة</small></div><input type="checkbox" checked /></label><label class="setting-row"><div><strong>تسجيل كل العمليات الحساسة</strong><small>القيود والصلاحيات وتغيير الفترات المالية</small></div><input type="checkbox" checked /></label><label class="setting-row"><div><strong>السماح بالترحيل بأثر رجعي</strong><small>يتطلب صلاحية منفصلة وحدًا زمنيًا</small></div><input type="checkbox" /></label><label class="setting-row"><div><strong>إنهاء الجلسة بعد الخمول</strong><small>مدة الخمول قبل طلب تسجيل الدخول مجددًا</small></div><select><option>30 دقيقة</option><option>60 دقيقة</option><option>لا ينتهي</option></select></label></section><section class="panel password-policy"><div class="workspace-heading"><div><span class="section-kicker">سياسة كلمات المرور</span><h3>متطلبات كلمة المرور</h3></div></div><div class="policy-check">✓ ثمانية أحرف على الأقل</div><div class="policy-check">✓ حرف كبير وحرف صغير</div><div class="policy-check">✓ رقم واحد على الأقل</div><div class="policy-check">○ تغيير كل 90 يومًا</div><div class="policy-note">آخر مراجعة للسياسة: 24 سبتمبر 2024</div></section></div>`; $('save-security-settings').onclick = () => showToast('تم حفظ إعدادات الحماية'); };
  const showTab = async tab => { document.querySelectorAll('.security-tab').forEach(t => t.classList.toggle('active', t.dataset.securityTab === tab)); if (tab === 'users') await renderUsersTab(); else if (tab === 'roles') renderRolesTab(); else if (tab === 'audit') await renderAuditTab(); else if (tab === 'sessions') renderSessionsTab(); else renderSettingsTab(); };
  document.querySelectorAll('.security-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.securityTab))); $('security-report').onclick = () => showToast('تم تجهيز تقرير صلاحيات وأمن النظام'); $('security-add-user').onclick = () => openSecurityUserForm(); await showTab('users');
}

function openSecurityUserForm() { $('modal-title').textContent = 'إضافة مستخدم جديد'; $('modal-fields').innerHTML = '<label>اسم المستخدم<input name="username" required /></label><label>الاسم الظاهر<input name="displayNameAr" required /></label><label>كلمة المرور<input name="password" type="password" minlength="8" required /></label><label>الدور<select name="role"><option>مستخدم</option><option>محاسب</option><option>مراجع</option></select></label>'; $('entry-form').dataset.view = 'security-user'; $('form-modal').classList.add('open'); }

let loginContexts = [];
let pendingContextSession = null;

function contextLabel(context, type) {
  if (type === 'company') return `${context.COMPANY_CODE || context.company_code} · ${context.COMPANY_NAME_AR || context.company_name_ar}`;
  if (type === 'branch') return `${context.BRANCH_CODE || context.branch_code} · ${context.BRANCH_NAME_AR || context.branch_name_ar}`;
  return `${context.FISCAL_YEAR || context.fiscal_year}`;
}

function fillSelect(select, items, valueKey, labelType, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` + items.map(item => `<option value="${esc(item[valueKey])}">${esc(contextLabel(item, labelType))}</option>`).join('');
  select.disabled = items.length === 0;
}

function prepareContextFields(contexts) {
  loginContexts = contexts || [];
  const fields = $('context-fields');
  const companySelect = $('login-company');
  const branchSelect = $('login-branch');
  const yearSelect = $('login-fiscal-year');
  const companies = [...new Map(loginContexts.map(item => [String(item.COMPANY_ID || item.company_id), item])).values()];
  fields.classList.remove('hidden');
  fillSelect(companySelect, companies, 'COMPANY_ID', 'company', 'اختر الشركة');
  fillSelect(branchSelect, [], 'BRANCH_ID', 'branch', 'اختر الشركة أولًا');
  fillSelect(yearSelect, [], 'FISCAL_YEAR_ID', 'year', 'اختر الفرع أولًا');
  companySelect.onchange = () => {
    const companyId = companySelect.value;
    const branches = [...new Map(loginContexts.filter(item => String(item.COMPANY_ID) === companyId).map(item => [String(item.BRANCH_ID), item])).values()];
    fillSelect(branchSelect, branches, 'BRANCH_ID', 'branch', branches.length ? 'اختر الفرع' : 'لا توجد فروع متاحة');
    fillSelect(yearSelect, [], 'FISCAL_YEAR_ID', 'year', 'اختر الفرع أولًا');
  };
  branchSelect.onchange = () => {
    const companyId = companySelect.value;
    const branchId = branchSelect.value;
    const years = loginContexts.filter(item => String(item.COMPANY_ID) === companyId && String(item.BRANCH_ID) === branchId);
    fillSelect(yearSelect, years, 'FISCAL_YEAR_ID', 'year', years.length ? 'اختر السنة المالية' : 'لا توجد سنوات مفتوحة');
  };
  if (companies.length === 1) { companySelect.value = String(companies[0].COMPANY_ID); companySelect.dispatchEvent(new Event('change')); }
}

async function continueWithContext(session) {
  if (session.context) return session;
  const contexts = await window.onyxAPI.sessionContexts();
  if (!contexts.length) throw new Error('لا يوجد نطاق شركة وفرع وسنة مالية مفتوح لهذا المستخدم.');
  if (contexts.length === 1) {
    const only = contexts[0];
    return window.onyxAPI.setSessionContext({ companyId: only.COMPANY_ID, branchId: only.BRANCH_ID, fiscalYearId: only.FISCAL_YEAR_ID, workingDate: new Date().toISOString().slice(0, 10) });
  }
  pendingContextSession = session;
  prepareContextFields(contexts);
  $('login-subtitle').textContent = 'اختر سياق العمل لإكمال تسجيل الدخول';
  document.querySelector('.login-submit').textContent = 'متابعة إلى النظام';
  return null;
}

async function completeLogin(session) {
  $('login-screen').classList.add('hidden');
  const name = document.querySelector('.user-mini strong'); const role = document.querySelector('.user-mini span:not(.dots)');
  if (name) name.textContent = session.displayNameAr;
  if (role) role.textContent = session.roles?.[0]?.ROLE_NAME_AR || session.role || 'مستخدم';
  const company = session.company;
  if (company) {
    const workspaceName = document.querySelector('.workspace-name');
    const workspaceMode = document.querySelector('.workspace-mode');
    if (workspaceName) workspaceName.innerHTML = `${esc(company.COMPANY_NAME_AR || company.company_name_ar || 'الشركة')} <span>⌄</span>`;
    if (workspaceMode) workspaceMode.textContent = `فرع ${company.BRANCH_NAME_AR || company.branch_name_ar || 'الرئيسي'} · السنة ${company.FISCAL_YEAR || company.fiscal_year || ''}`;
  }
  refreshDbStatus(); refreshDashboardMetrics();
}

async function bootAuthentication() {
  if (window.onyxAPI?.bootstrapStatus) {
    try {
      const bootstrap = await window.onyxAPI.bootstrapStatus();
      if (!bootstrap.initialized) {
        $('login-screen').classList.add('hidden');
        $('bootstrap-screen').classList.remove('hidden');
        $('bootstrap-fiscal-year').value = String(new Date().getFullYear());
        return;
      }
    } catch (error) { console.warn('تعذر قراءة حالة التأسيس:', error.message); }
  }
  const online = await refreshDbStatus();
  if (!online) {
    const stored = sessionStorage.getItem('onyx-demo-session');
    if (stored) await completeLogin(JSON.parse(stored));
    else await completeLogin({ displayNameAr: 'مستخدم تجريبي', role: 'وضع تجريبي', permissions: ['ALL'] });
    return;
  }
  try {
    const hasUsers = await window.onyxAPI.hasUsers();
    if (!hasUsers) { $('login-title').textContent = 'تهيئة مدير النظام'; $('login-subtitle').textContent = 'أنشئ أول مستخدم بصلاحيات كاملة للبدء'; $('setup-fields').classList.remove('hidden'); document.querySelector('.login-submit').textContent = 'إنشاء المدير والدخول'; }
    const session = await window.onyxAPI.currentSession(); if (session) { const ready = await continueWithContext(session); if (ready) await completeLogin(ready); }
  } catch (error) { setDemoMode(); $('login-error').textContent = 'تم تفعيل الوضع التجريبي تلقائيًا.'; }
}
$('bootstrap-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const errorBox = $('bootstrap-error');
  errorBox.textContent = 'جارٍ إنشاء ملف Access والمخطط ودليل الحسابات...';
  try {
    await window.onyxAPI.setupInitializeSchema({
      companyName: $('bootstrap-company-name').value.trim(),
      companyCode: $('bootstrap-company-code').value.trim().toUpperCase(),
      branchName: $('bootstrap-branch-name').value.trim(),
      branchCode: 'MAIN',
      fiscalYear: Number($('bootstrap-fiscal-year').value),
      adminUsername: $('bootstrap-admin-username').value.trim().toUpperCase(),
      adminName: $('bootstrap-admin-name').value.trim(),
      adminPassword: $('bootstrap-admin-password').value,
      includeDemoData: false,
    });
    $('bootstrap-screen').classList.add('hidden');
    $('login-screen').classList.remove('hidden');
    errorBox.textContent = '';
    dataMode = 'detecting';
    await bootAuthentication();
  } catch (error) { errorBox.textContent = `تعذر إنشاء قاعدة البيانات: ${error.message}`; }
});
$('login-form')?.addEventListener('submit', async event => {
  event.preventDefault(); const errorBox = $('login-error'); errorBox.textContent = '';
  const username = $('login-username').value.trim(); const password = $('login-password').value;
  try {
    if (pendingContextSession) {
      const companyId = $('login-company').value;
      const branchId = $('login-branch').value;
      const fiscalYearId = $('login-fiscal-year').value;
      if (!companyId || !branchId || !fiscalYearId) throw new Error('اختر الشركة والفرع والسنة المالية قبل المتابعة.');
      const session = await window.onyxAPI.setSessionContext({ companyId, branchId, fiscalYearId, workingDate: new Date().toISOString().slice(0, 10) });
      pendingContextSession = null;
      $('context-fields').classList.add('hidden');
      await completeLogin(session);
      showToast(`مرحباً ${session.displayNameAr}`);
      return;
    }
    if (dataMode === 'demo') {
      if (!((username.toLowerCase() === 'admin' && password === 'demo123') || state.users.some(u => u.username.toLowerCase() === username.toLowerCase()))) throw new Error('للدخول التجريبي استخدم admin / demo123');
      const user = state.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || state.users[0];
      const session = { displayNameAr: user.displayNameAr, role: user.role, permissions: ['ALL'], roles: [{ ROLE_NAME_AR: user.role }] };
      sessionStorage.setItem('onyx-demo-session', JSON.stringify(session)); await completeLogin(session); showToast(`مرحباً ${session.displayNameAr}`); return;
    }
    if (!$('setup-fields').classList.contains('hidden')) { const displayNameAr = $('setup-display').value.trim(); const confirm = $('setup-confirm').value; if (password !== confirm) throw new Error('تأكيد كلمة المرور غير مطابق.'); await window.onyxAPI.createUser({ username, displayNameAr, password }); }
    const authenticated = await window.onyxAPI.login({ username, password });
    const session = await continueWithContext(authenticated);
    if (session) { await completeLogin(session); showToast(`مرحباً ${session.displayNameAr}`); }
  } catch (error) { errorBox.textContent = error.message; }
});

document.querySelector('.user-mini')?.addEventListener('click', async () => { if (confirm('هل تريد تسجيل الخروج؟')) { sessionStorage.removeItem('onyx-demo-session'); if (window.onyxAPI) await window.onyxAPI.logout(); location.reload(); } });
window.addEventListener('DOMContentLoaded', bootAuthentication);
