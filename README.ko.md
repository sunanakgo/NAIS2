# NAIS2 - NovelAI Image Studio 2

<p align="center">
  <img src="src-tauri/icons/icon.ico" alt="NAIS2 로고" width="128" height="128">
</p>

<p align="center">
  <b>NovelAI 이미지 생성을 위한 강력한 데스크톱 애플리케이션</b>
</p>

<p align="center">
  <a href="./README.md">English</a> •
  <a href="./README.ko.md">한국어</a> •
  <a href="./README.ja.md">日本語</a>
</p>

---

## 📖 개요

**NAIS2 (NovelAI Image Studio 2)**는 Tauri와 React로 구축된 기능이 풍부한 데스크톱 애플리케이션으로, NovelAI API를 사용한 AI 이미지 생성을 위한 직관적인 인터페이스를 제공합니다.

---

## ✨ 기능

### 🎨 메인 모드 - 이미지 생성
- **텍스트-이미지 생성**: 스트리밍 미리보기 지원
- **고급 파라미터**: 모델, 해상도, 스텝, CFG, 샘플러, SMEA
- **Vibe Transfer** & **캐릭터 레퍼런스 (Director Tools)**
- **시드 컨트롤** & **메타데이터 관리**

### 🎬 씬 모드 - 배치 생성
- **씬 카드**: 드래그 앤 드롭으로 재정렬
- **씬별 설정** & **큐 시스템** (1-99)
- **씬 프리셋** & **일괄 내보내기** (JSON/ZIP)

### 🛠️ 스마트 도구
| 도구 | 설명 |
|------|------|
| **Image to Image** | AI로 이미지 변환 |
| **인페인팅** | 이미지의 특정 영역 선택적 편집 |
| **배경 제거** | 이미지 배경 제거 |
| **모자이크 효과** | 모자이크/블러 효과 적용 |
| **태그 분석** | 이미지 태그 추출 |
| **4K 업스케일** | 4배 해상도 업스케일 |

### 📚 추가 기능
- **라이브러리**: 메타데이터 뷰어가 있는 이미지 갤러리
- **프래그먼트 프롬프트**: 프롬프트 스니펫 저장 및 재사용
- **다국어 지원**: English, 한국어, 日本語
- **웹뷰**: 내장 NovelAI 브라우저

---

## 📥 설치

### 다운로드
[Releases](../../releases)에서 다운로드하세요.

#### macOS 참고
**"NAIS2이(가) 손상되었기 때문에 열 수 없습니다"** 오류가 표시되면, 터미널에서 다음 명령어를 실행하세요:
```bash
xattr -cr /Applications/NAIS2.app
```

### 소스에서 빌드
```bash
git clone https://github.com/sunanakgo/NAIS2.git
cd NAIS2
npm install
npm run tauri dev      # 개발 모드
npm run tauri build    # 프로덕션 빌드
```

---

## 🚀 사용법

1. NAIS2 실행
2. **설정** → **API** → NovelAI 토큰 입력 (`pst-...`)
3. **확인** 클릭
4. 이미지 생성 시작!

---

## 🛠️ 기술 스택

| 기술 | 용도 |
|------|------|
| **Tauri 2.0** | 데스크톱 프레임워크 |
| **React 18** | 프론트엔드 UI |
| **TypeScript** | 타입 안전성 |
| **TailwindCSS** | 스타일링 |
| **Zustand** | 상태 관리 |
| **i18next** | 국제화 |

---

## 📁 프로젝트 구조

```
NAIS2/
├── src/                    # 프론트엔드
│   ├── components/         # React 컴포넌트
│   ├── pages/              # 메인 페이지
│   ├── stores/             # 상태 저장소
│   └── i18n/               # 번역
└── src-tauri/              # Rust 백엔드
```

---

## 🔑 API 토큰

NovelAI 토큰은 로컬에만 저장되며, 제3자와 절대 공유되지 않습니다.

---

<p align="center">NovelAI 커뮤니티를 위해 ❤️로 제작됨</p>
