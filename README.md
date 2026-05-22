# MineFun Paint Tool

A professional, full‑featured paint overlay for `minefun.io`. Draw, add shapes, edit images, save projects – all while playing. Press `Alt+Z` to open the panel.

---

## Overview

MineFun Paint Tool is a Tampermonkey userscript that adds a draggable, neon‑themed drawing panel on top of the minefun.io game. It includes a complete set of drawing tools, image loading, undo/redo, project saving, and export options – all without external libraries.

---

## Features

### Drawing Tools

- Brush with smooth quadratic‑curve strokes
- Eraser (works with brush and all shape tools)
- Shapes: Line, Rectangle, Square, Circle, Triangle, Pentagon, Hexagon
- Colour picker (eyedropper) – select any colour from the screen

### Colour & Style

- Custom colour picker
- Linear gradient with two customisable colours (toggle with `G`)
- Brush size: 1–100 pixels
- Opacity slider for new strokes (0–100%, existing strokes unchanged)
- Four brush textures: Solid, Spray, Calligraphy, Glow

### Image Management

- Load any image (PNG, JPG, etc.) from your computer
- Drag the loaded image while painting (toggle ON/OFF)
- Export the combined drawing + image as PNG or JPG
- Adjustable JPG quality (10–100%)

### Project System

- Save current project to browser localStorage
- Load a saved project from localStorage
- Export project as JSON file
- Import JSON project file

### Undo / Redo

- 30‑step undo/redo stack
- Works for brush, eraser, and all shape tools
- Shortcuts: `Ctrl+Z` (undo), `Ctrl+Y` (redo)

### User Interface

- Neon‑style panel, draggable and resizable
- Tabbed layout: Draw, Image, Info
- Status bar showing current tool, size, and colour
- In‑panel toast notifications (no browser alerts)
- Live shape preview with dimension tooltip (square shows correct side length)

### Compatibility

- Drawing persists when resizing the browser window
- Works on `minefun.io` and its subdomains
- No external libraries – pure vanilla JavaScript

---

## Installation

1. Install the **Tampermonkey** browser extension (Chrome, Firefox, Edge, or any Chromium‑based browser).
2. Create a new userscript (`+` icon in Tampermonkey dashboard) and delete the default template.
3. Copy the entire code from the provided `MineFun_Paint_Tool.user.js` file.
4. Paste the code into the editor and save (`Ctrl+S`).
5. Visit `minefun.io` and press `Alt+Z` to open the paint panel.

---

## Usage

1. **Enable drawing:** Click the `PAINT OFF` button at the top of the panel – it turns to `PAINT ON`.
2. **Select a tool:** Click any tool button in the Tools grid or use the keyboard shortcuts.
3. **Customise:** Pick a colour, adjust size, opacity, texture, or enable gradient.
4. **Draw directly** on the game screen.
5. **Load an image (optional):** Switch to the **Image** tab, click `LOAD IMAGE` and select a file. Use `DRAG IMAGE: ON` to move the image.
6. **Save your work:** Use the `SAVE TO LOCAL` button (stores in browser) or `EXPORT JSON` to download a project file. To save only the image, use `EXPORT PNG` or `EXPORT JPG`.
7. **Undo / Redo** via buttons or `Ctrl+Z` / `Ctrl+Y`.

The panel can be dragged by its header and resized from the bottom‑right corner.

---

## Keyboard Shortcuts

| Shortcut          | Action                     |
|-------------------|----------------------------|
| `Alt+Z`           | Toggle panel               |
| `B`               | Brush                      |
| `E`               | Eraser                     |
| `L`               | Line                       |
| `R`               | Rectangle                  |
| `S`               | Square                     |
| `C`               | Circle                     |
| `T`               | Triangle                   |
| `P`               | Pentagon                   |
| `H`               | Hexagon                    |
| `I`               | Colour picker (eyedropper) |
| `G`               | Toggle gradient            |
| `Ctrl+Z`          | Undo                       |
| `Ctrl+Y`          | Redo                       |

---

## Technical Notes

- The script creates three stacked full‑screen canvases:
  - **Image layer** (bottom) – holds the loaded image.
  - **Drawing layer** (middle) – stores all brush and shape strokes.
  - **Preview layer** (top) – shows live shape previews.
- All canvases have `pointer-events: none` by default; only the preview canvas receives events when `PAINT ON` is active.
- Undo stack stores `ImageData` snapshots (up to 30 steps). State is saved at the beginning of every stroke (brush, eraser, or shape).
- Gradients for brush strokes use the **first and last point** of the stroke as the gradient bounding box – the gradient does not shift while drawing.
- Spray texture uses solid colour (gradient not supported).
- Square tooltip displays the actual side length, not the raw drag dimensions.
- All messages appear as an in‑panel toast (no `alert()` popups).

---

## Version History

**Version 1.0** – Initial stable release  
- Complete drawing toolset with 10 tools
- Undo/redo, gradients, textures, image/project management
- Resize persistence, shape preview, colour picker

---

## Credits

- **Developer:** Itz_Krishna (also known as Everlasting)
- **Discord Server:** [Join our Discord](https://discord.gg/byXxUkZxag)

---

## License

Personal, non‑commercial use only. Redistribution or modification without proper credit to the original author is not permitted. The script is provided "as is", without any warranty.
