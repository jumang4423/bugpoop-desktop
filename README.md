# bugpoop-desktop

A tiny desktop pet for macOS. The living-code bug — a soft-bodied caterpillar
that wanders, nibbles, poops and gets angry — now lives directly on your
desktop instead of inside a code editor.

It is **not a window you have to manage**: the pet runs on a transparent,
frameless, click-through overlay that sits on every Space. There is no title
bar, no background rectangle, and no dock icon — only the bug itself and a menu
bar tray icon.

Nothing on your desktop is ever touched. The bug nibbles empty space; no files,
icons, clipboard, or other apps are modified.

## What it does

- **Wanders** — rests, picks a random spot, crawls there with the original soft
  body and its decentralized stepping legs, then rests again.
- **Nibbles** — pauses over an empty spot, chews, then swallows.
- **Poops** — wiggles its rear and drops a 💩 that stays put. Hover the cursor
  over it and it **spins and vanishes**.
- **Gets angry** — when the cursor comes close it shows 💢 and bolts away.

## Running it

```sh
npm install
npm start        # the real pet: transparent, click-through, all Spaces
```

Development builds a normal, resizable window with a visible background so you
can watch the bug without it covering your screen:

```sh
npm run dev
```

The app has no dock icon; it lives in the menu bar. Use the tray menu to
**Mute** the chewing sounds, **Reset pet**, or **Quit**.

Other scripts:

```sh
npm run typecheck
npm test
npm run build
```

## How it works

The creature is the **original bug code** from
[text.management](https://github.com/mindofmatthew/text.management), written by
jumang4423, copied verbatim into `src/bug/`:

```
src/bug/body.ts        the soft body and its reflex legs
src/bug/brain.ts       rest / roam / forage / chew / toilet / flee state machine
src/bug/renderer.ts    the low-resolution, nearest-neighbour pixel renderer
src/bug/world.ts       chewing, digestion, droppings, cursor contact
src/bug/math.ts        vector + seeded-random helpers
src/bug/spring.ts      damped-spring helper used by the renderer
```

Only the editor is replaced. `src/adapters/desktopHabitat.ts` implements the
same `HabitatAdapter` interface the CodeMirror habitat did, but on a screen
instead of a document: it hands the bug a few invisible bite sites on the
desktop, and `eat()` simply removes one of them — it edits nothing.

```
electron/main.ts       transparent, click-through, all-Spaces window + tray
electron/preload.ts    cursor / mute / reset bridge
src/main.ts            canvas bootstrap and pointer plumbing
src/adapters/...       the desktop habitat
src/audio.ts           synthesized munch / wiggle / release sounds
```

Because a click-through window cannot receive mouse events on macOS, the main
process polls the global cursor position and streams it to the renderer, so the
pet can still notice — and get angry at — the cursor without ever stealing a
click.

## Credits

- The entire creature implementation (`src/bug/`) is by **jumang4423** and was
  written for [text.management](https://github.com/mindofmatthew/text.management).
- The face and poop artwork (`assets/`) is original work by jumang4423.

## License

[MIT](LICENSE).
