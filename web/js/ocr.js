/* Client-side receipt OCR using a vendored, self-hosted Tesseract.js build
   (web/vendor/tesseract/) — no CDN dependency, works offline once the app
   shell is installed. Runs text recognition, then applies heuristics to
   guess amount/date/currency/description. Results only ever prefill the
   entry form — nothing here saves anything. */
const MallockOCR = (() => {
  const VENDOR_BASE = "vendor/tesseract/";
  let loadPromise = null;

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${VENDOR_BASE}tesseract.min.js`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Couldn't load the OCR engine. Try again, or enter the details manually below."));
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  function detectCurrency(text) {
    // Symbols first, then currency codes printed as plain text (both are
    // common on receipts, e.g. "TOTAL: EUR 84.50").
    if (text.includes("£")) return "GBP";
    if (text.includes("€")) return "EUR";
    if (text.includes("$")) return "USD";
    if (/\bCHF\b/i.test(text)) return "CHF";
    if (/\bEUR\b/i.test(text)) return "EUR";
    if (/\bUSD\b/i.test(text)) return "USD";
    if (/\bGBP\b/i.test(text)) return "GBP";
    return null;
  }

  function parseReceiptNumber(raw) {
    let cleaned = raw.replace(/\s/g, "");
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      } else {
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (lastComma !== -1) {
      cleaned = cleaned.replace(",", ".");
    }
    const value = parseFloat(cleaned);
    return Number.isFinite(value) ? value : null;
  }

  function detectAmount(lines) {
    const moneyPattern = /(?:[£€$]|CHF)?\s?(\d{1,3}(?:[,.\s]\d{3})*[.,]\d{2})/gi;
    const totalKeywords = ["total", "amount due", "balance due", "grand total", "amount"];

    function amountsIn(line) {
      const values = [];
      let match;
      moneyPattern.lastIndex = 0;
      while ((match = moneyPattern.exec(line)) !== null) {
        const value = parseReceiptNumber(match[1]);
        if (value !== null) values.push(value);
      }
      return values;
    }

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (totalKeywords.some((kw) => lower.includes(kw))) {
        const values = amountsIn(line);
        if (values.length) return Math.max(...values);
      }
    }

    const all = lines.flatMap(amountsIn);
    return all.length ? Math.max(...all) : null;
  }

  const MONTH_NAMES = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  function isPlausible(date) {
    const now = new Date();
    const tenYearsAgo = new Date(now);
    tenYearsAgo.setFullYear(now.getFullYear() - 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return date > tenYearsAgo && date <= tomorrow;
  }

  function detectDate(text) {
    const numericPattern = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
    const isoPattern = /\b(\d{4})-(\d{2})-(\d{2})\b/;
    const namedPattern = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAMES})\\s+(\\d{2,4})\\b`, "i");
    const namedPattern2 = new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{1,2}),?\\s+(\\d{2,4})\\b`, "i");

    let m = text.match(isoPattern);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (isPlausible(d)) return d;
    }

    m = text.match(namedPattern);
    if (m) {
      const monthIdx = MONTH_INDEX[m[2].slice(0, 3).toLowerCase()];
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      const d = new Date(year, monthIdx, Number(m[1]));
      if (isPlausible(d)) return d;
    }

    m = text.match(namedPattern2);
    if (m) {
      const monthIdx = MONTH_INDEX[m[1].slice(0, 3).toLowerCase()];
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      const d = new Date(year, monthIdx, Number(m[2]));
      if (isPlausible(d)) return d;
    }

    m = text.match(numericPattern);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      // Try day/month first (UK convention), then month/day if implausible.
      let candidates;
      if (a > 12) {
        candidates = [[a, b]]; // a can't be a month; must be day/month
      } else if (b > 12) {
        candidates = [[b, a]]; // b can't be a month; must be day/month
      } else {
        candidates = [[a, b], [b, a]]; // ambiguous — try UK day/month, then month/day
      }
      for (const [day, month] of candidates) {
        if (month < 1 || month > 12) continue;
        const d = new Date(year, month - 1, day);
        if (d.getMonth() === month - 1 && isPlausible(d)) return d;
      }
    }

    return null;
  }

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parse(rawText) {
    const lines = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const currency = detectCurrency(rawText);
    const amount = detectAmount(lines);
    const date = detectDate(rawText);
    const description = lines.length ? lines[0] : null;

    return {
      amount,
      date: date ? toISODate(date) : null,
      currency,
      description,
      rawText,
    };
  }

  async function recognizeReceipt(imageFile) {
    await loadTesseract();
    const result = await window.Tesseract.recognize(imageFile, "eng", {
      workerPath: `${VENDOR_BASE}worker.min.js`,
      corePath: `${VENDOR_BASE}tesseract-core-lstm.wasm.js`,
      langPath: `${VENDOR_BASE}lang-data`,
      gzip: true,
    });
    const text = result && result.data ? result.data.text : "";
    if (!text || !text.trim()) {
      const err = new Error("No text was found on the receipt. Try a clearer, well-lit photo, or enter the details manually below.");
      err.isNoText = true;
      throw err;
    }
    return parse(text);
  }

  return { recognizeReceipt, parse };
})();
