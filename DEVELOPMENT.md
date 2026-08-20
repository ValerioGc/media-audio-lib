# Media Audio Lib - Development guide

Technical documentation for anyone developing, testing or releasing Media Audio Lib. For the end-user product description, see [README.md](README.md).

Target platforms are **Windows** (NSIS installer) and **Linux** (AppImage and `.deb`). macOS is not supported.

## Stack

| Area           | Technology                                             |
| -------------- | ------------------------------------------------------ |
| Frontend       | Vue 3 (Composition API, `<script setup>`) + TypeScript |
| Styling        | SCSS, no CSS framework: an in-house design system      |
| Desktop shell  | Tauri 2                                                |
| Backend / core | Rust                                                   |
| Build tool     | Vite                                                   |
| Frontend tests | Vitest + Vue Test Utils                                |
| Backend tests  | Rust's own test harness (`cargo test`)                 |
| Quality        | ESLint, Prettier, Clippy, SonarQube                    |

Key libraries: `lofty` (tags and cover art for MP3, FLAC, M4A, OGG, WAV), `serde`/`serde_json` (library persistence) and `thiserror` on the Rust side; `pinia` (state) and `vue-i18n` (translations) on the frontend. There is no router: the views are few and flat. Preferences are persisted with `tauri-plugin-store`, and playback uses the webview's native `<audio>` fed through Tauri's asset protocol.

## Requirements

- Node.js `22.14.0` (the version used in CI, see `.github/workflows/ci.yml`)
- Rust stable `1.85+`, installed via `rustup`
- **Windows**: MSVC toolchain and WebView2 (both already present on Windows 11)
- **Linux**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `build-essential`, `libssl-dev`
- For `npm run coverage:rust`: `cargo install cargo-llvm-cov` and `rustup component add llvm-tools-preview`, once

## Setup

```bash
npm install
npm run dev       # launches the desktop app in development mode
```

## Commands

| Command                                       | Description                                               |
| --------------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                                 | Full desktop app in development mode (Tauri + Vite)       |
| `npm run dev:web`                             | Frontend only, in a browser, without the Tauri shell      |
| `npm run build`                               | Type check (`vue-tsc`) + production build of the frontend |
| `npm run build:app`                           | Builds the native bundles for the current platform        |
| `npm run test`                                | Frontend test suite (Vitest)                              |
| `npm run test:watch`                          | Frontend test suite in watch mode                         |
| `npm run test:coverage`                       | Frontend tests with coverage, thresholds enforced         |
| `npm run test:rust`                           | Rust test suite (`cargo test`)                            |
| `npm run coverage:rust`                       | Rust coverage in lcov, fails under 80% of functions       |
| `npm run typecheck`                           | `vue-tsc --noEmit`                                        |
| `npm run lint` / `lint:fix`                   | ESLint                                                    |
| `npm run format` / `format:check`             | Prettier                                                  |
| `npm run lint:rust`                           | Clippy with `-D warnings`                                 |
| `npm run format:rust` / `format:rust:check`   | `cargo fmt`                                               |
| `npm run verify`                              | Frontend gate: format + lint + typecheck + coverage       |
| `npm run verify:rust`                         | Rust gate: fmt + clippy + coverage                        |
| `npm run verify:all`                          | Both gates                                                |
| `npm run build:pages`                         | Regenerates the GitHub Pages site in `docs/`              |
| `npm run check:pages`                         | Fails if `docs/` is out of date (used in CI)              |
| `npm run docker:sonar:up` / `:down` / `:logs` | Local SonarQube instance                                  |
| `npm run test:sonar`                          | Generates every report and runs the Sonar analysis        |

`verify` and `verify:rust` are the two gates to clear at the end of a phase: each fails on its own if function coverage drops below 80%.

## Project structure

