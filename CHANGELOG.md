# Changelog

All notable changes to Pixel Motion are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Per-language localization modules for Russian, English, Polish, Spanish, Turkish, Portuguese, and Indonesian.
- Versioned localStorage schema with automatic migration from legacy project, backup, recovery, challenge, and language keys.
- ESLint and Stylelint quality gates.
- Browser checks for GIF and PNG export, corrupted project imports, keyboard focus, and text contrast.
- Release checklist and accessibility audit documentation.

### Changed

- Split the editor controller into frame, layer, selection, and export controllers.
- Reduced duplicated and obsolete CSS overrides.
- GitHub Pages workflow now installs locked dependencies and runs lint, unit, and browser tests before deployment.

### Fixed

- Existing default layer names now follow language changes.
- Tooltips and dynamic frame/layer labels use the active language.
- Removed a syntax error at the start of the responsive stylesheet.

## [1.0.0] - 2026-06-23

### Added

- Initial Pixel Motion editor with drawing tools, frames, layers, challenges, project recovery, import, and export.
