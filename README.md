# 知页 · Paperleaf

**上传一篇论文，把不懂的地方慢慢读明白。**

知页是运行在电脑本机的 PDF 论文阅读器。通过你已经登录的 Codex，识别英文、翻译为中文、解释选中的文字和图表，并用交互动画与理解检查题辅助学习。

![知页阅读界面](docs/images/reader.png)

## 下载与启动

### Windows：推荐下载便携版

1. 安装 [Node.js](https://nodejs.org/)（22.13 或更新版本，包含 npm；推荐使用当前 LTS）。
2. 安装并登录 [Codex 桌面应用](https://developers.openai.com/codex/app)，或安装 [Codex CLI](https://developers.openai.com/codex/cli)。
3. 到 [Releases 下载页面](https://github.com/wanghan-star/paper_reader/releases/latest) 下载 **paperleaf-reader.zip**，也可以点击 [直接下载便携版](https://github.com/wanghan-star/paper_reader/releases/latest/download/paperleaf-reader.zip)。
4. 完整解压到可写的文件夹，例如 Documents/Paperleaf；双击 **Start-Paperleaf.cmd**。
5. 首次启动会联网安装本应用依赖，等待完成后自动打开浏览器。后续直接双击同一文件即可。

右上角打开 **Codex 设置 → 测试连接 → 保存设置**。模型从本机 Codex 自动读取，点击下拉框选择，不必填写 API Key。没有检测到时，先打开并登录 Codex，再点 **重新检测本机**。

需要桌面图标时，在应用文件夹用 PowerShell 运行：

```powershell
powershell -NoProfile -File .\scripts\install-desktop.ps1
```

以后双击桌面的 **知页 · 论文阅读** 即可。请保留应用文件夹。

### macOS / Linux

同样需要 Node.js 和已登录的 Codex。下载并解压便携版后，在终端进入该目录：

```sh
sh Start-Paperleaf.command
```

macOS 可执行 chmod +x Start-Paperleaf.command 后双击。跨平台检测和启动入口已实现；目前实机验证平台为 **Windows**。

### 从源码运行

也可点击仓库 **Code → Download ZIP** 获取源码，或运行：

```sh
git clone https://github.com/wanghan-star/paper_reader.git
cd paper_reader
npm ci --include=dev --include=optional
npm run build
node scripts/desktop-launch.mjs
```

源码需要构建；Release 便携版已包含页面构建产物。首次下载依赖失败时，检查网络后重新运行启动文件即可。

## 怎么读论文

1. **上传 PDF**：点击上传或拖入文件，支持 60 MB、350 页以内的论文。加密 PDF 先解锁。
2. **自动翻译**：默认上传后自动识别并翻译全文，按句呈现「中文在上、英文在下」。扫描件先进行视觉识别。可在设置中关闭自动翻译，手动翻译当前页或全文。
3. **解释难点**：拖动选中文字，点「解释这段」；句子旁也有提问按钮。打开「PDF 原文 → 框选图表」，拖动圈起图片后提问。
4. **持续追问**：回答显示在右侧助手，文字逐步生成；Enter 发送，Shift+Enter 换行。可以停止回答或翻译。
5. **导出译文**：工具栏下载按钮导出逐句中英对照 Markdown。**刷新页面前请导出**，论文、译文和聊天不会跨刷新保留。

目录、页码及圈选上下文始终对应原始 PDF 页码。双栏提取顺序不理想时，可以使用「视觉识别并翻译此页」。

## 像老师一样讲解

开启助手下方 **动图与理解检查**，提问会返回针对当前概念的讲解、动态示意和一道理解检查题。

![KV Cache 动态讲解](docs/images/teaching.png)

- 支持流程、柱形、曲线和 KV Cache 词元对比。动画可暂停、重播、调速、逐步查看、拖动进度或放大。
- KV Cache 问题先显示标注清楚的即时概念预览，再更新为 Codex 结合论文生成的讲解；其他图示随生成结果出现。
- 选择答案后立即查看正误与解析；也能用自己的话回答，让 Codex 检查理解或继续举例。
- 动画使用预先实现的绘图组件，通过模型生成的数据驱动，减少等待整段演示代码生成的时间。回答速度仍取决于模型、网络和问题长度。

图中数值是教学示意，不是论文的真实实验数据。缓存对比只说明 K/V 投影是否重复计算，注意力仍读取历史上下文。

## 阅读与外观

- **公式排版**：使用 KaTeX 显示数学表达式；生成中的不完整公式会在完整后显示。
- **更多内容**：默认每个阅读页合并 2 页 PDF，可设置 1–4 页；支持紧凑排版。
- **翻页或滑动**：中英对照与 PDF 原文都支持连续阅读，长文按需渲染附近页面。
- **舒适字号**：默认正文 18 px，目录、按钮和设置说明也已增大；阅读设置可选 14–24 px，工具栏支持临时缩放。
- **主题**：森林纸白、暖杏、雾蓝、深夜以及自定义纸张颜色；深色背景会适配文字颜色。

主题、字号、模型和阅读方式保存在当前浏览器，下次打开仍生效。启动示例是原创 Transformer 教学文档，译文预先准备；上传真实 PDF 才执行真实翻译。

## 换电脑如何使用

将便携版复制到目标电脑，安装 Node.js 和 Codex 并登录，再运行该电脑的启动文件。知页会检测 **当前电脑** 的 Codex 安装、登录、可用模型及 Windows 本机代理，不复制原电脑的登录凭证。常用端口被占用时会自动选择空闲端口。

网页调用独立的临时 Codex 会话，不发送到已存在的桌面聊天。只打开网页链接不能访问另一台电脑的 Codex，需要在目标电脑运行本地启动器。

非常规 Codex 安装，可在启动前指定 CLI 路径。例如 Windows：

```powershell
$env:PAPERLEAF_CODEX_PATH = 'D:\Apps\Codex\codex.exe'
node scripts/desktop-launch.mjs
```

## 常见问题

**没有找到 Codex / 没有登录？** 在 Codex 应用中登录，或安装 CLI 并执行 codex login。回到设置点「重新检测本机」和「测试连接」。

**回答失败或一直等待？** 检查 Codex 自身能否回答、账户额度以及网络。知页沿用该机器的 Codex 登录；Windows 启用了本机系统代理时会为 Codex 子进程应用该代理。

**便携版第一次启动很久？** 首次需要下载本机平台的依赖，保持联网。之后直接复用已有依赖和本地服务。

**翻译或公式不准确？** 查看 PDF 原文；扫描图可能模糊，AI 也可能误解术语或图表。重新识别当前页，或缩小选区问更具体的问题。

**改完代码如何更新？** 关闭该应用的本地服务，重新 npm run build，再启动。启动日志位于本机 .sites-runtime 文件夹。

## 数据与额度

PDF 在浏览器本机解析，整个 PDF 原件不上传；识别、翻译、提问所需的文字、截图和上下文会发送给 Codex，使用已登录账户的额度。

服务只监听 127.0.0.1，检查 Host 与 Origin。调用使用只读临时会话，不写入常规 Codex 聊天历史。任务结果在本地内存最多保留 30 分钟；临时截图在处理结束后清理。强制退出或断电可能遗留系统临时文件。应用不读取或向网页传递登录令牌，仓库与便携包不包含登录凭证。

## 开发与验证

React 19 / TypeScript / Vite + Vinext、PDF.js、KaTeX、本地 Node.js 网关、Codex CLI 与 app-server。教学图由受限结构化数据驱动，不注入 AI 生成的可执行 HTML。

```sh
node node_modules/typescript/bin/tsc --noEmit
node --test tests/*.test.mjs
npm run build
npm start
```

npm run dev 只启动前端框架，不包含本地 Codex 网关。完整运行使用桌面启动器或 npm start。当前自动测试、生产构建及浏览器交互检查通过，并已验证真实 Codex 翻译、OCR、图表解释和教学调用。详见 [验证记录](验证记录.md) 与 [完整使用说明](使用说明.md)。
