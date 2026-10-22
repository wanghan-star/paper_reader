import type { PDFDocumentProxy } from "pdfjs-dist";
import { extractText, type PaperPage } from "@/lib/paper";
import { toReadingParagraphs } from "@/lib/page-content";
import { pageCanvas } from "@/lib/pdf-render";

const assets = { cMapUrl: "/cmaps/", cMapPacked: true, standardFontDataUrl: "/standard_fonts/", wasmUrl: "/wasm/" };

export async function loadPdf(data: Uint8Array | string): Promise<PDFDocumentProxy> {
  const pdf = await import("pdfjs-dist");
  pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdf.getDocument(typeof data === "string" ? { url: data, ...assets } : { data, ...assets }).promise;
}

/** The whole page as the image sent for recognition. */
export async function pageImage(doc: PDFDocumentProxy, index: number) {
  return (await pageCanvas(doc, index)).toDataURL("image/jpeg", .94);
}

/** Text-layer paragraphs for every page; each page still waits for recognition from the page image. */
export async function readPages(doc: PDFDocumentProxy): Promise<PaperPage[]> {
  const pages: PaperPage[] = [];
  for (let index = 1; index <= doc.numPages; index++) {
    const pdfPage = await doc.getPage(index);
    const items = (await pdfPage.getTextContent()).items.filter(item => "str" in item) as Parameters<typeof extractText>[0];
    const text = extractText(items, pdfPage.getViewport({ scale: 1 }).width);
    const sentences = toReadingParagraphs(text);
    pages.push({ text, sentences, heading: sentences.find(s => s.heading && s.en.length > 4)?.en || `第 ${index} 页`, needsVision: true });
  }
  return pages;
}

/** The title from the PDF metadata when it looks real, otherwise the file name. */
export async function paperTitle(doc: PDFDocumentProxy, filename: string) {
  const metadata = await doc.getMetadata().catch(() => null);
  const title = (metadata?.info as { Title?: string } | undefined)?.Title;
  return typeof title === "string" && title.trim() && title.length < 200 && !/untitled|microsoft word/i.test(title) ? title.trim() : filename.replace(/\.pdf$/i, "");
}

/** PDF metadata titles sometimes carry markup such as <sup>2</sup>. */
export const cleanTitle = (title: string, fallback: string) => title.replace(/<\/?[a-z][^>]*>/gi, "").replace(/\s+/g, " ").trim() || fallback;
