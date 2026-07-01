# Pixel Motion release checklist

## Before release

- [ ] Confirm the version and update `CHANGELOG.md`.
- [ ] Run `npm ci` from a clean checkout.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run test:browser`.
- [ ] Run `npm run build:pages`.
- [ ] Open `dist/` through the local server and verify the editor loads without console errors.

## Manual editor checks

- [ ] Draw with pencil, eraser, fill, mirror, and shade tools.
- [ ] Add, duplicate, reorder, clear, and delete frames.
- [ ] Add, rename, reorder, hide, and delete layers.
- [ ] Move, resize, rotate, flip, copy, and paste a selection.
- [ ] Verify wheel and touch zoom can reach all canvas corners.
- [ ] Switch through all seven languages and inspect dynamic labels.
- [ ] Restore the latest project after a reload.
- [ ] Open projects created before storage schema v3.

## Import and export

- [ ] Export GIF at 1× and a larger scale.
- [ ] Export PNG and a sprite sheet.
- [ ] Export and re-import a `.pxm` project.
- [ ] Confirm a damaged `.pxm`, invalid JSON, and unsupported image show an error without changing the current project.

## Accessibility

- [ ] Complete the editor’s primary flow with the keyboard.
- [ ] Confirm every control has a visible focus state and an accessible name.
- [ ] Check dialogs keep focus inside and return focus to their opener.
- [ ] Check text contrast and the interface at 200% browser zoom.
- [ ] Check `prefers-reduced-motion`.

## Publish

- [ ] Commit only intended source and lockfile changes.
- [ ] Push the release commit and wait for the GitHub Pages workflow.
- [ ] Verify the deployed URL, favicon, assets, import/export, and iframe layout.
- [ ] Create the GitHub release and copy the matching changelog section.
