import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Vendored locally (web/vendor/pdfjs/) so the worker loads offline once
// installed, same reasoning as the vendored Tesseract engine.
pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.mjs";

// Renders a PDF's first page to a JPEG data URL so it can flow through the
// same OCR/thumbnail/review pipeline as a photographed receipt. Only the
// first page is used — receipts and single-invoice PDFs are almost always
// one page.
export async function pdfFirstPageToDataUrl(file, maxDim = 1400) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = maxDim / Math.max(baseViewport.width, baseViewport.height);
  const viewport = page.getViewport({ scale: scale > 0 ? scale : 1 });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.88),
    pageCount: pdf.numPages,
  };
}

export function isPdf(file) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}
