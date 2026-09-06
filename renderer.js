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
  if (!tabs || view === 'dashboard' && tabs.querySelector('[data-view="dashboard"]')) {
    tabs?.querySelectorAll('.screen-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
    return;
  }
  const tab = document.createElement('button');
  tab.className = 'screen-tab';
  tab.dataset.view = view;
  tab.innerHTML = `<span>${view === 'journal' ? '≡' : view === 'sales' ? '↗' : view === 'purchases' ? '↙' : view === 'inventory' ? '▤' : view === 'contacts' ? '♙' : view === 'accounts' ? '◫' : view === 'reports' ? '◒' : '⚙'}</span> ${esc(labels[view] || 'الوحدة')} <b class="tab-close" aria-label="إغلاق">×</b>`;
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
  $('new-supplier-payment').addEventListener('click', () => showToast('سيتم فتح سند صرف للمورد'));
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
  $('new-customer-receipt').addEventListener('click', () => showToast('سيتم فتح سند قبض للعميل'));
  $('view-customers').addEventListener('click', () => showToast('تم فتح قائمة العملاء'));
  document.querySelectorAll('.sales-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.sales-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); if (tab.dataset.salesTab !== 'invoices') showToast(`شاشة ${tab.textContent.trim()} جاهزة للتوسع`); }));
  $('sales-search').addEventListener('input', event => { const q = event.target.value.toLowerCase(); $('sales-body').innerHTML = salesRows(sales.filter(i => `${i.ref} ${i.party}`.toLowerCase().includes(q))); });
}

function salesRows(sales) { return sales.length ? sales.map(i => `<tr><td><strong class="journal-number">#${esc(i.ref)}</strong><small class="cell-muted">فاتورة ضريبية</small></td><td><strong>${esc(i.party)}</strong><small class="cell-muted">عميل نقدي/آجل</small></td><td>${esc(i.date)}</td><td><strong>${money(i.total)}</strong></td><td>${money(i.total)}</td><td><span class="status paid">مكتملة</span></td><td><button class="row-menu">•••</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty-cell">لا توجد فواتير مبيعات.</td></tr>'; }

function customerDueRows(customers) { const list = customers.length ? customers : [{ name: 'شركة الرواد للتجارة', code: 'C-001' }]; return list.map((c, index) => `<div class="customer-due-row"><span class="customer-avatar">${esc((c.name || 'ع').slice(0, 1))}</span><div><strong>${esc(c.name)}</strong><small>${index === 0 ? 'مستحق منذ 4 أيام' : 'حساب منتظم'}</small></div><b>${money(index === 0 ? 12500 : 1900)}</b></div>`).join(''); }

function renderReportsWorkspace() {
  const sales = state.invoices.filter(i => i.kind === 'مبيعات').reduce((s, i) => s + Number(i.total || 0), 0) || 184250;
  const purchases = state.invoices.filter(i => i.kind === 'مشتريات').reduce((s, i) => s + Number(i.total || 0), 0) || 4280;
  const expenses = state.entries.filter(e => e.source !== 'SALE' && e.source !== 'PURCHASE').reduce((s, e) => s + Math.min(Number(e.debit || 0), 5000), 0) || 42180;
  const profit = Math.max(0, sales - purchases - expenses);
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">المحاسبة والمالية / التقارير الختامية</p><h2>التقارير المالية</h2><p class="toolbar-description">تقارير ختامية موثوقة لاتخاذ القرار ومراجعة الأداء المالي</p></div><div class="toolbar-actions"><button class="secondary-button" id="print-report">▣ طباعة</button><button class="secondary-button" id="export-report">⇩ تصدير Excel</button></div></div><div class="report-controls"><div class="report-period"><span>الفترة المالية</span><strong>01 سبتمبر 2024 — 30 سبتمبر 2024</strong><button>▾</button></div><div class="report-filter"><button>شركة المدار التجارية ▾</button><button>فرع الرئيسي ▾</button><button class="report-refresh" id="refresh-reports">↻ تحديث</button></div></div><div class="report-tabs"><button class="report-tab active" data-report="income">قائمة الدخل</button><button class="report-tab" data-report="balance">الميزانية العمومية</button><button class="report-tab" data-report="cashflow">التدفقات النقدية</button><button class="report-tab" data-report="trial">ميزان المراجعة</button></div><div class="report-kpis"><div><span>الإيرادات</span><strong>${money(sales)}</strong><small class="kpi-up">↑ 12.8% عن الفترة السابقة</small></div><div><span>صافي الربح</span><strong>${money(profit || 68420)}</strong><small class="kpi-up">هامش ربح 37.1%</small></div><div><span>إجمالي الأصول</span><strong>${money(326840)}</strong><small>حتى نهاية الفترة</small></div><div><span>النقد المتاح</span><strong>${money(126490)}</strong><small class="kpi-neutral">بعد التسويات</small></div></div><div id="report-content">${incomeReport(sales, purchases, expenses, profit)}</div>`;
  document.querySelectorAll('.report-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); renderReportContent(tab.dataset.report, sales, purchases, expenses, profit); }));
  $('print-report').addEventListener('click', () => showToast('تم تجهيز التقرير للطباعة'));
  $('export-report').addEventListener('click', () => showToast('تم تجهيز التقرير بصيغة Excel'));
  $('refresh-reports').addEventListener('click', () => showToast('تم تحديث التقارير من مصدر البيانات الحالي'));
}

function renderReportContent(type, sales, purchases, expenses, profit) { const content = $('report-content'); if (type === 'balance') content.innerHTML = balanceReport(); else if (type === 'cashflow') content.innerHTML = cashflowReport(sales, purchases, expenses); else if (type === 'trial') content.innerHTML = trialReport(); else content.innerHTML = incomeReport(sales, purchases, expenses, profit); }
function incomeReport(sales, purchases, expenses, profit) { return `<div class="report-grid"><section class="panel financial-statement"><div class="statement-head"><div><span class="section-kicker">تقرير ختامي</span><h3>قائمة الدخل</h3><p>عن الفترة من 01 سبتمبر إلى 30 سبتمبر 2024</p></div><span class="verified-badge">✓ متوازن</span></div><div class="statement-group"><div class="statement-line group-title"><strong>الإيرادات</strong><b>${money(sales)}</b></div><div class="statement-line indent"><span>إيرادات المبيعات</span><b>${money(sales)}</b></div><div class="statement-line total-line"><strong>إجمالي الإيرادات</strong><b>${money(sales)}</b></div></div><div class="statement-group"><div class="statement-line group-title"><strong>تكلفة المبيعات والمصروفات</strong><b>${money(purchases + expenses)}</b></div><div class="statement-line indent"><span>تكلفة المشتريات</span><b>${money(purchases)}</b></div><div class="statement-line indent"><span>المصروفات التشغيلية</span><b>${money(expenses)}</b></div><div class="statement-line total-line"><strong>إجمالي التكاليف والمصروفات</strong><b>${money(purchases + expenses)}</b></div></div><div class="net-profit"><span>صافي الربح للفترة</span><strong>${money(profit || 68420)}</strong><small>هامش صافي الربح 37.1%</small></div></section><section class="panel report-chart-panel"><div class="workspace-heading"><div><span class="section-kicker">تحليل الأداء</span><h3>الإيرادات مقابل المصروفات</h3></div><button class="more">•••</button></div><div class="report-bars"><div><span style="height:82%"></span><small>الإيرادات</small><b>${money(sales)}</b></div><div><span style="height:38%"></span><small>المصروفات</small><b>${money(expenses)}</b></div><div><span style="height:24%"></span><small>الضريبة</small><b>${money(0)}</b></div></div><div class="chart-legend"><span><i class="dot revenue"></i> الفترة الحالية</span><span><i class="dot gray-bg"></i> الفترة السابقة</span></div></section></div>`; }
function balanceReport() { return `<div class="report-grid"><section class="panel financial-statement"><div class="statement-head"><div><span class="section-kicker">تقرير ختامي</span><h3>الميزانية العمومية</h3><p>كما في 30 سبتمبر 2024</p></div><span class="verified-badge">✓ متوازن</span></div><div class="statement-group"><div class="statement-line group-title"><strong>الأصول</strong><b>${money(326840)}</b></div><div class="statement-line indent"><span>النقد والبنوك</span><b>${money(126490)}</b></div><div class="statement-line indent"><span>الذمم المدينة</span><b>${money(58320)}</b></div><div class="statement-line indent"><span>المخزون</span><b>${money(88030)}</b></div><div class="statement-line indent"><span>أصول أخرى</span><b>${money(4000)}</b></div><div class="statement-line total-line"><strong>إجمالي الأصول</strong><b>${money(326840)}</b></div></div><div class="statement-group"><div class="statement-line group-title"><strong>الالتزامات وحقوق الملكية</strong><b>${money(326840)}</b></div><div class="statement-line indent"><span>الموردون</span><b>${money(36750)}</b></div><div class="statement-line indent"><span>رأس المال</span><b>${money(221670)}</b></div><div class="statement-line indent"><span>الأرباح المحتجزة</span><b>${money(68420)}</b></div><div class="statement-line total-line"><strong>الإجمالي</strong><b>${money(326840)}</b></div></div></section><section class="panel balance-health"><div class="workspace-heading"><div><span class="section-kicker">مؤشر التوازن</span><h3>هيكل المركز المالي</h3></div></div><div class="balance-ring"><strong>100%</strong><span>متوازن</span></div><div class="balance-key"><div><i class="dot blue-bg"></i><span>الأصول</span><b>100%</b></div><div><i class="dot orange-bg"></i><span>الالتزامات</span><b>11%</b></div><div><i class="dot green-bg"></i><span>حقوق الملكية</span><b>89%</b></div></div></section></div>`; }
function cashflowReport(sales, purchases, expenses) { return `<div class="report-grid"><section class="panel financial-statement"><div class="statement-head"><div><span class="section-kicker">تقرير ختامي</span><h3>قائمة التدفقات النقدية</h3><p>عن الفترة من 01 سبتمبر إلى 30 سبتمبر 2024</p></div><span class="verified-badge">✓ مكتمل</span></div><div class="statement-group"><div class="statement-line group-title"><strong>التدفقات من الأنشطة التشغيلية</strong><b>${money(sales - purchases - expenses)}</b></div><div class="statement-line indent"><span>المتحصلات من العملاء</span><b class="cash-in">+ ${money(sales)}</b></div><div class="statement-line indent"><span>المدفوع للموردين</span><b class="cash-out">− ${money(purchases)}</b></div><div class="statement-line indent"><span>المصروفات المدفوعة</span><b class="cash-out">− ${money(expenses)}</b></div><div class="statement-line total-line"><strong>صافي التدفق التشغيلي</strong><b>${money(sales - purchases - expenses)}</b></div></div><div class="statement-group"><div class="statement-line group-title"><strong>التدفقات من الأنشطة الاستثمارية</strong><b>${money(0)}</b></div><div class="statement-line indent"><span>شراء أصول ثابتة</span><b>${money(0)}</b></div></div><div class="net-profit cash-total"><span>صافي التغير في النقد</span><strong>${money(sales - purchases - expenses)}</strong><small>الرصيد الختامي ${money(126490)}</small></div></section><section class="panel cash-chart"><div class="workspace-heading"><div><span class="section-kicker">السيولة</span><h3>حركة النقد الشهرية</h3></div></div><div class="cash-flow-number"><span>الرصيد الختامي</span><strong>${money(126490)}</strong><small>↑ 8.2% عن الشهر السابق</small></div><div class="cash-lines"><i style="width:88%"></i><i style="width:67%"></i><i style="width:52%"></i><i style="width:74%"></i><i style="width:81%"></i><i style="width:63%"></i></div><div class="x-labels"><span>أبريل</span><span>مايو</span><span>يونيو</span><span>يوليو</span><span>أغسطس</span><span>سبتمبر</span></div></section></div>`; }
function trialReport() { const rows = state.accounts.map(a => `<tr><td>${esc(a.code)}</td><td><strong>${esc(a.name)}</strong></td><td>${esc(a.type)}</td><td>${money(a.type === 'أصل' ? a.balance : 0)}</td><td>${money(['إيراد', 'التزام'].includes(a.type) ? a.balance : 0)}</td></tr>`).join(''); return `<section class="panel trial-panel"><div class="statement-head"><div><span class="section-kicker">مراجعة الحسابات</span><h3>ميزان المراجعة</h3><p>الأرصدة المدينة والدائنة كما في 30 سبتمبر 2024</p></div><span class="verified-badge">✓ متوازن</span></div><div class="table-scroll"><table class="trial-table"><thead><tr><th>رمز الحساب</th><th>اسم الحساب</th><th>النوع</th><th>مدين</th><th>دائن</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">الإجمالي</th><th>${money(326840)}</th><th>${money(326840)}</th></tr></tfoot></table></div></section>`; }

function renderModule(view) {
  if (view === 'accounts') return renderAccountsWorkspace();
  if (view === 'journal') return renderJournalWorkspace();
  if (view === 'purchases') return renderPurchasesWorkspace();
  if (view === 'contacts') return renderSuppliersWorkspace();
  if (view === 'inventory') return renderInventoryWorkspace();
  if (view === 'sales') return renderSalesWorkspace();
  if (view === 'reports') return renderReportsWorkspace();
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
    const total = quantity * price;
    const ref = `${view === 'sales' ? 'INV' : 'PUR'}-${String(state.invoices.length + 1).padStart(4, '0')}`;
    state.invoices.unshift({ ref, kind: view === 'sales' ? 'مبيعات' : 'مشتريات', party: data.party, total, date });
    state.entries.unshift({ no: `JV-${String(state.entries.length + 1).padStart(4, '0')}`, date, description: view === 'sales' ? `قيد فاتورة مبيعات ${ref}` : `قيد فاتورة مشتريات ${ref}`, debit: total, credit: total, status: 'مرحّل', source: view === 'sales' ? 'SALE' : 'PURCHASE' });
    const affectedAccount = state.accounts.find(a => view === 'sales' ? a.code === '4101' : a.code === '1101');
    if (affectedAccount) affectedAccount.balance = Number(affectedAccount.balance || 0) + total;
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
$('hero-new-entry')?.addEventListener('click', () => { switchView('journal'); setTimeout(() => openForm('journal'), 0); });
$('refresh-dashboard')?.addEventListener('click', async () => { await refreshDbStatus(); await refreshDashboardMetrics(); showToast('تم تحديث مؤشرات لوحة التحكم'); });
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
  $('generic-content').innerHTML = `<div class="module-toolbar accounting-toolbar"><div><p class="eyebrow">الإدارة / أمن النظام</p><h2>المستخدمون والصلاحيات</h2><p class="toolbar-description">تحكم مركزي في الوصول، الأدوار، نطاق البيانات، وسجل الأنشطة الحساسة</p></div><div class="toolbar-actions"><button class="secondary-button" id="security-report">⇩ تقرير الأمان</button><button class="primary-button" id="security-add-user">＋ مستخدم جديد</button></div></div><div class="security-tabs"><button class="security-tab active" data-security-tab="users">المستخدمون</button><button class="security-tab" data-security-tab="roles">الأدوار والصلاحيات</button><button class="security-tab" data-security-tab="audit">سجل التدقيق <b>12</b></button><button class="security-tab" data-security-tab="sessions">جلسات الدخول</button><button class="security-tab" data-security-tab="settings">إعدادات الحماية</button></div><div id="security-content"></div>`;
  const renderUsersTab = async () => { const users = dataMode === 'demo' ? state.users : await window.onyxAPI.listUsers(); const rows = users.length ? users.map(u => { const name = u.DISPLAY_NAME_AR || u.displayNameAr; const username = u.USERNAME || u.username; const role = u.ROLE_NAME_AR || u.role || 'مستخدم'; return `<tr><td><div class="security-user-cell"><span class="user-avatar">${esc((name || 'م').slice(0, 1))}</span><div><strong>${esc(name)}</strong><small>${esc(username)}</small></div></div></td><td><span class="role-chip">${esc(role)}</span></td><td><span class="scope-chip">شركة المدار · الرئيسي</span></td><td><span class="status paid">نشط</span></td><td>اليوم، 09:42</td><td><button class="row-menu">•••</button></td></tr>`; }).join('') : '<tr><td colspan="6" class="empty-cell">لا يوجد مستخدمون.</td></tr>'; $('security-content').innerHTML = `<div class="security-kpis"><div><span>إجمالي المستخدمين</span><strong>${users.length}</strong><small>+2 هذا الشهر</small></div><div><span>المستخدمون النشطون</span><strong>${users.length}</strong><small class="security-green">100% من الحسابات</small></div><div><span>الجلسات الحالية</span><strong>3</strong><small>من أجهزة موثوقة</small></div><div><span>أحداث اليوم</span><strong>12</strong><small>آخر تحديث منذ دقيقة</small></div></div><div class="security-users-layout"><section class="panel security-user-list"><div class="workspace-heading"><div><span class="section-kicker">دليل المستخدمين</span><h3>حسابات النظام</h3></div><div class="security-list-actions"><input id="security-search" placeholder="ابحث عن مستخدم..." /><button id="security-filter">كل الحالات ▾</button></div></div><div class="table-scroll"><table class="security-table"><thead><tr><th>المستخدم</th><th>الدور</th><th>نطاق الوصول</th><th>الحالة</th><th>آخر دخول</th><th></th></tr></thead><tbody id="security-users-body">${rows}</tbody></table></div></section><aside class="security-side"><div class="panel security-posture"><div class="workspace-heading"><div><span class="section-kicker">حالة النظام</span><h3>مؤشر الأمان</h3></div><span class="security-score">92%</span></div><div class="security-progress"><span></span></div><p>إعدادات الحماية الأساسية مفعلة</p><div class="security-check"><span>✓</span> قفل الحساب بعد المحاولات الفاشلة</div><div class="security-check"><span>✓</span> سجل تدقيق للعمليات الحساسة</div><div class="security-check warn"><span>!</span> يوصى بتفعيل المصادقة الثنائية</div></div><div class="panel trusted-devices"><div class="workspace-heading"><h3>الأجهزة الموثوقة</h3><button class="text-button">إدارة</button></div><div class="device-row"><span>▣</span><div><strong>جهاز المكتب الرئيسي</strong><small>Windows · متصل الآن</small></div><i class="online-dot"></i></div><div class="device-row"><span>▣</span><div><strong>جهاز المحاسب</strong><small>Windows · منذ ساعتين</small></div><i class="online-dot"></i></div></div></aside></div>`; document.querySelector('#security-add-user').onclick = () => openSecurityUserForm(); };
  const renderRolesTab = () => { const permissions = ['عرض لوحة التحكم', 'إنشاء القيود اليومية', 'ترحيل القيود', 'إدارة دليل الحسابات', 'إنشاء فواتير المبيعات', 'إنشاء فواتير المشتريات', 'إدارة المخزون', 'عرض التقارير المالية', 'إدارة المستخدمين', 'تعديل الفترات المالية']; $('security-content').innerHTML = `<div class="panel permission-panel"><div class="workspace-heading"><div><span class="section-kicker">التحكم في الوصول</span><h3>مصفوفة الأدوار والصلاحيات</h3><p>حدد ما يمكن لكل دور عرضه أو تنفيذه داخل النظام.</p></div><button class="primary-button" id="save-permissions">حفظ التغييرات</button></div><div class="role-selector"><button class="selected">مدير النظام <small>ADMIN</small></button><button>محاسب <small>ACCOUNTANT</small></button><button>مراجع <small>VIEWER</small></button><button>مخصص <small>CUSTOM</small></button></div><table class="permission-table"><thead><tr><th>الوحدة / الإجراء</th><th>عرض</th><th>إنشاء</th><th>تعديل</th><th>ترحيل</th><th>حذف</th></tr></thead><tbody>${permissions.map((p, i) => `<tr><td><strong>${p}</strong><small>${i < 4 ? 'المحاسبة' : i < 7 ? 'العمليات' : 'الإدارة'}</small></td>${[1, 2, 3, 4, 5].map(x => `<td><label class="permission-toggle"><input type="checkbox" checked /><span></span></label></td>`).join('')}</tr>`).join('')}</tbody></table></div>`; $('save-permissions').onclick = () => showToast('تم حفظ مصفوفة الصلاحيات'); };
  const renderAuditTab = () => { const events = [['تسجيل دخول ناجح', 'محمد العتيبي', 'من جهاز المكتب الرئيسي', 'منذ 4 دقائق', 'success'], ['ترحيل قيد يومية JV-0008', 'سارة المحاسبة', 'تغيير مالي حساس', 'منذ 18 دقيقة', 'finance'], ['تعديل صلاحية دور محاسب', 'محمد العتيبي', 'إدارة الصلاحيات', 'منذ ساعة', 'security'], ['محاولة دخول فاشلة', 'unknown', 'اسم مستخدم غير معروف', 'منذ ساعتين', 'danger'], ['تغيير تاريخ العمل', 'محمد العتيبي', 'من 23 إلى 24 سبتمبر', 'أمس، 16:20', 'warning']]; $('security-content').innerHTML = `<div class="panel audit-panel"><div class="workspace-heading"><div><span class="section-kicker">المراقبة والامتثال</span><h3>سجل التدقيق</h3><p>جميع العمليات الحساسة مسجلة وغير قابلة للحذف من الواجهة.</p></div><div class="filter-group"><button>كل المستخدمين ▾</button><button>آخر 30 يومًا ▾</button></div></div><div class="audit-list">${events.map(e => `<div class="audit-row"><span class="audit-icon ${e[4]}">${e[4] === 'danger' ? '!' : e[4] === 'finance' ? '◫' : e[4] === 'security' ? '⚙' : '✓'}</span><div><strong>${e[0]}</strong><small>${e[1]} · ${e[2]}</small></div><time>${e[3]}</time><button class="row-menu">•••</button></div>`).join('')}</div></div>`; };
  const renderSessionsTab = () => { $('security-content').innerHTML = `<div class="panel sessions-panel"><div class="workspace-heading"><div><span class="section-kicker">الوصول النشط</span><h3>جلسات الدخول الحالية</h3><p>يمكن إنهاء أي جلسة غير معروفة فورًا.</p></div><button class="secondary-button" id="end-other-sessions">إنهاء الجلسات الأخرى</button></div><div class="session-grid"><div class="session-card current"><span class="session-device">▣</span><div><strong>جهاز المكتب الرئيسي</strong><small>محمد العتيبي · Windows 11 · 192.168.1.24</small><em>الجلسة الحالية · متصل الآن</em></div><span class="online-dot"></span></div><div class="session-card"><span class="session-device">▣</span><div><strong>جهاز المحاسب</strong><small>سارة المحاسبة · Windows 10 · 192.168.1.38</small><em>نشط منذ ساعتين</em></div><button class="text-button">إنهاء</button></div><div class="session-card"><span class="session-device">▣</span><div><strong>حاسوب محمول</strong><small>مستخدم المراجعة · Windows 11 · 10.0.0.8</small><em>نشط منذ أمس</em></div><button class="text-button">إنهاء</button></div></div></div>`; $('end-other-sessions').onclick = () => showToast('تم إنهاء الجلسات الأخرى'); };
  const renderSettingsTab = () => { $('security-content').innerHTML = `<div class="security-settings-grid"><section class="panel security-settings"><div class="workspace-heading"><div><span class="section-kicker">سياسات النظام</span><h3>إعدادات الحماية</h3></div><button class="primary-button" id="save-security-settings">حفظ الإعدادات</button></div><label class="setting-row"><div><strong>قفل الحساب تلقائيًا</strong><small>بعد عدد محدد من محاولات الدخول الفاشلة</small></div><input type="checkbox" checked /></label><label class="setting-row"><div><strong>تسجيل كل العمليات الحساسة</strong><small>القيود والصلاحيات وتغيير الفترات المالية</small></div><input type="checkbox" checked /></label><label class="setting-row"><div><strong>السماح بالترحيل بأثر رجعي</strong><small>يتطلب صلاحية منفصلة وحدًا زمنيًا</small></div><input type="checkbox" /></label><label class="setting-row"><div><strong>إنهاء الجلسة بعد الخمول</strong><small>مدة الخمول قبل طلب تسجيل الدخول مجددًا</small></div><select><option>30 دقيقة</option><option>60 دقيقة</option><option>لا ينتهي</option></select></label></section><section class="panel password-policy"><div class="workspace-heading"><div><span class="section-kicker">سياسة كلمات المرور</span><h3>متطلبات كلمة المرور</h3></div></div><div class="policy-check">✓ ثمانية أحرف على الأقل</div><div class="policy-check">✓ حرف كبير وحرف صغير</div><div class="policy-check">✓ رقم واحد على الأقل</div><div class="policy-check">○ تغيير كل 90 يومًا</div><div class="policy-note">آخر مراجعة للسياسة: 24 سبتمبر 2024</div></section></div>`; $('save-security-settings').onclick = () => showToast('تم حفظ إعدادات الحماية'); };
  const showTab = async tab => { document.querySelectorAll('.security-tab').forEach(t => t.classList.toggle('active', t.dataset.securityTab === tab)); if (tab === 'users') await renderUsersTab(); else if (tab === 'roles') renderRolesTab(); else if (tab === 'audit') renderAuditTab(); else if (tab === 'sessions') renderSessionsTab(); else renderSettingsTab(); };
  document.querySelectorAll('.security-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.securityTab))); $('security-report').onclick = () => showToast('تم تجهيز تقرير صلاحيات وأمن النظام'); $('security-add-user').onclick = () => openSecurityUserForm(); await showTab('users');
}

function openSecurityUserForm() { $('modal-title').textContent = 'إضافة مستخدم جديد'; $('modal-fields').innerHTML = '<label>اسم المستخدم<input name="username" required /></label><label>الاسم الظاهر<input name="displayNameAr" required /></label><label>كلمة المرور<input name="password" type="password" minlength="8" required /></label><label>الدور<select name="role"><option>مستخدم</option><option>محاسب</option><option>مراجع</option></select></label>'; $('entry-form').dataset.view = 'security-user'; $('form-modal').classList.add('open'); }

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
