import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "知页 · 把论文读明白",
  description: "一个安静的论文阅读空间。上传 PDF，中英逐句对照，选中文字或圈选图表与 AI 一起理解。使用本机 Codex。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
