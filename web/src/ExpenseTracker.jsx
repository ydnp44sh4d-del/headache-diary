import React, { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import { guessCategory, guessVendor } from "./receiptGuess.js";
import { pdfFirstPageToDataUrl, isPdf } from "./pdfToImage.js";

const CATEGORIES = [
  { name: "Travel", color: "#C9A961" },
  { name: "Meals & Entertainment", color: "#8FA6A3" },
  { name: "Accommodation", color: "#A78BFA" },
  { name: "Fuel & Transport", color: "#E0975C" },
  { name: "Office & Supplies", color: "#7BA6D9" },
  { name: "Software & Subscriptions", color: "#5FB88A" },
  { name: "Professional Services", color: "#D97C8C" },
  { name: "Equipment & Tools", color: "#B0B0B5" },
  { name: "Other", color: "#6B6B70" },
];

const CURRENCIES = ["GBP", "EUR", "USD", "CHF"];

const categoryColor = (name) =>
  (CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1]).color;

// Downscale large images client-side so OCR and storage stay fast and cheap
function resizeImage(file, maxDim = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      fn(arg);
    };
    const timeout = setTimeout(() => {
      finish(reject, new Error("TIMEOUT"));
    }, 10000);
    reader.onload = (e) => {
      img.onload = () => {
        clearTimeout(timeout);
        try {
          let { width, height } = img;
          if (!width || !height) {
            finish(reject, new Error("DECODE_FAILED"));
            return;
          }
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
          finish(resolve, { dataUrl });
        } catch (err) {
          finish(reject, new Error("DECODE_FAILED"));
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        finish(reject, new Error("DECODE_FAILED"));
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      clearTimeout(timeout);
      finish(reject, new Error("READ_FAILED"));
    };
    reader.readAsDataURL(file);
  });
}

function isHeic(file) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
}

function MallockWordmark({ width = 200 }) {
  return (
    <svg
      viewBox="0 0 163.4 20.61"
      width={width}
      height={(width * 20.61) / 163.4}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Mallock"
      role="img"
    >
      <defs>
        <linearGradient id="chromeFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="14%" stopColor="#c2c2c7" />
          <stop offset="28%" stopColor="#3f3f45" />
          <stop offset="40%" stopColor="#f7f7f9" />
          <stop offset="50%" stopColor="#1c1c20" />
          <stop offset="60%" stopColor="#eeeef0" />
          <stop offset="72%" stopColor="#4a4a50" />
          <stop offset="86%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#7c7c82" />
        </linearGradient>
        <filter id="chromeBevel" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.35" result="blur" />
          <feSpecularLighting
            in="blur"
            surfaceScale="2.2"
            specularConstant="1.15"
            specularExponent="22"
            lightingColor="#ffffff"
            result="spec"
          >
            <fePointLight x="15" y="-35" z="45" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip" />
          <feMerge result="litBase">
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="specClip" />
          </feMerge>
          <feDropShadow in="litBase" dx="0.6" dy="0.9" stdDeviation="0.25" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>
      <g filter="url(#chromeBevel)">
        <path
          fill="url(#chromeFill)"
          stroke="#ffffff"
          strokeOpacity="0.3"
          strokeWidth="0.12"
          d="M145.89,17.95l-8.51-8.51L146.49.33h-3.19l-7.99,7.99V.33h-2.25v17.62h-5.99v-1.65h-1.13c-3.78,0-6.86-3.08-6.86-6.86s3.08-6.86,6.86-6.86h1.13V.33h-1.13c-5.03,0-9.11,4.09-9.11,9.11,0,3.88,2.43,7.19,5.85,8.51h-15.7c3.42-1.32,5.85-4.63,5.85-8.51,0-5.03-4.09-9.11-9.11-9.11s-9.11,4.09-9.11,9.11c0,3.88,2.43,7.19,5.85,8.51h-9.85v-1.73h-5.99V.33h-2.25v17.62h-6.17v-1.73h-5.99V.33h-2.25v17.62h-5.77L54.85,0l-7.34,17.95h-3.73L36.44,0l-5.99,14.65L24.46,0l-7.34,17.95H0v1.21h29.86l.59,1.45.59-1.45h132.36v-1.21h-17.51ZM96.86,9.44c0-3.78,3.08-6.86,6.86-6.86s6.86,3.08,6.86,6.86-3.08,6.86-6.86,6.86-6.86-3.08-6.86-6.86ZM19.56,17.95l4.9-12,4.9,12h-9.81ZM135.32,10.57l7.38,7.38h-7.38v-7.38ZM54.85,5.96l2.6,6.35h-5.19l2.6-6.35ZM51.33,14.56h7.04l1.38,3.39h-9.81l1.38-3.39ZM31.54,17.95l4.9-12,4.9,12h-9.81Z"
        />
      </g>
    </svg>
  );
}