```
media-audio-lib/
├─ src/                        # Vue 3 frontend
│  ├─ assets/styles/           # SCSS: tokens, themes, mixins, global stylesheet
│  ├─ components/
│  │  ├─ common/               # reusable base components
│  │  ├─ help/                 # in-app guide
│  │  ├─ layout/               # custom window titlebar
│  │  ├─ library/              # list view, previews, groups
│  │  ├─ metadata/             # metadata editor
│  │  ├─ player/               # dock, controls, progress, full page view
│  │  └─ settings/             # settings
│  ├─ composables/             # list virtualisation, drag & drop
│  ├─ config/                  # shared configuration, genres, icons, layout
│  ├─ i18n/                    # vue-i18n instance and locale detection
│  ├─ locales/                 # translation files (it, en)
│  ├─ services/                # preferences, appearance, colour, library commands, audio
│  ├─ stores/                  # Pinia
│  ├─ types/
│  └─ views/
├─ src-tauri/
│  ├─ capabilities/            # Tauri permissions, minimal allowlist
│  ├─ src/
│  │  ├─ commands/             # commands exposed to the frontend
│  │  ├─ library/              # library file persistence
│  │  ├─ metadata/             # tag and cover art reading and writing
│  │  ├─ catalog.rs            # list of libraries and the active one
│  │  ├─ state.rs              # shared library state
│  │  └─ lib.rs, main.rs
│  └─ tauri.conf.json
├─ tests/frontend/             # frontend specs, mirroring src/
├─ docs/                       # generated GitHub Pages site
└─ scripts/                    # build and release helpers
```

Frontend tests live under `tests/frontend/`, mirroring the structure of `src/`. Rust tests live in `#[cfg(test)]` modules inside the files they cover.

## Development rules

These apply to **every** step and are part of the definition of done.

1. **Code quality**: the code must clear SonarQube (no Blocker/Critical issues, no blocking code smells, no duplication).
2. **SCSS**: all styling is SCSS. Nesting and name separation use a **single** `_`:

   ```scss
   // correct
   .library_table {
     &_row { ... }
     &_cover { ... }
   }
   // => .library_table_row, .library_table_cover

   // do NOT use __ or --
   ```

3. **Componentisation**: no monolithic components. Each component has a single responsibility.
4. **Tests**: every step ships tests keeping function coverage at **80%** or better, on both sides.
5. **TypeScript**: strict mode, no implicit `any`.
6. **Errors**: no unjustified `unwrap()` in Rust. Errors are typed, propagated and turned into a message a user can understand.
7. **i18n**: every string a user can see — labels, error messages, tooltips, dialog text — goes through `vue-i18n`. No hardcoded strings in components.
8. **Comments**: code comments are written in English; documentation and the interface are in Italian.

## Style guidelines

The theme follows the modern Windows look (Fluent / Windows 11):

- Layered surfaces with rounded corners and soft shadows.
- One accent colour across every interactive control, chosen by the user and adjusted per theme so it stays readable.
- Short, natural transitions on hover, press and focus.
- Spacing from the token scale (`$space_*`); the horizontal page margin (`$page_gutter`) is shared by the content, the titlebar and the player.
- Surfaces from the `surface_panel` mixin, or `glass_surface` for the content surfaces that follow the glass setting.
- Scrollable regions from the `scroll_area` mixin, with one thin scrollbar in both themes.
- Measurements in `rem`, so the interface follows the text size setting, list row height included.

## Testing and coverage

- **Frontend**: Vitest + jsdom + Vue Test Utils. Thresholds are configured in `vite.config.ts`: 80% for lines, functions and statements, 75% for branches.
- **Backend**: `cargo test` on the `media-audio-lib` crate. Coverage via `cargo llvm-cov`, with `main.rs` and `lib.rs` excluded because they are wiring.
- The list is virtualised, so a row only exists while it is on screen: tests that count rows have to account for the window rather than the whole track list.

## Static analysis (SonarQube)

Configuration lives in `sonar-project.properties`. A local scan needs Docker:

