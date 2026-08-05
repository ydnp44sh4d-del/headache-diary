/* Builds an audit-ready .xlsx via a vendored, self-hosted ExcelJS build
   (web/vendor/exceljs/) — no CDN dependency — with each expense's receipt
   image embedded inline in its row, then triggers a browser download with
   an auto-dated filename. */
const MallockExport = (() => {
  const EXCELJS_PATH = "vendor/exceljs/exceljs.min.js";
  let loadPromise = null;

  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = EXCELJS_PATH;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Couldn't load the export engine."));
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function imageExtensionFor(blob) {
    if (blob.type === "image/png") return "png";
    return "jpeg";
  }

  function loadImageSize(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 200, height: 260 });
      };
      img.src = url;
    });
  }

  function scaledSize(size, maxWidth = 200, maxHeight = 260) {
    const scale = Math.min(maxWidth / size.width, maxHeight / size.height);
    return { width: size.width * scale, height: size.height * scale };
  }

  function fileDateStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function download(buffer, fileName) {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function exportExpenses(expenses, ratesByMonth) {
    await loadExcelJS();

    const workbook = new window.ExcelJS.Workbook();
    workbook.creator = "Mallock Expense Tracker";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Expenses");
    sheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Description", key: "description", width: 32 },
      { header: "Category", key: "category", width: 18 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "GBP Equivalent", key: "gbp", width: 16 },
      { header: "Receipt", key: "receipt", width: 28 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFC9A24B" } };
    headerRow.height = 20;

    for (const expense of expenses) {
      const gbp = MallockFX.gbpValue(expense, ratesByMonth);
      const row = sheet.addRow({
        date: expense.date,
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        currency: expense.currency,
        gbp: gbp === null ? "MISSING RATE" : Number(gbp.toFixed(2)),
        receipt: "",
      });

      if (expense.receiptImageBlob) {
        const base64 = await blobToBase64(expense.receiptImageBlob);
        const naturalSize = await loadImageSize(expense.receiptImageBlob);
        const size = scaledSize(naturalSize);
        const imageId = workbook.addImage({
          base64,
          extension: imageExtensionFor(expense.receiptImageBlob),
        });
        sheet.addImage(imageId, {
          tl: { col: 6, row: row.number - 1 },
          ext: { width: size.width, height: size.height },
        });
        row.height = Math.max(20, size.height * 0.75 + 6);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    download(buffer, `Mallock-Expenses-${fileDateStamp()}.xlsx`);
  }

  return { exportExpenses };
})();
