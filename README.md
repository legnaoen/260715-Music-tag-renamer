# Music Tag Renamer Electron

## 한국어

DJ 라이브러리 정리를 위한 Windows Electron 앱입니다. MP3의 ID3 태그에서 제목(`TIT2`), BPM(`TBPM`), 조성/Key(`TKEY`)를 읽고, 제목을 `{BPM} ({Key}) 제목` 형식으로 안전하게 변경합니다.

### 주요 기능

- 폴더 및 하위 폴더의 MP3 파일 스캔
- 파일 드래그 앤 드롭 지원
- 이전에 열었던 폴더 기억
- BPM/Key 태그 기반 제목 미리보기
- 제목 태그가 없을 때 파일명을 제목 후보로 사용
- `ffmpeg` + `essentia.js` 기반 BPM/Key 자동 분석
- 자동 분석 진행률 및 파일별 상태 표시
- 처리 가능/누락/완료/오류 필터
- ID3 제목 태그만 수정하고 파일명은 변경하지 않음
- Windows 설치 프로그램 생성 지원

### 설치 파일 만들기

```powershell
npm.cmd install
npm.cmd test
npm.cmd run dist
```

빌드 결과는 `dist` 폴더에 생성됩니다.

- 설치 프로그램: `dist/Music Tag Renamer Setup 0.1.2.exe`
- 설치 없이 실행: `dist/win-unpacked/Music Tag Renamer.exe`

### 맥용 설치 파일 만들기 (macOS에서 실행)

맥 타겟 빌드는 반드시 macOS 머신에서 실행해야 합니다.

```bash
git clone https://github.com/legnaoen/260715-Music-tag-renamer.git
cd 260715-Music-tag-renamer
npm install
npm test
npm run dist:mac
```

빌드 결과는 `dist` 폴더에 생성됩니다.

- 설치 파일: `dist/Music Tag Renamer-0.1.2-arm64.dmg` (Apple Silicon 맥 기준, Intel 맥에서 빌드하면 파일명에 arm64가 붙지 않음)

코드 서명 없이 빌드되므로, 처음 실행할 때 "확인되지 않은 개발자" 경고가 뜨면 앱을 우클릭 → 열기로 실행하면 됩니다.

### 개발 실행

```powershell
npm.cmd install
npm.cmd start
```

### 앱 아이콘 변경

앱 아이콘은 `assets/icon.ico`를 사용합니다. 원본 PNG는 `assets/icon.png`에 보관되어 있습니다.

아이콘을 바꾸려면 새 PNG를 만든 뒤 Windows용 `.ico`로 변환하고, `package.json`의 `build.icon` 값이 `assets/icon.ico`를 가리키는지 확인한 다음 `npm.cmd run dist`로 다시 빌드하면 됩니다.

### 라이선스 주의

자동 분석 기능은 `ffmpeg-static`과 `essentia.js`를 사용합니다.

- `essentia.js`: AGPL-3.0
- `ffmpeg-static`: GPL-3.0-or-later

개인용 로컬 도구로 사용하는 것은 괜찮지만, 배포 전에는 포함 라이선스 고지를 확인해야 합니다.

---

## English

A Windows Electron app for organizing DJ music libraries. It reads MP3 ID3 title (`TIT2`), BPM (`TBPM`), and key (`TKEY`) tags, then safely updates the title tag to the `{BPM} ({Key}) Title` format.

### Features

- Scan MP3 files in a folder and its subfolders
- Folder drag-and-drop support
- Remember the last opened folder
- Preview title changes based on BPM/Key tags
- Use the file name as a title candidate when the title tag is missing
- Automatic BPM/Key analysis powered by `ffmpeg` and `essentia.js`
- Real-time analysis progress and per-file status
- Filters for ready/missing/done/error states
- Updates only the ID3 title tag and never renames the actual file
- Windows installer build support

### Build Installer

```powershell
npm.cmd install
npm.cmd test
npm.cmd run dist
```

Build outputs are generated in the `dist` folder.

- Installer: `dist/Music Tag Renamer Setup 0.1.2.exe`
- Portable unpacked app: `dist/win-unpacked/Music Tag Renamer.exe`

### Build macOS Installer (run on macOS)

macOS targets must be built on a Mac.

```bash
git clone https://github.com/legnaoen/260715-Music-tag-renamer.git
cd 260715-Music-tag-renamer
npm install
npm test
npm run dist:mac
```

Build outputs are generated in the `dist` folder.

- Installer: `dist/Music Tag Renamer-0.1.2-arm64.dmg` (on Apple Silicon; no `arm64` suffix when built on an Intel Mac)

The build is unsigned, so on first launch macOS may show an "unidentified developer" warning — right-click the app and choose Open to run it.

### Development

```powershell
npm.cmd install
npm.cmd start
```

### App Icon

The app icon is stored at `assets/icon.ico`. The source PNG is kept at `assets/icon.png`.

To replace the icon, create a new PNG, convert it to a Windows `.ico` file, confirm that `package.json` `build.icon` points to `assets/icon.ico`, then rebuild with `npm.cmd run dist`.

### License Notice

The automatic analysis feature uses `ffmpeg-static` and `essentia.js`.

- `essentia.js`: AGPL-3.0
- `ffmpeg-static`: GPL-3.0-or-later

This is fine for personal local use, but redistribution should include proper license notices.