```powershell
npm run docker:sonar:up      # start a local SonarQube instance
npm run docker:sonar:logs    # wait for "SonarQube is operational", then Ctrl+C
# open http://localhost:9000 (admin/admin), change the password, generate a token
$env:SONAR_TOKEN = "..."
npm run test:sonar           # produces every report, then runs the analysis
npm run docker:sonar:down    # stop SonarQube
```

`test:sonar` always regenerates the three reports the configuration points at — frontend coverage, Rust coverage and the Clippy JSON report — before scanning: an analysis run against stale reports says nothing about the code being analysed.

> The `-v "%cd%:/usr/src"` in `test:sonar` is `cmd` syntax, the shell npm uses on Windows. On Linux it has to become `$PWD`.

## GitHub Pages site

The site text for both locales lives in `docs/site-content.json`. The HTML pages under `docs/`, `docs/it/` and `docs/en/` are **generated** by `scripts/build-pages.cjs`; do not edit them by hand. After changing the content:

```bash
npm run build:pages
npm run check:pages   # fails if docs/ is out of date
```

The builder reads the list of languages back from `LOCALES` in `src/types/settings.ts` and fails if the site and the app do not offer the same ones.

Deployment runs through `.github/workflows/pages.yml`, on push to `main` when the relevant paths change, or manually from GitHub → Actions → "GitHub Pages" → _Run workflow_.

## Release process

`.github/workflows/ci.yml` runs only when a `vMAJOR.MINOR.PATCH` tag is pushed, and:

1. **test**: the whole quality chain — Prettier, ESLint, `vue-tsc`, `cargo fmt`, Clippy, both test suites with coverage, `docs/` verification and the frontend build.
2. **verify-release**: checks that the tag is valid semver, that it points at a commit reachable from `main`, that the version matches `package.json`, `tauri.conf.json` and `Cargo.toml`, and that `CHANGELOG.txt` has a section for it.
3. **build-windows / build-linux**: native bundles through `tauri build`.
   - Windows: NSIS installer (`.exe`), Italian and English, install mode `both`.
   - Linux: AppImage (portable, any distribution) and `.deb`. The runner is pinned to `ubuntu-22.04`: the AppImage links against the runner's glibc, and a newer one would refuse to start on older distributions.
4. **create-release**: publishes a GitHub Release with the bundles, their SHA-256 checksums and release notes taken from the changelog.

### Asset naming

| Platform              | Filename                                              |
| --------------------- | ----------------------------------------------------- |
| Windows               | `MediaAudioLib_{version}_windows_x64.exe`             |
| Linux (portable)      | `MediaAudioLib_{version}_linux_x64_portable.AppImage` |
| Linux (Debian/Ubuntu) | `MediaAudioLib_{version}_linux_x64.deb`               |

### Publishing a release

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. All three must match.
2. Add a `## [X.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.txt`.
3. Commit to `main`.
4. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.

`scripts/extract-changelog.cjs <version>` prints the section for one version and is used by both `verify-release` and the release notes.

## Known open points

Deliberate debts rather than oversights. None of them blocks the remaining work.

| Point                                    | State                                                                                                                                                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tauri commands tested through state only | The commands are one-line delegations to `LibraryState`, which the tests cover. Testing across the IPC bridge (`tauri::test::mock_builder`) was tried and dropped: on Windows the test executable cannot find `WebView2Loader.dll`. |
| TypeScript held at 6.x                   | `vue-tsc` 3.3.10 does not support TypeScript 7 (the `./lib/tsc` export was removed).                                                                                                                                                |
| M4A and OGG fixtures missing             | Both formats go through the same `lofty` API as the others, but no generated file proves it: building one by hand needs a complete MP4/Ogg container.                                                                               |
| Cover not removable on WAV               | `lofty` does not shrink the ID3 chunk inside a RIFF container. On MP3, the priority format, the full cycle works and is covered by tests.                                                                                           |
| No tag re-read on demand                 | Tags are re-read only on a schema migration. A file edited by another program goes unnoticed until it is edited from the app.                                                                                                       |
