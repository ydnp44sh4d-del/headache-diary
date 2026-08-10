/* Turns raw OCR text (from the on-device Tesseract pipeline in js/ocr.js)
   into a best-guess vendor name and expense category. Nothing here is
   authoritative — it only prefills the review form the user confirms
   before anything is saved. */

const CATEGORY_KEYWORDS = {
  "Travel": ["airline", "airways", "flight", "train", "rail", "airport", "eurostar"],
  "Meals & Entertainment": ["restaurant", "cafe", "café", "coffee", "bar", "pub", "grill", "bistro", "kitchen", "diner"],
  "Accommodation": ["hotel", "inn", "suites", "lodge", "resort", "motel", "airbnb", "premier inn", "travelodge"],
  "Fuel & Transport": ["fuel", "petrol", "diesel", "shell", " bp ", "esso", "texaco", "parking", "car park", "taxi", "uber", "lyft"],
  "Office & Supplies": ["office", "staples", "stationery", "supplies", "print"],
  "Software & Subscriptions": ["subscription", "software", "saas", "license", "microsoft", "adobe", "google", "apple.com/bill", "aws", "cloud"],
  "Professional Services": ["consulting", "legal", "solicitor", "accountant", "services ltd"],
  "Equipment & Tools": ["tools", "hardware", "equipment", "screwfix", "toolstation"],
};

export function guessCategory(text) {
  const lower = ` ${(text || "").toLowerCase()} `;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "Other";
}

export function guessVendor(lines) {
  for (const raw of (lines || []).slice(0, 6)) {
    const line = raw.trim();
    if (line.length < 3) continue;
    if (/^[\d\s\/\-.,:£$€]+$/.test(line)) continue; // numbers/dates/amounts only
    return line;
  }
  return "Unrecognised";
}
