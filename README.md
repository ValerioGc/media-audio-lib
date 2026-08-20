<div align="center">

<img src="src/assets/logo.svg" alt="" width="88" height="88">

# Media Audio Lib

**Your audio library, on your own computer.**

An open-source desktop application for Windows and Linux that keeps track of the music you
choose, writes tags and cover art straight into the files, and plays it all without leaving
the window.

[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20Linux-0067c0)](#installation)
[![Languages](https://img.shields.io/badge/languages-5-0067c0)](#languages)
[![Licence](https://img.shields.io/badge/licence-Unlicense-0067c0)](LICENSE)
[![Offline](https://img.shields.io/badge/telemetry-none-107c10)](#privacy)

[Installation](#installation) · [Features](#what-it-does) · [Languages](#languages) ·
[Privacy](#privacy) · [Development](DEVELOPMENT.md)

</div>

![Media Audio Lib app screenshot](docs/screenshot/preview.png)

---

## Why it exists

Most music managers start by scanning your disk and deciding for you what belongs in the
library. This one starts empty. You add the files you actually care about, and it keeps
nothing but a list of them — the audio itself never moves.

The second difference is where the edits land. Changing an artist or a cover here rewrites
the **tags inside the file**, not a private database that only this app can read. Open the
same file anywhere else and the change is there.

Everything happens locally. No account, no sync, no connection, no telemetry.

## What it does

### Building the library

Files are added one at a time, by folder, or by dropping them onto the window. Several
libraries can live side by side and you switch between them from the menu next to the
library name. Each one exports to a portable file and imports back elsewhere, duplicates
handled. A track whose file was moved or deleted gets flagged rather than quietly
disappearing, and the whole library can be checked in one pass.

### Editing metadata

Title, artist, album, year, genre and cover art are edited from the app and written back
into the file's tags. Bulk editing applies the same field across a whole selection, and a
new cover can be pushed to every track of the album at once.

### Browsing and playing

The **list view** gives columns you can sort, resize, reorder and hide; the **preview view**
lays the cover art out on a grid. The same tracks regroup by artist, album or genre, each
group opening a detail panel of its own. The player sits at the bottom of the window and
expands to full page, with seeking, volume, shuffle and repeat — and its queue is simply the
list in front of you, filters and sorting included.

### Making it yours

Light, dark or system theme, three interface text sizes, and an accent colour of your
choosing that the interface adapts per theme so it stays readable. On top of that, an
optional ambient background built from that same colour and optional glass surfaces, each
switchable on its own.

## Languages

The interface is fully translated into five languages, switched from
**Settings → General → Language** and applied immediately:

|     | Language |     | Language |
| :-: | -------- | :-: | -------- |
| 🇮🇹  | Italiano | 🇪🇸  | Español  |
| 🇬🇧  | English  | 🇩🇪  | Deutsch  |
| 🇫🇷  | Français |     |          |

The Windows installer speaks the same five and picks the one matching your system locale.

## Supported formats

`MP3` · `FLAC` · `M4A` · `OGG` · `WAV`

Reading and writing tags goes through the same library for every format.

## Installation

Download the package for your platform from the
[Releases](https://github.com/ValerioGc/media-audio-lib/releases) section:

| Platform              | File                                              |
| --------------------- | ------------------------------------------------- |
| Windows               | `MediaAudioLib_x.x.x_windows_x64.exe`             |
| Linux (portable)      | `MediaAudioLib_x.x.x_linux_x64_portable.AppImage` |
| Linux (Debian/Ubuntu) | `MediaAudioLib_x.x.x_linux_x64.deb`               |

> **Windows SmartScreen notice:** the installer is not yet signed with a paid certificate,
> so SmartScreen may show a warning on first launch. Choose "More info" → "Run anyway" to
> proceed.

Distribution through the Microsoft Store and Winget is not available yet, but is planned.

### Linux — AppImage

A self-contained portable binary that runs on any distribution without installation:

```bash
chmod +x MediaAudioLib_x.x.x_linux_x64_portable.AppImage
./MediaAudioLib_x.x.x_linux_x64_portable.AppImage
```

## Privacy

**Media Audio Lib collects no data, sends no telemetry and requires no internet connection,
ever.** There is no analytics, no crash reporting, no usage tracking and no cloud sync.

The only things stored are your preferences and the library files, kept locally. Your audio
files are never copied anywhere: the app reads them and rewrites their tags where they
already are.

## Current limitations

- On **WAV**, a cover added by the app cannot be removed again: the container does not let
  the tag chunk shrink. On MP3, the priority format, the full cycle works.
- Tags are re-read only when the library schema changes. A file edited by another program
  is not noticed until you edit it from the app.

## Contributing or building from source

All technical information — stack, project structure, development commands, testing and the
release process — is in [DEVELOPMENT.md](DEVELOPMENT.md).

## Licence

Media Audio Lib is released into the public domain under [The Unlicense](LICENSE). You are
free to copy, modify, publish, use, compile, sell or distribute it, in source or binary
form, for any purpose, commercial or not, with no conditions attached.
