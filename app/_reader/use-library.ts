"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { deleteRecord, fetchPdf, hashBytes, listRecords, readRecord, savePdf, saveRecord, storedMessages, type PaperRecord, type RecordSummary } from "@/lib/records";
import type { GuideState } from "@/lib/guide";
import type { GlossaryEntry } from "@/lib/glossary";
import type { Message } from "./use-chat";
import { cleanTitle, loadPdf, paperTitle, readPages } from "./pdf";
import type { Paper } from "./use-paper";

/**
 * Opening papers (upload, the reading records, the sample) and saving the open one.
 * `onSwitch` stops work for the previous paper; `onShow` hands the restored chat and guides back.
 */
export function useLibrary(paper: Paper, { notify, autoTranslate, translateAll, onSwitch, onShow, messages, guides, glossary }: {
  notify: (message: string, error?: boolean) => void; autoTranslate: boolean; translateAll: () => void;
  onSwitch: () => void; onShow: (record: PaperRecord) => void; messages: Message[]; guides: Record<number, GuideState>; glossary: GlossaryEntry[];
}) {
  const [records, setRecords] = useState<RecordSummary[]>([]), [recordId, setRecordId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved"), [booted, setBooted] = useState(false);
  const [pendingAuto, setPendingAuto] = useState<number | null>(null);
  const { epoch, docRef } = paper, lock = useRef(false);

  const show = (nextDoc: PDFDocumentProxy, id: string | null, record: PaperRecord) => {
    const previous = docRef.current; docRef.current = nextDoc;
    paper.setDoc(nextDoc); setRecordId(id); setSaveState("saved");
    paper.setTitle(cleanTitle(record.title, record.filename)); paper.setFilename(record.filename); paper.setPages(record.pages);
    paper.setPage(Math.max(1, Math.min(record.pages.length, record.page || 1))); paper.setDemo(false); paper.setTab("bilingual");
    onShow(record);
    // Let the current viewer cancel rendering before destroying its document.
    setTimeout(() => void previous?.destroy(), 100);
  };
  /** Run `work` as the only paper switch in flight; a newer switch makes its results stale. */
  const switching = async (work: (version: number) => Promise<void>, fail: (e: Error) => void) => {
    if (lock.current) return;
    lock.current = true; paper.setLoading(true); setPendingAuto(null); onSwitch();
    const version = ++epoch.current;
    try { await work(version); } catch (e) { fail(e as Error); }
    finally { lock.current = false; paper.setLoading(false); }
  };

  const openRecord = (id: string, quiet = false) => switching(async version => {
    const record = await readRecord(id); if (!record) throw new Error("这条阅读记录已不存在。");
    const nextDoc = await loadPdf(await fetchPdf(id));
    if (version !== epoch.current) { void nextDoc.destroy(); return; }
    show(nextDoc, id, record);
    if (!quiet) notify(`已打开《${record.title}》，译文和对话都在。`);
  }, e => { if (!quiet) notify(e.message || "无法打开这条阅读记录。", true); });

  const upload = (file: File) => {
    if (!/\.pdf$/i.test(file.name)) { notify("请选择 PDF 格式的论文。", true); return; }
    if (file.size > 60 * 1024 * 1024) { notify("PDF 超过 60 MB，请压缩后上传。", true); return; }
    let nextDoc: PDFDocumentProxy | null = null;
    return switching(async version => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-")) throw new Error("文件不是有效的 PDF。");
      // Hash before loading: the PDF library takes ownership of the bytes.
      const id = await hashBytes(bytes).catch(() => null);
      const saved = id ? await readRecord(id).catch(() => null) : null;
      nextDoc = await loadPdf(bytes); if (nextDoc.numPages > 350) throw new Error("论文超过 350 页，请分卷上传。");
      if (id) void savePdf(id, file).catch(() => notify("PDF 副本未能保存，本次阅读仍可继续，但下次需要重新上传。", true));
      if (saved && saved.pages.length === nextDoc.numPages) {
        if (version !== epoch.current) { void nextDoc.destroy(); return; }
        show(nextDoc, id, { ...saved, filename: file.name });
        const left = saved.pages.filter(p => p.needsVision || p.sentences.some(v => !v.zh)).length;
        notify(left ? `已恢复上次的译文和对话，还有 ${left} 页未完成，点击“翻译全文”可继续。` : "已恢复上次的译文和对话。");
        return;
      }
      const parsed = await readPages(nextDoc);
      if (version !== epoch.current) { void nextDoc.destroy(); return; }
      show(nextDoc, id, { title: await paperTitle(nextDoc, file.name), filename: file.name, page: 1, pages: parsed, messages: [], guides: {} });
      if (autoTranslate) { setPendingAuto(version); notify(`已导入 ${nextDoc.numPages} 页，正在自动交给 Codex 翻译全文。`); }
      else notify(`已导入 ${nextDoc.numPages} 页论文。${parsed[0].text.length < 35 ? "检测到扫描页，点击翻译会自动识别。" : "点击“翻译当前页”开始中英对照。"}`);
    }, e => {
      if (nextDoc && nextDoc !== docRef.current) void nextDoc.destroy();
      notify(e.name === "PasswordException" ? "这份 PDF 已加密，请解锁后重新上传。" : e.message || "无法读取 PDF，请检查文件是否损坏。", true);
    });
  };

  const removeRecord = async (entry: RecordSummary) => {
    if (!window.confirm(`删除《${entry.title}》的阅读记录？\n译文、对话和保存的 PDF 副本都会被永久删除。`)) return;
    try { await deleteRecord(entry.id); setRecords(prev => prev.filter(r => r.id !== entry.id)); if (entry.id === recordId) setRecordId(null); notify("阅读记录已删除。"); }
    catch (e) { notify((e as Error).message || "删除失败。", true); }
  };

  // Continue with the paper that was open last time; the sample is only for a first visit.
  useEffect(() => {
    let alive = true; const version = epoch.current;
    listRecords()
      .then(async list => { if (!alive) return; setRecords(list); if (list[0] && version === epoch.current) await openRecord(list[0].id, true); })
      .catch(() => { /* the reader still works without the record service */ })
      .finally(() => { if (alive) setBooted(true); });
    loadPdf("/sample.pdf")
      .then(pdf => { if (alive && version === epoch.current) { docRef.current = pdf; paper.setDoc(pdf); } else void pdf.destroy(); })
      .catch(() => { if (alive && version === epoch.current) notify("示例 PDF 加载失败，你仍可以上传自己的论文。", true); });
    return () => { alive = false; void docRef.current?.destroy(); };
    // Runs once on start; later changes come through upload and openRecord.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (pendingAuto === null || paper.loading) return; setPendingAuto(null); if (pendingAuto === epoch.current && autoTranslate) translateAll(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingAuto, paper.loading]);

  // Save shortly after each change.
  const { pages, page, title, filename, isDemo, loading } = paper;
  useEffect(() => {
    if (!recordId || isDemo || loading) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      const done = Object.fromEntries(Object.entries(guides).filter(([, g]) => g.status === "done"));
      saveRecord(recordId, { title, filename, page, pages, messages: storedMessages(messages), guides: done, glossary })
        .then(meta => { setSaveState("saved"); setRecords(prev => [meta, ...prev.filter(r => r.id !== meta.id)]); })
        .catch(() => setSaveState("failed"));
    }, 2000);
    return () => clearTimeout(timer);
  }, [recordId, isDemo, loading, pages, page, title, filename, guides, messages, glossary]);

  return { records, setRecords, recordId, saveState, booted, upload, openRecord, removeRecord };
}
export type Library = ReturnType<typeof useLibrary>;
