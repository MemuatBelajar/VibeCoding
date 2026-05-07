const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const state = {
  menu: "transactions",
  txView: "daily",
  statsView: "expense",
  month: new Date().toISOString().slice(0, 7),
  year: new Date().getFullYear(),
  showBuy: false,
  search: "",
  filterType: "all",
  modal: null,
  expandedMonth: null,
  expandedWeek: null,
  data: loadData(),
};

function localDateTime(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localDate(date = new Date()) {
  return localDateTime(date).slice(0, 10);
}

function loadData() {
  const saved = localStorage.getItem("arusku-data");
  if (saved) return JSON.parse(saved);

  const today = new Date();
  const ym = today.toISOString().slice(0, 7);
  return {
    settings: {
      theme: "light",
      showTime: true,
      showDescription: true,
      showBuyButton: true,
      autocomplete: true,
      memoDefault: "date",
    },
    categories: {
      expense: ["Makan", "Transportasi", "Tagihan", "Belanja", "Kesehatan"],
      income: ["Gaji", "Freelance", "Hadiah"],
    },
    assetGroups: [
      { id: "cash", name: "Tunai", assets: [{ id: "cash-main", name: "Cash" }] },
      {
        id: "bank",
        name: "Bank",
        assets: [
          { id: "bca", name: "Rek BCA" },
          { id: "bri", name: "Rek BRI" },
        ],
      },
      { id: "wallet", name: "E-Wallet", assets: [{ id: "gopay", name: "GoPay" }] },
    ],
    transactions: [
      sampleTx(`${ym}-03T08:15`, "income", 4500000, "Gaji", "", "bca", "", "Gaji bulanan", true),
      sampleTx(`${ym}-04T12:21`, "expense", 35000, "Makan", "Siang", "gopay", "", "Nasi padang"),
      sampleTx(`${ym}-05T07:35`, "expense", 18000, "Transportasi", "Ojek", "gopay", "", "Ke kampus"),
      sampleTx(`${ym}-06T20:10`, "transfer", 500000, "", "", "bca", "cash-main", "Tarik tunai"),
      sampleTx(`${ym}-12T21:05`, "expense", 220000, "Belanja", "Rumah", "bri", "", "Kebutuhan bulanan"),
    ],
    memos: [
      {
        id: crypto.randomUUID(),
        date: `${ym}-04`,
        title: "Evaluasi belanja makan",
        body: "Mulai minggu depan coba pisahkan makan siang dan jajan supaya statistik lebih jelas.",
        color: "#f6c85f",
        pinned: true,
      },
    ],
    toBuy: [
      { id: crypto.randomUUID(), category: "Belanja", asset: "gopay", amount: 65000, note: "Sabun dan pasta gigi", done: false },
      { id: crypto.randomUUID(), category: "Makan", asset: "cash-main", amount: 28000, note: "Kopi meeting", done: false },
    ],
    budgets: [
      { id: crypto.randomUUID(), type: "expense", category: "Makan", amount: 1200000, period: ym },
      { id: crypto.randomUUID(), type: "income", category: "Gaji", amount: 4500000, period: ym },
    ],
  };
}

function sampleTx(dateTime, type, amount, category, subcategory, asset, assetTo, note, bookmarked = false) {
  return {
    id: crypto.randomUUID(),
    dateTime,
    type,
    amount,
    category,
    subcategory,
    asset,
    assetTo,
    note,
    description: "",
    bookmarked,
    recurring: false,
    repeatRule: "",
    installment: false,
  };
}

function save() {
  localStorage.setItem("arusku-data", JSON.stringify(state.data));
}

function qs(selector) {
  return document.querySelector(selector);
}

function assetName(id) {
  for (const group of state.data.assetGroups) {
    const asset = group.assets.find((item) => item.id === id);
    if (asset) return `${group.name} > ${asset.name}`;
  }
  return "-";
}

function txInMonth(tx, month = state.month) {
  return tx.dateTime.slice(0, 7) === month;
}

function txInYear(tx, year = state.year) {
  return Number(tx.dateTime.slice(0, 4)) === Number(year);
}

function currentTransactions() {
  const base = state.txView === "monthly"
    ? state.data.transactions.filter((tx) => txInYear(tx))
    : state.data.transactions.filter((tx) => txInMonth(tx));

  return base.filter((tx) => {
    const searchOk = !state.search || [tx.note, tx.category, tx.subcategory, tx.description]
      .join(" ")
      .toLowerCase()
      .includes(state.search.toLowerCase());
    const typeOk = state.filterType === "all" || tx.type === state.filterType;
    return searchOk && typeOk;
  });
}

function totals(transactions) {
  return transactions.reduce(
    (acc, tx) => {
      acc.count += 1;
      acc[tx.type] += tx.amount;
      return acc;
    },
    { income: 0, expense: 0, transfer: 0, count: 0 },
  );
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function render() {
  document.body.classList.toggle("dark", state.data.settings.theme === "dark");
  qs("#app").innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="main">
        ${renderTopbar()}
        ${renderMain()}
      </main>
      ${renderFab()}
      ${state.modal ? renderModal() : ""}
    </div>
  `;
  bindEvents();
}

function renderSidebar() {
  const items = [
    ["transactions", "Arus", "Transaksi"],
    ["stats", "Graf", "Statistik"],
    ["assets", "Dompet", "Aset"],
    ["settings", "Atur", "Setelan"],
  ];
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">A</div>
        <div><h1>ArusKu</h1><p>Catatan uang pribadi</p></div>
      </div>
      <nav class="nav">
        ${items.map(([id, icon, label]) => `<button data-menu="${id}" class="${state.menu === id ? "active" : ""}"><span>${icon}</span><span>${label}</span></button>`).join("")}
      </nav>
    </aside>
  `;
}

function renderTopbar() {
  const isMonthly = state.menu === "transactions" && state.txView === "monthly";
  const title = {
    transactions: "Transaksi",
    stats: "Statistik",
    assets: "Aset",
    settings: "Setelan",
  }[state.menu];
  return `
    <section class="topbar">
      <div class="topbar-left">
        <h2>${title}</h2>
        ${state.menu === "transactions" ? `<input class="month-picker" type="${isMonthly ? "number" : "month"}" value="${isMonthly ? state.year : state.month}" data-period />` : ""}
        ${state.menu === "stats" ? `<select class="month-picker" data-stats-range><option>Bulanan</option><option>Mingguan</option><option>Tahunan</option><option>Periode</option></select>` : ""}
      </div>
      <div class="actions">
        ${state.menu === "transactions" ? `
          <button class="icon-btn ${state.filterType !== "all" ? "active" : ""}" data-cycle-filter title="Filter tipe">F</button>
          <button class="icon-btn" data-bookmarks title="Bookmark">B</button>
          <input class="search-input" placeholder="Cari catatan" value="${state.search}" data-search />
          ${state.data.settings.showBuyButton ? `<button class="text-btn ${state.showBuy ? "active" : ""}" data-toggle-buy>To-Buy</button>` : ""}
        ` : ""}
      </div>
    </section>
  `;
}

function renderMain() {
  if (state.menu === "transactions") return renderTransactions();
  if (state.menu === "stats") return renderStats();
  if (state.menu === "assets") return renderAssets();
  return renderSettings();
}

function renderTransactions() {
  return `
    <div class="subnav">
      ${[
        ["daily", "Harian"],
        ["calendar", "Kalender"],
        ["monthly", "Bulanan"],
        ["memo", "Memo"],
      ].map(([id, label]) => `<button data-tx-view="${id}" class="${state.txView === id ? "active" : ""}">${label}</button>`).join("")}
    </div>
    ${state.txView === "memo" ? renderMemoView() : `
      ${renderSummary(currentTransactions(), state.txView === "monthly" ? "tahun ini" : "bulan ini")}
      <div class="content-grid ${state.showBuy ? "" : "hide-side"}">
        <section>${state.txView === "daily" ? renderDaily() : state.txView === "calendar" ? renderCalendar() : renderMonthly()}</section>
        ${state.showBuy ? renderToBuyPanel() : ""}
      </div>
    `}
  `;
}

function renderSummary(transactions, suffix) {
  const total = totals(transactions);
  return `
    <div class="summary-grid">
      <div class="metric"><span>Pendapatan ${suffix}</span><strong class="income">${rupiah.format(total.income)}</strong></div>
      <div class="metric"><span>Pengeluaran ${suffix}</span><strong class="expense">${rupiah.format(total.expense)}</strong></div>
      <div class="metric"><span>Selisih</span><strong>${rupiah.format(total.income - total.expense)}</strong></div>
      <div class="metric"><span>Transfer ${suffix}</span><strong class="transfer">${rupiah.format(total.transfer)}</strong></div>
    </div>
  `;
}

function groupedByDate(transactions) {
  return transactions
    .slice()
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
    .reduce((acc, tx) => {
      const date = tx.dateTime.slice(0, 10);
      acc[date] ||= [];
      acc[date].push(tx);
      return acc;
    }, {});
}

function renderDaily(transactions = currentTransactions()) {
  const groups = groupedByDate(transactions);
  const dates = Object.keys(groups);
  if (!dates.length) return `<div class="empty">Belum ada transaksi pada periode ini.</div>`;

  return dates.map((date) => {
    const dayTx = groups[date];
    const total = totals(dayTx);
    const memo = state.data.memos.find((item) => item.date === date);
    return `
      <div class="day-group">
        <div class="day-header">
          <strong>${formatDate(date)}</strong>
          <span><span class="income">${rupiah.format(total.income)}</span> / <span class="expense">${rupiah.format(total.expense)}</span></span>
        </div>
        ${memo ? `<button class="memo-strip" data-open-memo="${memo.id}">${memo.title}</button>` : ""}
        ${dayTx.map(renderTransaction).join("")}
      </div>
    `;
  }).join("");
}

function renderTransaction(tx) {
  const sign = tx.type === "income" ? "" : tx.type === "expense" ? "-" : "";
  const time = tx.dateTime.slice(11, 16);
  const assetCaption = tx.type === "transfer"
    ? `${assetName(tx.asset)} -> ${assetName(tx.assetTo)}`
    : assetName(tx.asset);
  return `
    <button class="transaction" data-edit-tx="${tx.id}">
      <small>${state.data.settings.showTime ? time : ""}</small>
      <div>
        <div class="transaction-title">${tx.type === "transfer" ? "Transfer" : tx.category || "-"}</div>
        <div>${tx.note || tx.subcategory || "Tanpa catatan"}</div>
        <div class="caption">${assetCaption}</div>
      </div>
      <strong class="${tx.type}">${sign}${rupiah.format(tx.amount)}</strong>
    </button>
  `;
}

function renderCalendar() {
  const [year, month] = state.month.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push(date);
  }
  const weekdays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return `
    <div class="calendar">${weekdays.map((day) => `<div class="weekday">${day}</div>`).join("")}
      ${cells.map((date) => {
        const iso = localDate(date);
        const txs = currentTransactions().filter((tx) => tx.dateTime.slice(0, 10) === iso);
        const total = totals(txs);
        return `
          <div class="calendar-cell ${date.getMonth() !== month - 1 ? "dim" : ""}">
            <div class="calendar-date">${date.getDate()}</div>
            <div class="cal-line"><span>Masuk</span><b class="income">${shortMoney(total.income)}</b></div>
            <div class="cal-line"><span>Keluar</span><b class="expense">${shortMoney(total.expense)}</b></div>
            <div class="cal-line"><span>Total</span><b>${txs.length}</b></div>
            <div class="cal-line"><span>TF</span><b class="transfer">${shortMoney(total.transfer)}</b></div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function shortMoney(value) {
  if (!value) return "-";
  if (value >= 1000000) return `${Math.round(value / 1000000)} jt`;
  if (value >= 1000) return `${Math.round(value / 1000)} rb`;
  return String(value);
}

function renderMonthly() {
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `
    <div class="month-list">
      ${names.map((name, index) => {
        const month = `${state.year}-${String(index + 1).padStart(2, "0")}`;
        const txs = state.data.transactions.filter((tx) => txInMonth(tx, month));
        const total = totals(txs);
        const expanded = state.expandedMonth === month;
        return `
          <div class="month-card">
            <button data-expand-month="${month}">
              <strong>${name} ${state.year}</strong>
              <span class="income">${rupiah.format(total.income)}</span>
              <span class="expense">${rupiah.format(total.expense)}</span>
              <span>${rupiah.format(total.income - total.expense)}</span>
              <span class="transfer">${rupiah.format(total.transfer)}</span>
            </button>
            ${expanded ? renderWeeks(month, txs) : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderWeeks(month, transactions) {
  const weeks = transactions.reduce((acc, tx) => {
    const week = Math.ceil(Number(tx.dateTime.slice(8, 10)) / 7);
    acc[week] ||= [];
    acc[week].push(tx);
    return acc;
  }, {});
  return `<div class="week-list">
    ${[1, 2, 3, 4, 5].map((week) => {
      const txs = weeks[week] || [];
      const total = totals(txs);
      const key = `${month}-${week}`;
      return `
        <div class="week-row">
          <button class="text-btn" data-expand-week="${key}">Minggu ke-${week} - ${rupiah.format(total.income - total.expense)}</button>
          ${state.expandedWeek === key ? renderDaily(txs) : ""}
        </div>
      `;
    }).join("")}
  </div>`;
}

function renderMemoView() {
  const showingBuy = state.showBuy;
  const memos = state.data.memos
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));
  return `
    <div class="content-grid ${showingBuy ? "" : "hide-side"}">
      <section class="panel">
        <h3>${showingBuy ? "To-Buy List" : "Memo"}</h3>
        ${showingBuy ? renderToBuyList() : `<div class="memo-list">${memos.map(renderMemoCard).join("") || `<div class="empty">Belum ada memo.</div>`}</div>`}
      </section>
      ${showingBuy ? renderToBuyPanel(true) : ""}
    </div>
  `;
}

function renderMemoCard(memo) {
  return `
    <button class="memo-card ${memo.pinned ? "pinned" : ""}" data-open-memo="${memo.id}" style="border-left: 5px solid ${memo.color}">
      <h4>${memo.pinned ? "Pin - " : ""}${memo.title}</h4>
      <div class="caption">${formatDate(memo.date)}</div>
      <p>${memo.body}</p>
    </button>
  `;
}

function renderToBuyPanel(compact = false) {
  return `
    <aside class="panel">
      <h3>To-Buy List</h3>
      ${renderToBuyList()}
      ${compact ? "" : `<button class="text-btn primary" data-new-buy>Tambah To-Buy</button>`}
    </aside>
  `;
}

function renderToBuyList() {
  return `
    <div class="to-buy-list">
      ${state.data.toBuy.map((item) => `
        <div class="to-buy ${item.done ? "done" : ""}">
          <input type="checkbox" ${item.done ? "checked" : ""} data-check-buy="${item.id}" />
          <div><strong>${item.note}</strong><div class="caption">${item.category} - ${assetName(item.asset)}</div></div>
          <strong>${rupiah.format(item.amount)}</strong>
        </div>
      `).join("") || `<div class="empty">Daftar belanja kosong.</div>`}
    </div>
  `;
}

function renderStats() {
  const txs = state.data.transactions.filter((tx) => txInMonth(tx));
  const total = totals(txs);
  const views = [
    ["expense", "Pengeluaran"],
    ["income", "Pemasukan"],
    ["transfer", "Transfer"],
    ["budget", "Anggaran"],
    ["close", "Tutup Buku"],
  ];
  return `
    ${renderSummary(txs, "rentang ini")}
    <section class="panel">
      <h3>Dashboard</h3>
      <div class="chart">${renderBars(txs)}</div>
      <div class="summary-grid">
        <div class="metric"><span>Jumlah transaksi</span><strong>${total.count}</strong></div>
        <div class="metric"><span>Dominasi</span><strong>${dominant(total)}</strong></div>
        <div class="metric"><span>Pemasukan</span><strong class="income">${percent(total.income, total.income + total.expense + total.transfer)}</strong></div>
        <div class="metric"><span>Pengeluaran</span><strong class="expense">${percent(total.expense, total.income + total.expense + total.transfer)}</strong></div>
      </div>
    </section>
    <div class="subnav">${views.map(([id, label]) => `<button data-stats-view="${id}" class="${state.statsView === id ? "active" : ""}">${label}</button>`).join("")}</div>
    ${renderStatsSubView(txs)}
  `;
}

function renderBars(txs) {
  const days = Array.from({ length: 12 }, (_, index) => index + 1);
  const max = Math.max(...txs.map((tx) => tx.amount), 1);
  return days.map((day) => {
    const dayTx = txs.filter((tx) => Math.ceil(Number(tx.dateTime.slice(8, 10)) / 3) === day);
    const total = totals(dayTx);
    return `<div class="bar-stack">
      <div class="bar income" style="height:${(total.income / max) * 100}%; background: var(--income)"></div>
      <div class="bar expense" style="height:${(total.expense / max) * 100}%; background: var(--expense)"></div>
      <div class="bar transfer" style="height:${(total.transfer / max) * 100}%; background: var(--transfer)"></div>
    </div>`;
  }).join("");
}

function dominant(total) {
  const entries = [
    ["Pemasukan", total.income],
    ["Pengeluaran", total.expense],
    ["Transfer", total.transfer],
  ].sort((a, b) => b[1] - a[1]);
  return entries[0][1] ? entries[0][0] : "-";
}

function percent(value, all) {
  return all ? `${Math.round((value / all) * 100)}%` : "0%";
}

function renderStatsSubView(txs) {
  if (state.statsView === "budget") return renderBudget();
  if (state.statsView === "close") return renderCloseBook(txs);
  const type = state.statsView;
  const label = type === "expense" ? "Pengeluaran" : type === "income" ? "Pemasukan" : "Transfer";
  const relevant = txs.filter((tx) => tx.type === type);
  const keyName = type === "transfer" ? "asset" : "category";
  const grouped = groupTotals(relevant, keyName);
  const total = totals(relevant)[type];
  return `
    <section class="panel">
      <h3>${label} per ${type === "transfer" ? "Aset" : "Kategori"}</h3>
      <div class="pie" title="Klik kategori pada daftar untuk melihat detail"></div>
      ${Object.entries(grouped).map(([name, item]) => `
        <button class="progress-row" data-category-detail="${type}:${name}">
          <strong>${type === "transfer" ? assetName(name) : name || "-"}</strong>
          <span>${percent(item.amount, total)} - ${item.count}x - ${rupiah.format(item.amount)}</span>
          <div class="progress-track"><div class="progress-fill" style="width:${percent(item.amount, total)}"></div></div>
        </button>
      `).join("") || `<div class="empty">Belum ada data.</div>`}
    </section>
  `;
}

function groupTotals(transactions, keyName) {
  return transactions.reduce((acc, tx) => {
    const key = tx[keyName] || "-";
    acc[key] ||= { amount: 0, count: 0 };
    acc[key].amount += tx.amount;
    acc[key].count += 1;
    return acc;
  }, {});
}

function renderBudget() {
  return `
    <section class="panel">
      <h3>Anggaran</h3>
      <div class="budget-list">
        ${state.data.budgets.map((budget) => {
          const actual = state.data.transactions
            .filter((tx) => tx.type === budget.type && tx.category === budget.category && tx.dateTime.startsWith(budget.period))
            .reduce((sum, tx) => sum + tx.amount, 0);
          const ratio = budget.amount ? Math.round((actual / budget.amount) * 100) : 0;
          return `
            <div class="budget-row">
              <header><strong>${budget.type === "income" ? "Pemasukan" : "Pengeluaran"} - ${budget.category}</strong><span>${ratio}%</span></header>
              <div class="caption">${rupiah.format(actual)} dari ${rupiah.format(budget.amount)} - ${budgetText(budget.type, ratio)}</div>
              <div class="progress-track"><div class="progress-fill" style="width:${Math.min(ratio, 140)}%; background:${ratio > 100 && budget.type === "expense" ? "var(--expense)" : "var(--primary)"}"></div></div>
            </div>
          `;
        }).join("")}
      </div>
      <button class="text-btn primary" data-new-budget>Tetapkan Anggaran</button>
    </section>
  `;
}

function budgetText(type, ratio) {
  if (ratio > 100) return type === "income" ? "Sangat Baik" : "Over Budget";
  if (ratio === 100) return type === "income" ? "Sesuai Target" : "Sesuai Anggaran";
  if (ratio >= 90) return type === "income" ? "Hampir Tercapai" : "Masih Terkendali";
  return type === "income" ? "Kurang Tercapai" : "Hemat";
}

function renderCloseBook(txs) {
  return `
    <section class="panel">
      <h3>Tutup Buku</h3>
      <p class="caption">Ekspor CSV untuk rentang bulan aktif.</p>
      <button class="text-btn primary" data-export>Ekspor CSV</button>
      <div class="empty">${txs.length} baris siap diekspor.</div>
    </section>
  `;
}

function renderAssets() {
  return `
    <section class="panel">
      <h3>Saldo Real-time</h3>
      <div class="asset-list">
        ${state.data.assetGroups.map((group) => `
          <div class="asset-row">
            <header><strong>${group.name}</strong><button class="text-btn" data-add-asset="${group.id}">Tambah Aset</button></header>
            ${group.assets.map((asset) => `<div class="cal-line"><span>${asset.name}</span><b>${rupiah.format(balance(asset.id))}</b></div>`).join("")}
          </div>
        `).join("")}
      </div>
      <button class="text-btn primary" data-add-group>Tambah Grup Aset</button>
    </section>
  `;
}

function balance(assetId) {
  return state.data.transactions.reduce((sum, tx) => {
    if (tx.type === "income" && tx.asset === assetId) return sum + tx.amount;
    if (tx.type === "expense" && tx.asset === assetId) return sum - tx.amount;
    if (tx.type === "transfer" && tx.asset === assetId) return sum - tx.amount;
    if (tx.type === "transfer" && tx.assetTo === assetId) return sum + tx.amount;
    return sum;
  }, 0);
}

function renderSettings() {
  const settings = state.data.settings;
  return `
    <section class="panel">
      <h3>Preferensi</h3>
      <div class="setting-list">
        ${settingSelect("theme", "Tema", settings.theme, [["light", "Terang"], ["dark", "Gelap"]])}
        ${settingToggle("showTime", "Tampilkan jam transaksi", settings.showTime)}
        ${settingToggle("showDescription", "Tampilkan deskripsi", settings.showDescription)}
        ${settingToggle("showBuyButton", "Tampilkan tombol To-Buy List", settings.showBuyButton)}
        ${settingToggle("autocomplete", "Autofill riwayat catatan", settings.autocomplete)}
        ${settingSelect("memoDefault", "Default tampilan memo", settings.memoDefault, [["date", "Tanggal"], ["pin", "Pin"]])}
      </div>
    </section>
  `;
}

function settingToggle(key, label, value) {
  return `<label class="to-buy"><input type="checkbox" data-setting="${key}" ${value ? "checked" : ""} /><span>${label}</span></label>`;
}

function settingSelect(key, label, value, options) {
  return `<label class="field"><span>${label}</span><select data-setting="${key}">${options.map(([id, text]) => `<option value="${id}" ${value === id ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
}

function renderFab() {
  if (state.menu === "settings") return "";
  const label = state.menu === "transactions" && state.txView === "memo" ? "N" : "+";
  return `<button class="fab" data-fab>${label}</button>`;
}

function renderModal() {
  if (state.modal.type === "transaction") return renderTransactionModal(state.modal.id);
  if (state.modal.type === "memo") return renderMemoModal(state.modal.id);
  if (state.modal.type === "simple") return renderSimpleModal();
  return "";
}

function renderTransactionModal(id) {
  const existing = id ? state.data.transactions.find((item) => item.id === id) : null;
  const tx = existing ? { ...existing, type: state.modal.editType || existing.type } : {
    type: state.modal.prefillType || "expense",
    dateTime: localDateTime(),
    amount: "",
    category: "Makan",
    subcategory: "",
    asset: firstAssetId(),
    assetTo: "bca",
    note: "",
    description: "",
    bookmarked: false,
    recurring: false,
    repeatRule: "",
    installment: false,
  };
  const categories = tx.type === "income" ? state.data.categories.income : state.data.categories.expense;
  return `
    <div class="modal-backdrop">
      <form class="modal" data-save-tx="${id || ""}">
        <header>
          <button class="icon-btn" type="button" data-close>←</button>
          <h3>${id ? "Edit Transaksi" : "Tambah Transaksi"}</h3>
          <button class="icon-btn ${tx.bookmarked ? "active" : ""}" type="button" data-toggle-bookmark-modal>B</button>
        </header>
        <div class="form">
          <div class="segmented">
            ${["expense", "income", "transfer"].map((type) => `<button type="button" data-modal-type="${type}" class="${tx.type === type ? "active" : ""}">${typeLabel(type)}</button>`).join("")}
          </div>
          <div class="form-grid">
            <label class="field"><span>Tanggal & Waktu</span><input name="dateTime" type="datetime-local" value="${tx.dateTime.slice(0, 16)}" required /></label>
            <label class="field"><span>Total</span><input name="amount" type="number" min="0" value="${tx.amount}" required /></label>
          </div>
          ${tx.type === "transfer" ? `
            <div class="form-grid">
              <label class="field"><span>Aset Keluar</span>${assetSelect("asset", tx.asset)}</label>
              <label class="field"><span>Aset Masuk</span>${assetSelect("assetTo", tx.assetTo)}</label>
            </div>
          ` : `
            <div class="form-grid">
              <label class="field"><span>Kategori</span><input name="category" list="category-list" value="${tx.category}" required /><datalist id="category-list">${categories.map((cat) => `<option value="${cat}"></option>`).join("")}</datalist></label>
              <label class="field"><span>Sub-kategori</span><input name="subcategory" value="${tx.subcategory || ""}" /></label>
              <label class="field"><span>Aset</span>${assetSelect("asset", tx.asset)}</label>
            </div>
          `}
          <div class="form-grid">
            <label class="to-buy"><input name="recurring" type="checkbox" ${tx.recurring ? "checked" : ""} />Berulang</label>
            ${tx.type === "expense" ? `<label class="to-buy"><input name="installment" type="checkbox" ${tx.installment ? "checked" : ""} />Cicilan</label>` : ""}
          </div>
          <label class="field"><span>Frekuensi / Batas Akhir</span><input name="repeatRule" value="${tx.repeatRule || ""}" placeholder="Contoh: setiap bulan, 12 kali" /></label>
          <label class="field"><span>Catatan</span><input name="note" list="note-history" value="${tx.note || ""}" /><datalist id="note-history">${noteHistory().map((note) => `<option value="${note}"></option>`).join("")}</datalist></label>
          <label class="field"><span>Deskripsi</span><textarea name="description">${tx.description || ""}</textarea></label>
          <div class="actions">
            ${id ? `<button class="text-btn danger" type="button" data-delete-tx="${id}">Hapus</button><button class="text-btn" type="button" data-copy-tx="${id}">Salin</button>` : ""}
            <button class="text-btn primary" type="submit">Simpan</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function typeLabel(type) {
  return { expense: "Pengeluaran", income: "Pemasukan", transfer: "Transfer" }[type];
}

function firstAssetId() {
  return state.data.assetGroups[0]?.assets[0]?.id || "";
}

function assetSelect(name, value) {
  return `<select name="${name}" required>
    ${state.data.assetGroups.map((group) => `<optgroup label="${group.name}">${group.assets.map((asset) => `<option value="${asset.id}" ${value === asset.id ? "selected" : ""}>${asset.name}</option>`).join("")}</optgroup>`).join("")}
  </select>`;
}

function noteHistory() {
  if (!state.data.settings.autocomplete) return [];
  return [...new Set(state.data.transactions.map((tx) => tx.note).filter(Boolean))];
}

function renderMemoModal(id) {
  const memo = id ? state.data.memos.find((item) => item.id === id) : {
    date: localDate(),
    title: "",
    body: "",
    color: "#f6c85f",
    pinned: false,
  };
  return `
    <div class="modal-backdrop">
      <form class="modal" data-save-memo="${id || ""}">
        <header>
          <button class="icon-btn" type="button" data-close>←</button>
          <h3>Memo</h3>
          <label class="icon-btn"><input name="pinned" type="checkbox" ${memo.pinned ? "checked" : ""} hidden />P</label>
        </header>
        <div class="form">
          <div class="form-grid">
            <label class="field"><span>Tanggal dikaitkan</span><input name="date" type="date" value="${memo.date}" required /></label>
            <label class="field"><span>Warna</span><input name="color" type="color" value="${memo.color}" /></label>
          </div>
          <label class="field"><span>Judul</span><input name="title" value="${memo.title}" required /></label>
          <label class="field"><span>Isi memo</span><textarea name="body">${memo.body}</textarea></label>
          <div class="actions">
            ${id ? `<button class="text-btn danger" type="button" data-delete-memo="${id}">Hapus</button>` : ""}
            <button class="text-btn primary" type="submit">Simpan</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function renderSimpleModal() {
  return `
    <div class="modal-backdrop">
      <form class="modal" data-simple-form="${state.modal.kind}">
        <header><button class="icon-btn" type="button" data-close>←</button><h3>${state.modal.title}</h3><span></span></header>
        <div class="form">${state.modal.body}</div>
      </form>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      state.menu = button.dataset.menu;
      render();
    });
  });
  document.querySelectorAll("[data-tx-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.txView = button.dataset.txView;
      render();
    });
  });
  document.querySelectorAll("[data-stats-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.statsView = button.dataset.statsView;
      render();
    });
  });
  document.querySelector("[data-period]")?.addEventListener("change", (event) => {
    if (state.txView === "monthly") state.year = Number(event.target.value);
    else state.month = event.target.value;
    render();
  });
  document.querySelector("[data-search]")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  document.querySelector("[data-cycle-filter]")?.addEventListener("click", () => {
    const values = ["all", "income", "expense", "transfer"];
    state.filterType = values[(values.indexOf(state.filterType) + 1) % values.length];
    render();
  });
  document.querySelector("[data-toggle-buy]")?.addEventListener("click", () => {
    state.showBuy = !state.showBuy;
    render();
  });
  document.querySelector("[data-bookmarks]")?.addEventListener("click", () => {
    state.search = "";
    state.filterType = "all";
    state.modal = {
      type: "simple",
      kind: "bookmarks",
      title: "Bookmark",
      body: state.data.transactions.filter((tx) => tx.bookmarked).map(renderTransaction).join("") || `<div class="empty">Belum ada bookmark.</div>`,
    };
    render();
  });
  document.querySelector("[data-fab]")?.addEventListener("click", () => {
    state.modal = { type: state.menu === "transactions" && state.txView === "memo" ? "memo" : "transaction" };
    render();
  });
  document.querySelectorAll("[data-edit-tx]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modal = { type: "transaction", id: button.dataset.editTx };
      render();
    });
  });
  document.querySelectorAll("[data-open-memo]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modal = { type: "memo", id: button.dataset.openMemo };
      render();
    });
  });
  document.querySelectorAll("[data-expand-month]").forEach((button) => {
    button.addEventListener("click", () => {
      state.expandedMonth = state.expandedMonth === button.dataset.expandMonth ? null : button.dataset.expandMonth;
      render();
    });
  });
  document.querySelectorAll("[data-expand-week]").forEach((button) => {
    button.addEventListener("click", () => {
      state.expandedWeek = state.expandedWeek === button.dataset.expandWeek ? null : button.dataset.expandWeek;
      render();
    });
  });
  document.querySelectorAll("[data-check-buy]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => checkBuy(checkbox.dataset.checkBuy, checkbox.checked));
  });
  document.querySelectorAll("[data-setting]").forEach((input) => {
    input.addEventListener("change", () => {
      state.data.settings[input.dataset.setting] = input.type === "checkbox" ? input.checked : input.value;
      save();
      render();
    });
  });
  document.querySelectorAll("[data-category-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const [type, value] = button.dataset.categoryDetail.split(":");
      const label = type === "transfer" ? assetName(value) : value;
      const txs = state.data.transactions.filter((tx) => {
        const inPeriod = txInMonth(tx);
        const sameType = tx.type === type;
        const sameKey = type === "transfer" ? tx.asset === value : tx.category === value;
        return inPeriod && sameType && sameKey;
      });
      const amount = txs.reduce((sum, tx) => sum + tx.amount, 0);
      state.modal = {
        type: "simple",
        kind: "detail",
        title: label,
        body: `
          <div class="summary-grid">
            <div class="metric"><span>Total</span><strong>${rupiah.format(amount)}</strong></div>
            <div class="metric"><span>Frekuensi</span><strong>${txs.length}x</strong></div>
          </div>
          ${renderDaily(txs)}
        `,
      };
      render();
    });
  });
  document.querySelector("[data-export]")?.addEventListener("click", exportCsv);
  bindModal();
  bindSimpleActions();
}

function bindModal() {
  document.querySelector("[data-close]")?.addEventListener("click", () => {
    state.modal = null;
    render();
  });
  document.querySelectorAll("[data-modal-type]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.modal.id) {
        state.modal.editType = button.dataset.modalType;
      } else {
        state.modal.prefillType = button.dataset.modalType;
      }
      render();
    });
  });
  document.querySelector("[data-save-tx]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const id = form.dataset.saveTx;
    const existing = id ? state.data.transactions.find((tx) => tx.id === id) : null;
    const tx = {
      id: id || crypto.randomUUID(),
      type: state.modal.editType || state.modal.prefillType || document.querySelector("[data-modal-type].active")?.dataset.modalType || existing?.type || "expense",
      dateTime: data.dateTime,
      amount: Number(data.amount),
      category: data.category || "",
      subcategory: data.subcategory || "",
      asset: data.asset || "",
      assetTo: data.assetTo || "",
      note: data.note || "",
      description: data.description || "",
      bookmarked: existing?.bookmarked || false,
      recurring: Boolean(data.recurring),
      repeatRule: data.repeatRule || "",
      installment: Boolean(data.installment),
    };
    if (existing) Object.assign(existing, tx);
    else state.data.transactions.push(tx);
    save();
    state.modal = null;
    render();
  });
  document.querySelector("[data-save-memo]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const id = form.dataset.saveMemo;
    const memo = {
      id: id || crypto.randomUUID(),
      date: data.date,
      title: data.title,
      body: data.body,
      color: data.color,
      pinned: Boolean(data.pinned),
    };
    const existing = state.data.memos.find((item) => item.id === id);
    if (existing) Object.assign(existing, memo);
    else state.data.memos.push(memo);
    save();
    state.modal = null;
    render();
  });
  document.querySelector("[data-toggle-bookmark-modal]")?.addEventListener("click", () => {
    const tx = state.data.transactions.find((item) => item.id === state.modal.id);
    if (tx) tx.bookmarked = !tx.bookmarked;
    save();
    render();
  });
  document.querySelector("[data-delete-tx]")?.addEventListener("click", (event) => {
    const tx = state.data.transactions.find((item) => item.id === event.target.dataset.deleteTx);
    if (tx?.buyId) {
      const buy = state.data.toBuy.find((item) => item.id === tx.buyId);
      if (buy) buy.done = false;
    }
    state.data.transactions = state.data.transactions.filter((item) => item.id !== event.target.dataset.deleteTx);
    save();
    state.modal = null;
    render();
  });
  document.querySelector("[data-copy-tx]")?.addEventListener("click", (event) => {
    const tx = state.data.transactions.find((item) => item.id === event.target.dataset.copyTx);
    state.data.transactions.push({ ...tx, id: crypto.randomUUID(), dateTime: localDateTime(), bookmarked: false, buyId: undefined });
    save();
    state.modal = null;
    render();
  });
  document.querySelector("[data-delete-memo]")?.addEventListener("click", (event) => {
    state.data.memos = state.data.memos.filter((memo) => memo.id !== event.target.dataset.deleteMemo);
    save();
    state.modal = null;
    render();
  });
}

function bindSimpleActions() {
  document.querySelector("[data-add-group]")?.addEventListener("click", () => {
    state.modal = {
      type: "simple",
      kind: "group",
      title: "Tambah Grup Aset",
      body: `<label class="field"><span>Nama grup</span><input name="name" required /></label><button class="text-btn primary" type="submit">Simpan</button>`,
    };
    render();
  });
  document.querySelectorAll("[data-add-asset]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modal = {
        type: "simple",
        kind: `asset:${button.dataset.addAsset}`,
        title: "Tambah Aset",
        body: `<label class="field"><span>Nama aset</span><input name="name" required /></label><button class="text-btn primary" type="submit">Simpan</button>`,
      };
      render();
    });
  });
  document.querySelector("[data-new-budget]")?.addEventListener("click", () => {
    state.modal = {
      type: "simple",
      kind: "budget",
      title: "Tetapkan Anggaran",
      body: `
        <label class="field"><span>Tipe</span><select name="type"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label>
        <label class="field"><span>Kategori</span><input name="category" required /></label>
        <label class="field"><span>Periode</span><input name="period" type="month" value="${state.month}" required /></label>
        <label class="field"><span>Total target</span><input name="amount" type="number" required /></label>
        <button class="text-btn primary" type="submit">Simpan</button>`,
    };
    render();
  });
  document.querySelector("[data-new-buy]")?.addEventListener("click", () => {
    state.modal = {
      type: "simple",
      kind: "buy",
      title: "Tambah To-Buy",
      body: `
        <label class="field"><span>Catatan</span><input name="note" required /></label>
        <label class="field"><span>Kategori</span><input name="category" required /></label>
        <label class="field"><span>Aset</span>${assetSelect("asset", firstAssetId())}</label>
        <label class="field"><span>Nominal</span><input name="amount" type="number" required /></label>
        <button class="text-btn primary" type="submit">Simpan</button>`,
    };
    render();
  });
  document.querySelector("[data-simple-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const kind = form.dataset.simpleForm;
    if (kind === "group") {
      state.data.assetGroups.push({ id: crypto.randomUUID(), name: data.name, assets: [] });
    } else if (kind.startsWith("asset:")) {
      state.data.assetGroups.find((group) => group.id === kind.split(":")[1])?.assets.push({ id: crypto.randomUUID(), name: data.name });
    } else if (kind === "budget") {
      state.data.budgets.push({ id: crypto.randomUUID(), type: data.type, category: data.category, period: data.period, amount: Number(data.amount) });
    } else if (kind === "buy") {
      state.data.toBuy.push({ id: crypto.randomUUID(), category: data.category, asset: data.asset, amount: Number(data.amount), note: data.note, done: false });
    }
    save();
    state.modal = null;
    render();
  });
}

function checkBuy(id, done) {
  const item = state.data.toBuy.find((buy) => buy.id === id);
  item.done = done;
  if (done) {
    state.data.transactions.push({
      id: crypto.randomUUID(),
      dateTime: localDateTime(),
      type: "expense",
      amount: item.amount,
      category: item.category,
      subcategory: "",
      asset: item.asset,
      assetTo: "",
      note: item.note,
      description: "Dibuat dari To-Buy List",
      bookmarked: false,
      recurring: false,
      repeatRule: "",
      installment: false,
      buyId: id,
    });
  } else {
    state.data.transactions = state.data.transactions.filter((tx) => tx.buyId !== id);
  }
  save();
  render();
}

function exportCsv() {
  const rows = state.data.transactions.filter((tx) => txInMonth(tx)).map((tx) => [
    tx.dateTime.slice(0, 10),
    `${tx.dateTime.slice(11, 16)}:00`,
    tx.type === "transfer" ? `${assetName(tx.asset)} -> ${assetName(tx.assetTo)}` : assetName(tx.asset),
    tx.type === "transfer" ? "Transfer Keluar" : tx.category,
    tx.subcategory,
    tx.note,
    tx.amount,
    typeLabel(tx.type),
    tx.description,
  ]);
  const header = ["Tanggal", "Jam-Menit-Detik", "Aset", "Kategori", "Subkategori", "Catatan", "Nominal", "Tipe", "Deskripsi"];
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `arusku-${state.month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

render();
