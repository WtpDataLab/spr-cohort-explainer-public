// Board-ready one-pager export (spec §10.2, approach A: html-to-image -> PNG,
// embedded via jsPDF). Lower infra, good-enough fidelity for v1.

import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { DISCLAIMER } from "./schema";

export async function exportBoardPdf(
  node: HTMLElement,
  meta: { title: string; subtitle: string; shareUrl: string },
): Promise<void> {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });

  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor("#0f172a");
  pdf.text(meta.title, margin, margin + 6);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor("#475569");
  pdf.text(meta.subtitle, margin, margin + 24);

  // Fit the captured image within the remaining area.
  const img = await loadImage(dataUrl);
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2 - 70;
  const ratio = Math.min(availW / img.width, availH / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  pdf.addImage(dataUrl, "PNG", margin, margin + 44, w, h);

  pdf.setFontSize(8);
  pdf.setTextColor("#94a3b8");
  pdf.text(DISCLAIMER, margin, pageH - margin + 8);
  pdf.text(meta.shareUrl, margin, pageH - margin + 20);

  pdf.save("spr-cohort-allocation.pdf");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