const emptyDraft = () => ({
  vendor: "",
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  currency: "GBP",
  category: "Other",
  description: "",
  confidence: null,
  thumbnail: null,
  scanNote: null,
});

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("Corp Card");
  const [storageOk, setStorageOk] = useState(true);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [draft, setDraft] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !window.storage || typeof window.storage.get !== "function") {
        setStorageAvailable(false);
        setStorageOk(false);
        setLoaded(true);
        return;
      }
      const tryLoad = async () => {
        const res = await window.storage.get("mallock-expenses", false);
        if (res && res.value) setExpenses(JSON.parse(res.value));
      };
      try {
        await tryLoad();
      } catch (e1) {
        await new Promise((r) => setTimeout(r, 800));
        try {
          await tryLoad();
        } catch (e2) {
          console.warn("Storage load unavailable:", e2);
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(
    async (next) => {
      if (!storageAvailable) return;
      const attempt = async () => {
        const ok = await window.storage.set("mallock-expenses", JSON.stringify(next), false);
        return !!ok;
      };
      try {
        const ok = await attempt();
        setStorageOk(ok);
        if (ok) return;
        throw new Error("Storage returned no result");
      } catch (e1) {
        console.warn("Storage save failed, retrying…", e1);
        await new Promise((r) => setTimeout(r, 800));
        try {
          const ok = await attempt();
          setStorageOk(ok);
        } catch (e2) {
          console.error("Storage save failed after retry:", e2);
          setStorageOk(false);
        }
      }
    },
    [storageAvailable]
  );

  const handleFile = async (file) => {
    const pdf = file && isPdf(file);
    if (!file || (!file.type.startsWith("image/") && !pdf)) {
      if (file && isHeic(file)) {
        setError(
          "That's a HEIC photo (the default iPhone format) — this browser can't read it directly. In Photos, tap Share → choose Mail or Files to auto-convert to JPEG, or take a screenshot of the receipt instead, then upload that."
        );
        return;
      }
      setError("That file isn't a photo or PDF. Try a photo, screenshot, or PDF of the receipt.");
      return;
    }
    if (!pdf && isHeic(file)) {
      setError(
        "That's a HEIC photo (the default iPhone format) — this browser can't read it directly. In Settings → Camera → Formats, switch to 'Most Compatible' to save future photos as JPEG, or take a screenshot of this receipt instead and upload that."
      );
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      let dataUrl, pageCount;
      if (pdf) {
        ({ dataUrl, pageCount } = await pdfFirstPageToDataUrl(file));
      } else {
        ({ dataUrl } = await resizeImage(file));
      }
      setPreviewUrl(dataUrl);

      // On-device OCR (Tesseract, vendored in web/vendor/tesseract) — no
      // API key, no server round-trip, works offline. Results only ever
      // prefill the review form below; nothing here saves automatically.
      let ocrResult = null;
      let ocrError = null;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        ocrResult = await window.MallockOCR.recognizeReceipt(blob);
      } catch (err) {
        ocrError = err && err.message ? err.message : "Couldn't read the receipt text. You can still enter the details below.";
      }
      if (pageCount > 1) {
        ocrError = ocrError
          ? `${ocrError} (Only page 1 of this ${pageCount}-page PDF was scanned.)`
          : `Only page 1 of this ${pageCount}-page PDF was scanned.`;
      }

      const rawText = (ocrResult && ocrResult.rawText) || "";
      const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
      const vendor = ocrResult ? guessVendor(lines) : "Unrecognised";
      const category = ocrResult ? guessCategory(`${vendor} ${rawText}`) : "Other";
      const amount = ocrResult && ocrResult.amount != null ? ocrResult.amount : null;
      const date = (ocrResult && ocrResult.date) || new Date().toISOString().slice(0, 10);
      const currency = (ocrResult && ocrResult.currency) || "GBP";

      setDraft({
        vendor,
        date,
        amount: amount != null ? String(amount) : "",
        currency,
        category,
        description: "",
        confidence: ocrError ? "low" : amount != null ? "medium" : "low",
        thumbnail: dataUrl,
        scanNote: ocrError,
      });
    } catch (e) {
      if (e.message === "TIMEOUT") {
        setError("That image took too long to load — try a smaller photo or check your connection.");
      } else if (e.message === "DECODE_FAILED") {
        setError(
          "This browser couldn't decode that image. If it's an iPhone photo, it may be HEIC format — try a screenshot of the receipt instead, or re-save the photo as JPEG first."
        );
      } else if (e.message === "READ_FAILED") {
        setError("Couldn't read that file. Try selecting it again.");
      } else {
        setError(e.message || "Something went wrong reading that receipt.");
      }
    } finally {
      setProcessing(false);
      setTimeout(() => setPreviewUrl(null), 400);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const openManualEntry = () => {
    setError(null);
    setDraft(emptyDraft());
  };

  const saveDraft = async () => {
    if (!draft) return;
    const amount = parseFloat(draft.amount);
    if (!draft.vendor.trim()) {
      setError("Enter a vendor name before saving.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount before saving.");
      return;
    }
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      vendor: draft.vendor.trim(),
      date: draft.date || new Date().toISOString().slice(0, 10),
      amount,
      currency: draft.currency || "GBP",
      category: CATEGORIES.some((c) => c.name === draft.category) ? draft.category : "Other",
      description: draft.description.trim(),
      confidence: draft.confidence,
      paymentMethod: "Corp Card",
      thumbnail: draft.thumbnail,
      addedAt: new Date().toISOString(),
    };
    const next = [entry, ...expenses];
    setExpenses(next);
    await persist(next);
    setDraft(null);
    setError(null);
  };

  const deleteExpense = async (id) => {
    const next = expenses.filter((x) => x.id !== id);
    setExpenses(next);
    await persist(next);
  };

  const togglePaymentMethod = async (id) => {
    const next = expenses.map((e) =>
      e.id === id ? { ...e, paymentMethod: e.paymentMethod === "Corp Card" ? "Cash / Personal" : "Corp Card" } : e
    );
    setExpenses(next);
    await persist(next);
  };

  const monthLabel = () => {
    const d = new Date();
    return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
  };

  const exportToExcel = () => {
    if (expenses.length === 0) {
      setError("No expenses to export yet.");
      return;
    }
    const rows = [...expenses]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((e) => ({
        Date: e.date,
        Vendor: e.vendor,
        Description: e.description,
        Category: e.category,
        Payment: e.paymentMethod || "Corp Card",
        Amount: e.amount,
        Currency: e.currency,
        Confidence: e.confidence || "",
      }));
    const totalRow = {
      Date: "",
      Vendor: "",
      Description: "",
      Category: "TOTAL",
      Payment: "",
      Amount: expenses.reduce((s, e) => s + e.amount, 0),
      Currency: expenses[0]?.currency || "GBP",
      Confidence: "",
    };
    const ws = XLSX.utils.json_to_sheet([...rows, totalRow]);
    ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    const stamp = new Date().toISOString().slice(0, 7);
    XLSX.writeFile(wb, `mallock-expenses-${stamp}.xlsx`);
  };

  const exportReceiptsForPrint = () => {
    if (expenses.length === 0) {
      setError("No expenses to export yet.");
      return;
    }
    const withImages = [...expenses].filter((e) => e.thumbnail).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (withImages.length === 0) {
      setError("No receipt images to include.");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      setError("Pop-up blocked — allow pop-ups to generate the receipts PDF.");
      return;
    }
    const pages = withImages
      .map(
        (e) => `
        <section style="page-break-after:always;padding:32px;font-family:Arial,sans-serif;">
          <div style="font-size:12px;color:#555;margin-bottom:6px;letter-spacing:0.06em;text-transform:uppercase;">Mallock Automotive — Expense Receipt</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:2px;">${e.vendor}</div>
          <div style="font-size:13px;color:#333;margin-bottom:14px;">${e.date} · ${e.category} · ${e.currency} ${e.amount.toFixed(2)}${e.description ? " · " + e.description : ""}</div>
          <img src="${e.thumbnail}" style="max-width:100%;max-height:80vh;display:block;border:1px solid #ddd;" />
        </section>`
      )
      .join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Mallock Receipts — ${monthLabel()}</title></head><body style="margin:0;">${pages}</body></html>`);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  };

  const filtered = expenses
    .filter((e) => filter === "All" || e.category === filter)
    .filter((e) => (e.paymentMethod || "Corp Card") === paymentFilter);
  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const currency = expenses[0]?.currency || "GBP";

  const totalsByCategory = CATEGORIES.map((c) => ({
    ...c,
    total: expenses.filter((e) => e.category === c.name).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);
  const grandTotal = totalsByCategory.reduce((s, c) => s + c.total, 0) || 1;

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #2A2A2E; border-radius: 4px; }
        @keyframes scanline {
          0% { top: 0%; opacity: 0.9; }
          50% { opacity: 0.4; }
          100% { top: 100%; opacity: 0.9; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .expense-row { animation: fadeUp 0.35s ease; }
        .drop-zone:focus-visible, button:focus-visible {
          outline: 2px solid #C9A961;
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .scan-line { animation: none !important; }
          .expense-row { animation: none !important; }
        }
      `}</style>

      <header style={styles.header}>
        <div>
          <MallockWordmark width={190} />
          <div style={styles.brandSub}>Expense Ledger</div>
        </div>
        <div style={styles.totalBadge}>
          <div style={styles.totalLabel}>{filter === "All" ? "Total logged" : filter}</div>
          <div style={styles.totalValue}>
            {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </header>

      <div
        className="drop-zone"
        tabIndex={0}
        role="button"
        aria-label="Upload a receipt photo or PDF"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        style={styles.dropZone}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
        {processing ? (
          <div style={styles.scanWrap}>
            {previewUrl && <img src={previewUrl} alt="Receipt preview" style={styles.scanImg} />}
            <div className="scan-line" style={styles.scanLine} />
            <div style={styles.scanText}>Reading receipt…</div>
          </div>
        ) : (
          <>
            <div style={styles.dropIcon}>▲</div>
            <div style={styles.dropTitle}>Drop a receipt (photo or PDF), or tap to upload</div>
            <div style={styles.dropSub}>Vendor, date, amount and category are read automatically — you confirm before it's saved</div>
          </>
        )}
      </div>

      <button onClick={openManualEntry} style={styles.manualBtn}>
        + Add expense manually
      </button>

      {error && <div style={styles.errorBox}>{error}</div>}
      {!storageOk && loaded && (
        <div style={styles.warnBox}>
          {storageAvailable
            ? "Saving isn't available right now — entries will only persist for this session."
            : "Persistent saving isn't supported on this surface — entries will only last for this session. Use Export Excel below before closing to keep them."}
        </div>
      )}

      {expenses.length > 0 && (
        <div style={styles.exportRow}>
          <button onClick={exportToExcel} style={styles.exportBtn}>
            ⬇ Export Excel (.xlsx)
          </button>
          <button onClick={exportReceiptsForPrint} style={styles.exportBtnSecondary}>
            🖨 Receipts as PDF
          </button>
        </div>
      )}

      {totalsByCategory.length > 0 && (
        <div style={styles.breakdown}>
          <div style={styles.breakdownTitle}>By category</div>
          <div style={styles.barTrack}>
            {totalsByCategory.map((c) => (
              <div
                key={c.name}
                title={`${c.name}: ${currency} ${c.total.toFixed(2)}`}
                style={{
                  width: `${(c.total / grandTotal) * 100}%`,
                  background: c.color,
                  height: "100%",
                }}
              />
            ))}
          </div>
          <div style={styles.legend}>
            {totalsByCategory
              .sort((a, b) => b.total - a.total)
              .map((c) => (
                <button
                  key={c.name}
                  onClick={() => setFilter(filter === c.name ? "All" : c.name)}
                  style={{
                    ...styles.legendItem,
                    borderColor: filter === c.name ? c.color : "transparent",
                  }}
                >
                  <span style={{ ...styles.dot, background: c.color }} />
                  {c.name}
                  <span style={styles.legendAmt}>
                    {currency} {c.total.toFixed(0)}
                  </span>
                </button>
              ))}
            {filter !== "All" && (
              <button onClick={() => setFilter("All")} style={styles.clearFilter}>
                Clear filter ✕
              </button>
            )}
          </div>
        </div>
      )}

      <div style={styles.paymentFilterRow}>
        {["Corp Card", "Cash / Personal"].map((p) => (
          <button
            key={p}
            onClick={() => setPaymentFilter(p)}
            style={{
              ...styles.paymentFilterBtn,
              ...(paymentFilter === p ? styles.paymentFilterBtnActive : {}),
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div style={styles.list}>
        {loaded && filtered.length === 0 && (
          <div style={styles.empty}>
            {expenses.length === 0
              ? "No expenses logged yet. Upload a receipt to begin."
              : "No expenses in this category."}
          </div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="expense-row" style={styles.card}>
            {e.thumbnail && <img src={e.thumbnail} alt="" style={styles.thumb} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.cardTop}>
                <span style={styles.vendor}>{e.vendor}</span>
                <span style={styles.amount}>
                  {e.currency} {e.amount.toFixed(2)}
                </span>
              </div>
              <div style={styles.cardBottom}>
                <span style={{ ...styles.chip, background: categoryColor(e.category) + "22", color: categoryColor(e.category) }}>
                  {e.category}
                </span>
                <span style={styles.meta}>{e.date}</span>
                {e.description && <span style={styles.meta}>· {e.description}</span>}
                {e.confidence === "low" && <span style={styles.lowConf}>low confidence</span>}
                <button onClick={() => togglePaymentMethod(e.id)} style={styles.paymentChip}>
                  {e.paymentMethod === "Cash / Personal" ? "💳→ Cash / Personal" : "🏢 Corp Card"}
                </button>
              </div>
            </div>
            <button onClick={() => deleteExpense(e.id)} aria-label={`Delete ${e.vendor} expense`} style={styles.deleteBtn}>
              ✕
            </button>
          </div>
        ))}
      </div>

      {draft && (
        <div style={styles.modalBackdrop} onClick={() => setDraft(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>{draft.thumbnail ? "Review scan" : "New expense"}</div>
            {draft.scanNote && <div style={styles.warnBox}>{draft.scanNote}</div>}
            {draft.thumbnail && <img src={draft.thumbnail} alt="Receipt" style={styles.modalThumb} />}

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Vendor</span>
              <input
                style={styles.input}
                value={draft.vendor}
                onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
                placeholder="e.g. Premier Inn"
              />
            </label>

            <div style={styles.fieldRow}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Date</span>
                <input
                  type="date"
                  style={styles.input}
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              <label style={{ ...styles.field, flex: "0 0 90px" }}>
                <span style={styles.fieldLabel}>Currency</span>
                <select
                  style={styles.input}
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Amount</span>
              <input
                type="text"
                inputMode="decimal"
                style={styles.input}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder="0.00"
              />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Category</span>
              <select
                style={styles.input}
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Description (optional)</span>
              <input
                style={styles.input}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="What was this for?"
              />
            </label>

            <div style={styles.modalActions}>
              <button style={styles.exportBtnSecondary} onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button style={styles.exportBtn} onClick={saveDraft}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0A0A0B",
    color: "#F5F5F4",
    fontFamily: "'Inter', sans-serif",
    padding: "16px 16px 40px",
    paddingTop: "calc(20px + env(safe-area-inset-top, 0px))",
    paddingLeft: "calc(16px + env(safe-area-inset-left, 0px))",
    paddingRight: "calc(16px + env(safe-area-inset-right, 0px))",
    maxWidth: 640,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: "1px solid #202024",
  },
  brandSub: { fontSize: 11, color: "#8B8B8F", letterSpacing: "0.04em", marginTop: 5 },
  totalBadge: { textAlign: "right" },
  totalLabel: { fontSize: 10, color: "#8B8B8F", letterSpacing: "0.06em", textTransform: "uppercase" },
  totalValue: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 20,
    fontWeight: 600,
    color: "#C9A961",
  },
  dropZone: {
    border: "1px dashed #33333A",
    borderRadius: 10,
    padding: "28px 16px",
    textAlign: "center",
    cursor: "pointer",
    background: "#111113",
    marginBottom: 10,
    position: "relative",
    overflow: "hidden",
    transition: "border-color 0.2s ease",
  },
  dropIcon: { color: "#C9A961", fontSize: 16, marginBottom: 8 },
  dropTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 500 },
  dropSub: { fontSize: 12, color: "#8B8B8F", marginTop: 4 },
  scanWrap: { position: "relative", height: 120, borderRadius: 8, overflow: "hidden", background: "#000" },
  scanImg: { width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    background: "linear-gradient(90deg, transparent, #C9A961, transparent)",
    animation: "scanline 1.6s ease-in-out infinite",
  },
  scanText: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    fontSize: 11,
    letterSpacing: "0.08em",
    color: "#C9A961",
    fontFamily: "'Space Grotesk', sans-serif",
  },
  manualBtn: {
    width: "100%",
    background: "transparent",
    color: "#C9C9CC",
    border: "1px solid #232327",
    borderRadius: 6,
    padding: "9px 12px",
    fontSize: 12.5,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: "pointer",
    marginBottom: 16,
  },
  errorBox: {
    background: "#2A1414",
    border: "1px solid #4A2222",
    color: "#E8A0A0",
    fontSize: 12.5,
    padding: "10px 12px",
    borderRadius: 6,
    marginBottom: 16,
  },
  warnBox: {
    background: "#241E10",
    border: "1px solid #4A3B1A",
    color: "#D9B871",
    fontSize: 12,
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
  },
  exportRow: { display: "flex", gap: 8, marginBottom: 16 },
  exportBtn: {
    flex: 1,
    background: "#C9A961",
    color: "#0A0A0B",
    border: "none",
    borderRadius: 6,
    padding: "10px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: "pointer",
  },
  exportBtnSecondary: {
    flex: 1,
    background: "transparent",
    color: "#C9C9CC",
    border: "1px solid #33333A",
    borderRadius: 6,
    padding: "10px 12px",
    fontSize: 12.5,
    fontWeight: 500,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: "pointer",
  },
  paymentFilterRow: { display: "flex", gap: 6, marginBottom: 14 },
  paymentFilterBtn: {
    background: "#141416",
    border: "1px solid #232327",
    color: "#8B8B8F",
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 11.5,
    cursor: "pointer",
  },
  paymentFilterBtnActive: {
    background: "#C9A96122",
    borderColor: "#C9A961",
    color: "#C9A961",
  },
  paymentChip: {
    background: "#1A1A1D",
    border: "1px solid #2A2A2E",
    color: "#A8A8AC",
    borderRadius: 20,
    padding: "2px 8px",
    fontSize: 10.5,
    cursor: "pointer",
    marginLeft: "auto",
  },
  breakdown: { marginBottom: 20 },
  breakdownTitle: { fontSize: 10, color: "#8B8B8F", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 },
  barTrack: { display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "#1A1A1D" },
  legend: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#141416",
    border: "1px solid transparent",
    borderRadius: 20,
    padding: "5px 10px",
    fontSize: 11,
    color: "#C9C9CC",
    cursor: "pointer",
  },
  legendAmt: { color: "#8B8B8F", marginLeft: 2 },
  dot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
  clearFilter: {
    background: "none",
    border: "none",
    color: "#8B8B8F",
    fontSize: 11,
    cursor: "pointer",
    padding: "5px 6px",
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  empty: { color: "#6B6B70", fontSize: 13, textAlign: "center", padding: "24px 0" },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#111113",
    border: "1px solid #1E1E22",
    borderRadius: 8,
    padding: 10,
  },
  thumb: { width: 44, height: 44, borderRadius: 6, objectFit: "cover", flexShrink: 0 },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 8 },
  vendor: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  amount: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: "#F5F5F4", flexShrink: 0 },
  cardBottom: { display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" },
  chip: { fontSize: 10.5, padding: "2px 7px", borderRadius: 20, fontWeight: 500 },
  meta: { fontSize: 11, color: "#8B8B8F" },
  lowConf: { fontSize: 10, color: "#D9B871" },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "#5A5A5E",
    fontSize: 14,
    cursor: "pointer",
    padding: 6,
    flexShrink: 0,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 50,
  },
  modalCard: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "88vh",
    overflowY: "auto",
    background: "#0F0F11",
    borderTop: "1px solid #232327",
    borderRadius: "14px 14px 0 0",
    padding: "18px 16px calc(18px + env(safe-area-inset-bottom))",
  },
  modalTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 12,
  },
  modalThumb: { width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, marginBottom: 14 },
  field: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, flex: 1 },
  fieldRow: { display: "flex", gap: 10 },
  fieldLabel: { fontSize: 11, color: "#8B8B8F" },
  input: {
    background: "#141416",
    border: "1px solid #232327",
    color: "#F5F5F4",
    borderRadius: 6,
    padding: "9px 10px",
    fontSize: 13.5,
    fontFamily: "'Inter', sans-serif",
  },
  modalActions: { display: "flex", gap: 8, marginTop: 6 },
};
