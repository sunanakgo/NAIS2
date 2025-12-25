# NAIS2 - NovelAI Image Studio 2

<p align="center">
  <img src="src-tauri/icons/icon.ico" alt="NAIS2 ロゴ" width="128" height="128">
</p>

<p align="center">
  <b>NovelAI画像生成のための強力なデスクトップアプリケーション</b>
</p>

<p align="center">
  <a href="./README.md">English</a> •
  <a href="./README.ko.md">한국어</a> •
  <a href="./README.ja.md">日本語</a>
</p>

---

## 📖 概要

**NAIS2 (NovelAI Image Studio 2)** は、TauriとReactで構築された機能豊富なデスクトップアプリケーションで、NovelAI APIを使用したAI画像生成のための直感的なインターフェースを提供します。

---

## ✨ 機能

### 🎨 メインモード - 画像生成
- **テキストから画像生成**: ストリーミングプレビュー対応
- **高度なパラメータ**: モデル、解像度、ステップ、CFG、サンプラー、SMEA
- **Vibe Transfer** & **キャラクターリファレンス (Director Tools)**
- **シードコントロール** & **メタデータ管理**

### 🎬 シーンモード - バッチ生成
- **シーンカード**: ドラッグ＆ドロップで並び替え
- **シーン別設定** & **キューシステム** (1-99)
- **シーンプリセット** & **一括エクスポート** (JSON/ZIP)

### 🛠️ スマートツール
| ツール | 説明 |
|--------|------|
| **Image to Image** | AIで画像を変換 |
| **インペインティング** | 画像の特定領域を選択的に編集 |
| **背景除去** | 画像の背景を除去 |
| **モザイク効果** | モザイク/ブラー効果を適用 |
| **タグ分析** | 画像タグを抽出 |
| **4Kアップスケール** | 4倍解像度アップスケール |

### 📚 追加機能
- **ライブラリ**: メタデータビューア付き画像ギャラリー
- **フラグメントプロンプト**: プロンプトスニペットの保存と再利用
- **多言語対応**: English, 한국어, 日本語
- **ウェブビュー**: 内蔵NovelAIブラウザ

---

## 📥 インストール

### ダウンロード
[Releases](../../releases)からダウンロードしてください。

#### macOS注意
**「NAIS2は壊れているため開けません」** エラーが表示された場合、ターミナルで以下のコマンドを実行してください：
```bash
xattr -cr /Applications/NAIS2.app
```

### ソースからビルド
```bash
git clone https://github.com/sunanakgo/NAIS2.git
cd NAIS2
npm install
npm run tauri dev      # 開発モード
npm run tauri build    # プロダクションビルド
```

---

## 🚀 使用方法

1. NAIS2を起動
2. **設定** → **API** → NovelAIトークンを入力 (`pst-...`)
3. **確認**をクリック
4. 画像生成開始！

---

## 🛠️ 技術スタック

| 技術 | 用途 |
|------|------|
| **Tauri 2.0** | デスクトップフレームワーク |
| **React 18** | フロントエンドUI |
| **TypeScript** | 型安全性 |
| **TailwindCSS** | スタイリング |
| **Zustand** | 状態管理 |
| **i18next** | 国際化 |

---

## 📁 プロジェクト構成

```
NAIS2/
├── src/                    # フロントエンド
│   ├── components/         # Reactコンポーネント
│   ├── pages/              # メインページ
│   ├── stores/             # 状態ストア
│   └── i18n/               # 翻訳
└── src-tauri/              # Rustバックエンド
```

---

## 🔑 APIトークン

NovelAIトークンはローカルにのみ保存され、第三者と共有されることはありません。

---

<p align="center">NovelAIコミュニティのために ❤️ で作成</p>
