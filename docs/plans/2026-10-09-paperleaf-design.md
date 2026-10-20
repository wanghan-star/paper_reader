# 知页 implementation design

Goal: Upload PDFs, extract or OCR content, show Chinese then English for each sentence, explain selected text and cropped figures using Alibaba Cloud. Provide a named desktop shortcut with a custom icon and a reliable local launcher.

Architecture: React client in the Sites Vinext starter. PDF.js runs in a browser worker; files remain on the device. A bounded same-origin API route forwards requests to allowlisted Alibaba Cloud HTTPS endpoints without storing keys or content. Keys stay in memory by default; optional sessionStorage is explicit. Non-secret model and endpoint preferences use localStorage. A local production Worker is started by a hidden Windows launcher, which opens the reader in the default browser.

Visual direction: Warm editorial workspace, forest green accents, serif English headings and compact Chinese labels. Desktop has page navigation, bilingual/PDF tabs and a contextual assistant. Mobile panels slide in.

Steps: implement pure text extraction and batching; implement provider validation and translation/OCR/chat; implement PDF rendering, coordinate crop and text selection; implement settings, cancellation, partial translation and Markdown export; style responsive workspace; add clearly marked original sample; verify transformations, mocked API flows, TypeScript and production build; install and verify desktop shortcut; publish private Site as alternate access.
