/* App controller: wires the UI to MallockDB / MallockFX / MallockOCR /
   MallockExport and owns all rendering. Plain vanilla JS, no framework. */
(() => {
  const state = {
    expenses: [],
    fxRates: [],
    ratesByMonth: {},
    sortAscending: false,
    activeView: "dashboard",
    pendingReceiptBlob: null,
    formMode: "manual", // "manual" | "scan"
  };

  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------

  async function init() {
    $("todayLabel").textContent = new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    populateSelect($("fieldCategory"), MallockFX.CATEGORIES);
    populateSelect($("fieldCurrency"), MallockFX.CURRENCIES);

    wireNav();
    wireAddFlow();
    wireFormModal();
    wireScanModal();
    wireRatesView();
    wireExport();

    await reload();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  async function reload() {
    [state.expenses, state.fxRates] = await Promise.all([
      MallockDB.getAllExpenses(),
      MallockDB.getAllFxRates(),
    ]);
    state.ratesByMonth = MallockFX.indexByMonth(state.fxRates);
    renderDashboard();
    renderExpenseList();
    renderRates();
  }

  function populateSelect(select, values) {
    select.innerHTML = "";
    for (const value of values) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    }
  }

  // ---------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------

  function wireNav() {
    document.querySelectorAll(".tab[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.dataset.view));
    });
    $("sortBtn").addEventListener("click", () => {
      state.sortAscending = !state.sortAscending;
      $("sortIcon").setAttribute("d", state.sortAscending
        ? "M12 19l-6-7h4V5h4v7h4z"
        : "M12 5l6 7h-4v7h-4v-7H6z");
      renderExpenseList();
    });
  }

  function showView(view) {
    state.activeView = view;
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    $(`view-${view}`).classList.add("active");
    document.querySelectorAll(".tab[data-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
  }

  // ---------------------------------------------------------------------
  // Add expense sheet
  // ---------------------------------------------------------------------

  function wireAddFlow() {
    $("addExpenseBtn").addEventListener("click", () => showSheet(true));
    $("cancelSheetBtn").addEventListener("click", () => showSheet(false));
    $("sheetBackdrop").addEventListener("click", () => {
      showSheet(false);
      closeAllModals();
    });
    $("scanReceiptBtn").addEventListener("click", () => {
      showSheet(false);
      openScanModal();
    });
    $("manualEntryBtn").addEventListener("click", () => {
      showSheet(false);
      openFormModal("manual", null);
    });
  }

  function showSheet(visible) {
    $("addSheet").classList.toggle("hidden", !visible);
    $("sheetBackdrop").classList.toggle("hidden", !visible);
  }

  function closeAllModals() {
    $("formModal").classList.add("hidden");
    $("scanModal").classList.add("hidden");
    $("startingRatesModal").classList.add("hidden");
    $("sheetBackdrop").classList.add("hidden");
  }

  // ---------------------------------------------------------------------
  // Scan flow
  // ---------------------------------------------------------------------

  function wireScanModal() {
    $("scanCancelBtn").addEventListener("click", () => $("scanModal").classList.add("hidden"));
    $("takePhotoBtn").addEventListener("click", () => $("cameraInput").click());
    $("chooseLibraryBtn").addEventListener("click", () => $("libraryInput").click());
    $("cameraInput").addEventListener("change", (e) => handleReceiptFile(e.target.files[0]));
    $("libraryInput").addEventListener("change", (e) => handleReceiptFile(e.target.files[0]));
  }

  function openScanModal() {
    $("scanModal").classList.remove("hidden");
    $("sheetBackdrop").classList.add("hidden");
  }

  async function handleReceiptFile(file) {
    if (!file) return;
    $("scanModal").classList.add("hidden");
    setProcessing(true, "Reading receipt…");
    try {
      const resized = await resizeImage(file, 1600, 0.85);
      let ocrResult = null;
      let ocrError = null;
      try {
        ocrResult = await MallockOCR.recognizeReceipt(resized);
      } catch (err) {
        ocrError = err.message || "Receipt scan failed. You can still enter the details manually below.";
      }
      state.pendingReceiptBlob = resized;
      setProcessing(false);
      openFormModal("scan", { ocrResult, ocrError, blob: resized });
    } catch (err) {
      setProcessing(false);
      showToast("Couldn't read that image.");
    } finally {
      $("cameraInput").value = "";
      $("libraryInput").value = "";
    }
  }

  function setProcessing(visible, label) {
    $("processingOverlay").classList.toggle("hidden", !visible);
    if (label) $("processingLabel").textContent = label;
  }

  function resizeImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("resize failed"))), "image/jpeg", quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("invalid image"));
      };
      img.src = url;
    });
  }

  // ---------------------------------------------------------------------
  // Entry form (manual + scan review)
  // ---------------------------------------------------------------------

  function wireFormModal() {
    $("formCancelBtn").addEventListener("click", closeFormModal);
    $("formSaveBtn").addEventListener("click", saveExpense);
    $("fieldAmount").addEventListener("input", updateConversionPreview);
    $("fieldCurrency").addEventListener("change", updateConversionPreview);
    $("fieldDate").addEventListener("change", updateConversionPreview);
    $("fieldDescription").addEventListener("input", updateSaveEnabled);
    $("fieldAmount").addEventListener("input", updateSaveEnabled);
  }

  function openFormModal(mode, scanPayload) {
    state.formMode = mode;
    $("formTitle").textContent = mode === "scan" ? "Review Scan" : "New Expense";
    $("fieldDate").value = todayISO();
    $("fieldDescription").value = "";
    $("fieldCategory").value = "Other";
    $("fieldAmount").value = "";
    $("fieldCurrency").value = "GBP";
    $("formReceiptPreview").classList.add("hidden");
    $("formNotice").classList.add("hidden");

    if (mode === "scan" && scanPayload) {
      const { ocrResult, ocrError, blob } = scanPayload;
      if (blob) {
        $("formReceiptPreview").src = URL.createObjectURL(blob);
        $("formReceiptPreview").classList.remove("hidden");
      }
      if (ocrError) {
        $("formNotice").textContent = ocrError;
        $("formNotice").className = "banner warning";
      } else {
        $("formNotice").textContent = "Review the details pulled from your receipt before saving.";
        $("formNotice").className = "banner info";
      }
      if (ocrResult) {
        if (ocrResult.date) $("fieldDate").value = ocrResult.date;
        if (ocrResult.description) $("fieldDescription").value = ocrResult.description;
        if (ocrResult.amount !== null && ocrResult.amount !== undefined) {
          $("fieldAmount").value = ocrResult.amount.toFixed(2);
        }
        if (ocrResult.currency) $("fieldCurrency").value = ocrResult.currency;
      }
    } else {
      state.pendingReceiptBlob = null;
    }

    updateConversionPreview();
    updateSaveEnabled();
    $("formModal").classList.remove("hidden");
  }

  function closeFormModal() {
    $("formModal").classList.add("hidden");
    state.pendingReceiptBlob = null;
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function parsedAmount() {
    const raw = $("fieldAmount").value.replace(",", ".").trim();
    const value = parseFloat(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function updateSaveEnabled() {
    const valid = parsedAmount() !== null && $("fieldDescription").value.trim().length > 0;
    $("formSaveBtn").disabled = !valid;
  }

  function updateConversionPreview() {
    const currency = $("fieldCurrency").value;
    const amount = parsedAmount();
    const el = $("conversionPreview");
    if (currency === "GBP" || amount === null) {
      el.textContent = "";
      return;
    }
    const month = MallockFX.monthKey($("fieldDate").value || todayISO());
    const rate = MallockFX.rateFor(month, currency, state.ratesByMonth);
    if (rate === null) {
      el.textContent = `No FX rate set for ${MallockFX.monthLabel(month)} yet — add one on the FX Rates screen.`;
    } else {
      el.textContent = `≈ £${(amount * rate).toFixed(2)} at ${rate.toFixed(4)}`;
    }
  }

  async function saveExpense() {
    const amount = parsedAmount();
    if (amount === null) return;

    const expense = {
      id: crypto.randomUUID(),
      date: $("fieldDate").value || todayISO(),
      description: $("fieldDescription").value.trim(),
      category: $("fieldCategory").value,
      amount,
      currency: $("fieldCurrency").value,
      receiptImageBlob: state.pendingReceiptBlob || null,
      createdAt: new Date().toISOString(),
    };

    await MallockDB.addExpense(expense);
    await ensureMonthSeeded(MallockFX.monthKey(expense.date));
    closeFormModal();
    await reload();
    showToast("Expense saved.");
  }

  async function ensureMonthSeeded(month) {
    if (state.ratesByMonth[month]) return;
    const record = MallockFX.buildDefaultRateRecord(month, state.fxRates);
    await MallockDB.putFxRate(record);
    state.fxRates.push(record);
    state.ratesByMonth = MallockFX.indexByMonth(state.fxRates);
  }

  // ---------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------

  function computeSummary() {
    let total = 0;
    let thisMonth = 0;
    let missing = 0;
    const byCategory = {};
    const currentMonth = MallockFX.currentMonthKey();

    for (const expense of state.expenses) {
      const gbp = MallockFX.gbpValue(expense, state.ratesByMonth);
      if (gbp === null) {
        missing += 1;
        continue;
      }
      total += gbp;
      byCategory[expense.category] = (byCategory[expense.category] || 0) + gbp;
      if (MallockFX.monthKey(expense.date) === currentMonth) thisMonth += gbp;
    }

    let topCategory = null;
    let topValue = -Infinity;
    for (const [category, value] of Object.entries(byCategory)) {
      if (value > topValue) {
        topValue = value;
        topCategory = category;
      }
    }

    return { total, thisMonth, count: state.expenses.length, topCategory, missing };
  }

  function formatGBP(value) {
    return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function renderDashboard() {
    const summary = computeSummary();
    $("statTotal").textContent = formatGBP(summary.total);
    $("statMonth").textContent = formatGBP(summary.thisMonth);
    $("statCount").textContent = String(summary.count);
    $("statTopCategory").textContent = summary.topCategory || "—";

    const banner = $("missingRateBanner");
    if (summary.missing > 0) {
      banner.textContent = `${summary.missing} ${summary.missing === 1 ? "entry" : "entries"} excluded from totals — missing FX rate.`;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }

    const recent = [...state.expenses]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 5);
    renderExpenseRows($("recentList"), recent);
  }

  // ---------------------------------------------------------------------
  // Expenses list
  // ---------------------------------------------------------------------

  function renderExpenseList() {
    const sorted = [...state.expenses].sort((a, b) => {
      if (a.date === b.date) return 0;
      const cmp = a.date < b.date ? -1 : 1;
      return state.sortAscending ? cmp : -cmp;
    });
    renderExpenseRows($("expenseList"), sorted, true);
  }

  function renderExpenseRows(container, expenses, showDelete) {
    container.innerHTML = "";
    if (!expenses.length) {
      const empty = document.createElement("div");
      empty.className = "list-empty";
      empty.textContent = "No expenses logged yet.";
      container.appendChild(empty);
      return;
    }
    for (const expense of expenses) {
      container.appendChild(renderExpenseRow(expense, showDelete));
    }
  }

  function renderExpenseRow(expense, showDelete) {
    const row = document.createElement("div");
    row.className = "expense-row";

    const gbp = MallockFX.gbpValue(expense, state.ratesByMonth);
    const missing = expense.currency !== "GBP" && gbp === null;
    const symbol = MallockFX.CURRENCY_SYMBOLS[expense.currency] || "";

    const dateLabel = new Date(expense.date + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    row.innerHTML = `
      <div class="expense-icon">${expense.category.charAt(0)}</div>
      <div class="expense-main">
        <div class="expense-desc"></div>
        <div class="expense-meta">${escapeHtml(dateLabel)} · ${escapeHtml(expense.category)}</div>
        ${missing ? `<div class="badge">⚠ Rate missing</div>` : ""}
      </div>
      <div class="expense-amounts">
        <div class="expense-original">${symbol}${expense.amount.toFixed(2)}</div>
        <div class="expense-gbp ${missing ? "missing" : ""}">${gbp === null ? "—" : formatGBP(gbp)}</div>
      </div>
      ${showDelete ? `<button class="delete-btn" title="Delete" aria-label="Delete expense">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0 1 13h8l1-13"/>
        </svg>
      </button>` : ""}
    `;
    row.querySelector(".expense-desc").textContent = expense.description;

    if (showDelete) {
      row.querySelector(".delete-btn").addEventListener("click", () => deleteExpense(expense.id));
    }
    return row;
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  async function deleteExpense(id) {
    await MallockDB.deleteExpense(id);
    await reload();
  }

  // ---------------------------------------------------------------------
  // FX rates
  // ---------------------------------------------------------------------

  function wireRatesView() {
    $("addMonthBtn").addEventListener("click", async () => {
      const months = MallockFX.months(state.fxRates);
      const next = nextMonthKey(months);
      await ensureMonthSeeded(next);
      await reload();
    });
    $("startingRatesBtn").addEventListener("click", openStartingRatesModal);
    $("startingRatesCancelBtn").addEventListener("click", () => $("startingRatesModal").classList.add("hidden"));
    $("startingRatesSaveBtn").addEventListener("click", saveStartingRates);
  }

  function nextMonthKey(months) {
    const current = MallockFX.currentMonthKey();
    if (!months.length) return current;
    const latest = months[0];
    if (latest < current) return current;
    const [y, m] = latest.split("-").map(Number);
    const d = new Date(y, m, 1); // rolls to next month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function renderRates() {
    const container = $("ratesContainer");
    container.innerHTML = "";
    const months = MallockFX.months(state.fxRates);

    if (!months.length) {
      const empty = document.createElement("p");
      empty.className = "muted center";
      empty.textContent = "No FX months yet — tap Add Month to start.";
      container.appendChild(empty);
      return;
    }

    for (const month of months) {
      const group = document.createElement("div");
      group.className = "month-group panel";
      const record = state.ratesByMonth[month];

      const title = document.createElement("div");
      title.className = "month-title";
      title.textContent = MallockFX.monthLabel(month);
      group.appendChild(title);

      for (const currency of MallockFX.CONVERTIBLE) {
        const key = currency.toLowerCase();
        const row = document.createElement("div");
        row.className = "rate-row";
        row.innerHTML = `
          <div class="rate-currency">${currency}</div>
          <div class="rate-equals">1 ${currency} =</div>
          <input class="rate-input" type="text" inputmode="decimal" value="${record[key].toFixed(4)}" />
          <div class="rate-suffix">GBP</div>
        `;
        const input = row.querySelector("input");
        input.addEventListener("change", async () => {
          const value = parseFloat(input.value.replace(",", "."));
          if (!Number.isFinite(value)) return;
          record[key] = value;
          await MallockDB.putFxRate(record);
          state.ratesByMonth = MallockFX.indexByMonth(state.fxRates);
          renderDashboard();
          renderExpenseList();
        });
        group.appendChild(row);
      }

      container.appendChild(group);
    }
  }

  function openStartingRatesModal() {
    const rates = MallockFX.getStartingRates();
    $("startEur").value = rates.eur.toFixed(4);
    $("startUsd").value = rates.usd.toFixed(4);
    $("startChf").value = rates.chf.toFixed(4);
    $("startingRatesModal").classList.remove("hidden");
  }

  function saveStartingRates() {
    const eur = parseFloat($("startEur").value.replace(",", "."));
    const usd = parseFloat($("startUsd").value.replace(",", "."));
    const chf = parseFloat($("startChf").value.replace(",", "."));
    MallockFX.setStartingRates({
      eur: Number.isFinite(eur) ? eur : MallockFX.getStartingRates().eur,
      usd: Number.isFinite(usd) ? usd : MallockFX.getStartingRates().usd,
      chf: Number.isFinite(chf) ? chf : MallockFX.getStartingRates().chf,
    });
    $("startingRatesModal").classList.add("hidden");
    showToast("Starting rates saved.");
  }

  // ---------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------

  function wireExport() {
    $("exportBtn").addEventListener("click", async () => {
      if (!state.expenses.length) {
        showToast("No expenses to export yet.");
        return;
      }
      setProcessing(true, "Building export…");
      try {
        await MallockExport.exportExpenses(state.expenses, state.ratesByMonth);
      } catch (err) {
        showToast(err.message || "Export failed.");
      } finally {
        setProcessing(false);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------

  let toastTimer = null;
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
