# Guide screenshots

The in-app guide (`src/views/HelpView.vue`) shows one optional screenshot per topic, with an
arrow drawn over the picture at the point the topic is about. The arrow is drawn by the app,
on top of the image — nothing has to be painted into the file itself, and no arrow is ever
drawn over the running interface.

Drop the PNG files listed below into this folder. **The guide works without them**: a topic
whose file is missing simply shows no figure, so the screenshots can be added one at a time.

## Files to add

| File            | What to capture                                                       |
| --------------- | --------------------------------------------------------------------- |
| `start.png`     | The library with a few tracks in it, toolbar included                 |
| `import.png`    | The toolbar, with "Add tracks" and "Add folder" visible               |
| `organize.png`  | The toolbar with the search field, and the library menu open          |
| `views.png`     | The right end of the toolbar, with the list/cards switch and the tabs |
| `metadata.png`  | A row of the list with its three-dot menu open                        |
| `player.png`    | The window with the player bar along the bottom                       |
| `dock.png`      | The floating player, on its own                                       |
| `libraries.png` | The library name with the switch icon beside it                       |
| `transfer.png`  | Settings → Library, on the import and export section                  |
| `settings.png`  | The title bar, with the gear that opens the settings                  |

## Rules of thumb

- PNG, captured at 100% scaling, ideally around 1200 px wide; keep every shot to the same
  width so the figures line up down the guide.
- Capture the light theme with the default accent: the picture is shown in both themes and a
  light shot reads better against either.
- Crop to what the topic is about. A full-window shot of a single button leaves the arrow
  pointing at a few pixels.
- No personal data on screen: use a sample library, not a real one.

## Moving an arrow

Each figure is declared in `HELP_TOPIC_FIGURES` (`src/config/help.ts`):

```ts
import: { file: 'import.png', arrow: { x: 22, y: 14, angle: 200 } },
```

`x` and `y` are the point the **tip** lands on, in per cent of the width and the height of
the picture. `angle` is the direction the arrow comes in at, in degrees: `0` points right,
`90` points down, `180` points left, `270` points up. The values shipped here are estimates
made before the screenshots existed — adjust them once the real pictures are in place.

The caption under each figure is `help.topics.<topic>.figure` in the translation files. To
give a figure to a topic that has none, add an entry to `HELP_TOPIC_FIGURES`, the caption to
every locale file, and the picture here.
