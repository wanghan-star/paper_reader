"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/paper";

export type CodexModel = { id: string; name?: string; image: boolean; isDefault?: boolean };

const MODEL = /^[-a-zA-Z0-9._]{0,100}$/;
// Only values this version understands are taken from storage; anything else falls back to the default.
function storedSettings(): Settings {
  const raw = JSON.parse(localStorage.getItem("zhiye-settings") || "{}"), safe: Settings = { ...DEFAULT_SETTINGS };
  if (typeof raw.codexModel === "string" && raw.codexModel) safe.codexModel = raw.codexModel;
  if (typeof raw.chatModel === "string" && MODEL.test(raw.chatModel)) safe.chatModel = raw.chatModel;
  if (["forest", "sepia", "mist", "night", "custom"].includes(raw.theme)) safe.theme = raw.theme;
  if (typeof raw.background === "string" && /^#[0-9a-f]{6}$/i.test(raw.background)) safe.background = raw.background;
  if (raw.readingMode === "scroll") safe.readingMode = "scroll";
  if ([14, 16, 18, 20, 22, 24].includes(raw.textSize)) safe.textSize = raw.textSize;
  if ([1, 2, 3, 4].includes(raw.readingSpan)) safe.readingSpan = raw.readingSpan;
  for (const k of ["compact", "autoTranslate", "teaching"] as const) if (typeof raw[k] === "boolean") safe[k] = raw[k];
  return safe;
}
const store = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

/** Reading preferences, the Codex connection and its models, and the panel layout. */
export function useSettings(notify: (message: string, error?: boolean) => void) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [models, setModels] = useState<CodexModel[]>([]);
  const [codexReady, setCodexReady] = useState<boolean | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(false), [assistantWidth, setAssistantWidth] = useState(400);

  useEffect(() => {
    try {
      const safe = storedSettings();
      setSettings(safe); store("zhiye-settings", safe); sessionStorage.removeItem("zhiye-key");
      const layout = JSON.parse(localStorage.getItem("zhiye-layout") || "{}");
      if (layout.nav === true) setNavCollapsed(true);
      if (Number.isFinite(layout.width) && layout.width >= 320 && layout.width <= 760) setAssistantWidth(layout.width);
    } catch { /* storage may be unavailable */ }
    const abort = new AbortController();
    fetch("/api/codex/status", { signal: abort.signal })
      .then(async r => { if (!r.ok) throw new Error(); return await r.json() as { available: boolean }; })
      .then(async status => {
        setCodexReady(status.available);
        if (!status.available) return;
        const r = await fetch("/api/codex/models", { signal: abort.signal });
        if (!r.ok) return;
        const data = await r.json() as { models: CodexModel[] };
        setModels(data.models);
        // Recognition sends page images, so the main model must accept them.
        const supported = data.models.filter(m => m.image);
        setSettings(current => {
          if (supported.some(m => m.id === current.codexModel)) return current;
          const model = supported.find(m => m.isDefault) || supported[0];
          if (!model) return current;
          const next = { ...current, codexModel: model.id }; store("zhiye-settings", next); return next;
        });
      })
      .catch(e => { if (e.name !== "AbortError") setCodexReady(ready => ready === true); });
    return () => abort.abort();
  }, []);

  const saveSettings = useCallback((next: Settings, message = "Codex 设置已保存") => {
    setSettings(next);
    if (!store("zhiye-settings", next)) { notify("设置已应用，但浏览器不允许保存。", true); return; }
    notify(message);
  }, [notify]);
  const saveLayout = (nav: boolean, width: number) => store("zhiye-layout", { nav, width });
  const toggleNav = () => { setNavCollapsed(!navCollapsed); saveLayout(!navCollapsed, assistantWidth); };
  const resizeAssistant = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); const handle = e.currentTarget; handle.setPointerCapture(e.pointerId); let width = assistantWidth;
    const move = (event: PointerEvent) => { width = Math.round(Math.max(320, Math.min(760, window.innerWidth - event.clientX))); setAssistantWidth(width); };
    const end = () => {
      handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", end); handle.removeEventListener("pointercancel", end);
      saveLayout(navCollapsed, width);
    };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", end); handle.addEventListener("pointercancel", end);
  };
  const resetAssistantWidth = () => { setAssistantWidth(400); saveLayout(navCollapsed, 400); };

  // Questions may use their own model; recognition and translation keep the one chosen in Codex settings.
  const chatModel = settings.chatModel && (!models.length || models.some(m => m.id === settings.chatModel)) ? settings.chatModel : settings.codexModel;
  const modelFor = (image: boolean) => image && models.some(m => m.id === chatModel && !m.image) ? settings.codexModel : chatModel;

  return { settings, saveSettings, models, codexReady, setCodexReady, chatModel, modelFor, navCollapsed, toggleNav, assistantWidth, resizeAssistant, resetAssistantWidth };
}
export type SettingsState = ReturnType<typeof useSettings>;
