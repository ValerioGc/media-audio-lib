# Media Audio Lib

Media Audio Lib is an open-source desktop application for managing a library of audio files on Windows and Linux. Add the tracks you care about, edit their tags and cover art, browse them by artist, album or genre, and play them without leaving the app. Everything runs entirely on your own computer, with **no internet connection required** and **no telemetry of any kind**.

![Media Audio Lib app screenshot](docs/screenshot/preview.png)

## Key features

- **A library you decide**: no automatic folder scanning. The library holds only the files you add, one by one or by dropping them on the window. Several libraries can live side by side, switched from the menu next to the library name.
- **Metadata editing**: title, artist, album, year, genre and cover art are edited from the app and written back into the file's tags, not just into the library file. Bulk editing applies the same field to a whole selection at once.
- **List view and preview view**: the list shows columns you can sort, resize, reorder and hide as you please; the previews show the cover art on a grid. The chosen view is remembered between sessions.
- **Browse by artist, album or genre**: the same tracks grouped by whichever of the three you need, each group opening a detail panel of its own.
- **Built-in player**: docked at the bottom of the window and expandable to full page, with seeking, volume, shuffle and repeat-one. The queue is the list in front of you, filters and sorting included.
- **Missing files reported**: a track whose file was moved or deleted is flagged rather than quietly disappearing, and can be checked in bulk.
- **Import and export**: the track list exports to a portable file and imports back elsewhere, with duplicates handled on merge.
- **Appearance you choose**: light, dark or system theme, three interface text sizes, an accent colour of your choosing, an ambient background built on that colour and glass surfaces, each switchable on its own.
- **Bilingual**: interface available in Italian and English.

## Privacy

**Media Audio Lib collects no data, sends no telemetry and requires no internet connection, ever.**

Browsing, editing and playing all happen on your own computer. There is no analytics, no crash reporting, no usage tracking and no cloud sync.

The only things the app stores are your preferences and the library files, kept locally. Your audio files are never copied anywhere: the app reads them and rewrites their tags where they already are.

## Installation

Download the package for your platform from the [Releases](https://github.com/ValerioGc/media-audio-lib/releases) section:

| Platform              | File                                              |
| --------------------- | ------------------------------------------------- |
| Windows               | `MediaAudioLib_x.x.x_windows_x64.exe`             |
| Linux (portable)      | `MediaAudioLib_x.x.x_linux_x64_portable.AppImage` |
| Linux (Debian/Ubuntu) | `MediaAudioLib_x.x.x_linux_x64.deb`               |

> **Windows SmartScreen notice:** the installer is not yet signed with a paid certificate, so SmartScreen may show a warning on first launch. Choose "More info" → "Run anyway" to proceed.

### Linux - AppImage

A self-contained portable binary that runs on any distribution without installation:

```bash
chmod +x MediaAudioLib_x.x.x_linux_x64_portable.AppImage
./MediaAudioLib_x.x.x_linux_x64_portable.AppImage
```

## Supported formats

`MP3` · `FLAC` · `M4A` · `OGG` · `WAV`

Reading and writing tags goes through the same library for every format.

## Current limitations

- On **WAV**, a cover added by the app cannot be removed again: the container does not let the tag chunk shrink. On MP3, the priority format, the full cycle works.
- Tags are re-read only when the library schema changes. A file edited by another program is not noticed until you edit it from the app.

## Contributing or building from source

All technical information (stack, project structure, development commands, testing and the release process) is in [DEVELOPMENT.md](DEVELOPMENT.md).

The work still to be done is tracked in [TODO.md](TODO.md), with the technical detail of each item in [ROADMAP.md](ROADMAP.md).

## Licence

Media Audio Lib is released into the public domain under [The Unlicense](LICENSE). You are free to copy, modify, publish, use, compile, sell or distribute it, in source or binary form, for any purpose, commercial or not, with no conditions attached.
