# NAIS2 - NovelAI Image Studio 2

<p align="center">
  <img src="src-tauri/icons/icon.ico" alt="NAIS2 Logo" width="128" height="128">
</p>

<p align="center">
  <b>A powerful desktop application for NovelAI image generation</b>
</p>

<p align="center">
  <a href="./README.md">English</a> •
  <a href="./README.ko.md">한국어</a> •
  <a href="./README.ja.md">日本語</a>
</p>

---

## 📖 Overview

**NAIS2 (NovelAI Image Studio 2)** is a feature-rich desktop application built with Tauri and React that provides an intuitive interface for generating AI images using the NovelAI API.

---

## ✨ Features

### 🎨 Main Mode - Image Generation
- **Text-to-Image Generation** with streaming preview
- **Advanced Parameters**: Models, resolution, steps, CFG, samplers, SMEA
- **Vibe Transfer** & **Character Reference (Director Tools)**
- **Seed Control** & **Metadata Management**

### 🎬 Scene Mode - Batch Generation
- **Scene Cards** with drag-and-drop reordering
- **Per-Scene Settings** & **Queue System** (1-99)
- **Scene Presets** & **Batch Export** (JSON/ZIP)

### 🛠️ Smart Tools
| Tool | Description |
|------|-------------|
| **Image to Image** | Transform images with AI |
| **Inpainting** | Selectively edit image areas |
| **Background Removal** | Remove image backgrounds |
| **Mosaic Effect** | Apply mosaic/blur effects |
| **Tag Analysis** | Extract image tags |
| **4K Upscale** | 4x resolution upscale |

### 📚 Additional Features
- **Library**: Image gallery with metadata viewer
- **Fragment Prompts**: Save & reuse prompt snippets
- **Multi-language**: English, 한국어, 日本語
- **WebView**: Embedded NovelAI browser

---

## 📥 Installation

### Download
Download from [Releases](../../releases).

#### macOS Note
If you see **"NAIS2 is damaged and can't be opened"** error, run this command in Terminal:
```bash
xattr -cr /Applications/NAIS2.app
```

### Build from Source
```bash
git clone https://github.com/sunanakgo/NAIS2.git
cd NAIS2
npm install
npm run tauri dev      # Development
npm run tauri build    # Production
```

---

## 🚀 Usage

1. Launch NAIS2
2. Go to **Settings** → **API** → Enter NovelAI token (`pst-...`)
3. Click **Verify**
4. Start generating!

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Tauri 2.0** | Desktop framework |
| **React 18** | Frontend UI |
| **TypeScript** | Type safety |
| **TailwindCSS** | Styling |
| **Zustand** | State management |
| **i18next** | Internationalization |

---

## 📁 Project Structure

```
NAIS2/
├── src/                    # Frontend
│   ├── components/         # React components
│   ├── pages/              # Main pages
│   ├── stores/             # State stores
│   └── i18n/               # Translations
└── src-tauri/              # Rust backend
```

---

## 🔑 API Token

Your NovelAI token is stored locally only and never shared with third parties.

---

<p align="center">Made with ❤️ for the NovelAI community</p>
