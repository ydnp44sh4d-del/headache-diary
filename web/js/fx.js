/* Currencies, categories, FX conversion and default starting-rate logic. */
const MallockFX = (() => {
  const CURRENCIES = ["GBP", "EUR", "USD", "CHF"];
  const CONVERTIBLE = ["EUR", "USD", "CHF"];
  const CURRENCY_SYMBOLS = { GBP: "£", EUR: "€", USD: "$", CHF: "CHF" };

  const CATEGORIES = [
    "Travel",
    "Accommodation",
    "Meals",
    "Materials",
    "Marketing",
    "Professional Fees",
    "Other",
  ];

  const FALLBACK_STARTING_RATES = { eur: 0.85, usd: 0.79, chf: 0.9 };
  const STARTING_RATES_KEY = "mallock.startingRates";

  function monthKey(dateStr) {
    // dateStr is "YYYY-MM-DD"; the key is just its first 7 characters.
    return dateStr.slice(0, 7);
  }

  function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function getStartingRates() {
    try {
      const raw = localStorage.getItem(STARTING_RATES_KEY);
      if (!raw) return { ...FALLBACK_STARTING_RATES };
      const parsed = JSON.parse(raw);
      return {
        eur: Number(parsed.eur) || FALLBACK_STARTING_RATES.eur,
        usd: Number(parsed.usd) || FALLBACK_STARTING_RATES.usd,
        chf: Number(parsed.chf) || FALLBACK_STARTING_RATES.chf,
      };
    } catch {
      return { ...FALLBACK_STARTING_RATES };
    }
  }

  function setStartingRates(rates) {
    localStorage.setItem(STARTING_RATES_KEY, JSON.stringify(rates));
  }

  /** Builds (without persisting) the FX record a brand-new month should
   * start with, seeded from the closest earlier month that has a rate,
   * falling back to the configured starting rate set. */
  function buildDefaultRateRecord(month, existingRates) {
    const earlier = existingRates
      .filter((r) => r.month < month)
      .sort((a, b) => (a.month < b.month ? 1 : -1));
    const previous = earlier[0];
    const starting = getStartingRates();
    return {
      month,
      eur: previous ? previous.eur : starting.eur,
      usd: previous ? previous.usd : starting.usd,
      chf: previous ? previous.chf : starting.chf,
    };
  }

  function months(existingRates) {
    return existingRates.map((r) => r.month).sort((a, b) => (a < b ? 1 : -1));
  }

  function rateFor(month, currency, ratesByMonth) {
    const record = ratesByMonth[month];
    if (!record) return null;
    const key = currency.toLowerCase();
    const value = record[key];
    return typeof value === "number" && !Number.isNaN(value) ? value : null;
  }

  /** GBP value of an expense, or null if it's a foreign currency with no
   * rate recorded for its month — callers should flag this, not treat it
   * as zero. */
  function gbpValue(expense, ratesByMonth) {
    if (expense.currency === "GBP") return expense.amount;
    const rate = rateFor(monthKey(expense.date), expense.currency, ratesByMonth);
    return rate === null ? null : expense.amount * rate;
  }

  function indexByMonth(rates) {
    const map = {};
    for (const r of rates) map[r.month] = r;
    return map;
  }

  function monthLabel(month) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  return {
    CURRENCIES,
    CONVERTIBLE,
    CURRENCY_SYMBOLS,
    CATEGORIES,
    monthKey,
    currentMonthKey,
    getStartingRates,
    setStartingRates,
    buildDefaultRateRecord,
    months,
    rateFor,
    gbpValue,
    indexByMonth,
    monthLabel,
  };
})();
