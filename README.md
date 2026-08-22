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
handled, and the track list on its own exports to text or CSV.

Opening a library reads its files again in the background: tags edited by another program
arrive on their own, and a track whose file was moved or deleted is flagged rather than
quietly disappearing. The same check runs on demand, and a duplicate finder gathers the
songs held in more than one file, matched by title and artist or by file name.

### Editing metadata

Title, artist, album, year, genre and cover art are edited from the app and written back
into the file's tags. Bulk editing applies the same field across a whole selection, and a
new cover can be pushed to every track of the album at once.

### Browsing and playing

The **list view** gives columns you can sort, resize, reorder and hide; the **preview view**
lays the cover art out on a grid, with a sort control of its own. The same tracks regroup by
artist, album or genre, and each group opens a panel that can be walked through: from an
album to its artist, from that artist to their albums, without going back to the library.

The player sits at the bottom of the window and expands to full page, with seeking, volume,
mute, shuffle and repeat — and its queue is simply the list in front of you, filters and
sorting included. In the full view the artist, the album and the genre are links to
everything else connected to them, ready to be played from there.

### Staying out of the way

The window can be sent to the system tray and keep playing. With a track on, a small
**floating player** takes its place on screen: cover, title and controls in a window you drag
where you like, laid out horizontally or vertically and kept above the others if you want it
there. From the tray icon the window comes back, or the playback stops, or the app quits.

The app can start with the system, minimized in the tray, and be told to stay there when the
window is closed instead of quitting.

### Making it yours

Light, dark or system theme, four interface text sizes, and an accent colour of your
choosing that the interface adapts per theme so it stays readable. On top of that, an
optional ambient background built from that same colour — its shape and its origin are
yours — optional glass surfaces, and a player that takes its colours from the cover of what
is playing.

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

## Contributing or building from source

All technical information — stack, project structure, development commands, testing and the
release process — is in [DEVELOPMENT.md](DEVELOPMENT.md).

## Licence

Media Audio Lib is released into the public domain under [The Unlicense](LICENSE). You are
free to copy, modify, publish, use, compile, sell or distribute it, in source or binary
form, for any purpose, commercial or not, with no conditions attached.
