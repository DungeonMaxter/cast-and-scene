# Cast & Scene

**Version 1.0.0**  
**Author:** Dungeon Maxter  
**Compatibility:** Foundry Virtual Tabletop v14  
**System:** System agnostic  
**License:** Proprietary - free to use; see `LICENSE`

**Build your cast. Set the scene.**

Cast & Scene is a cinematic Theatre of the Mind toolkit for Foundry VTT. It gives Game Masters a visual stage for narrative scenes without requiring a battlemap: prepare reusable characters, organize scene casts, place portraits on the canvas, direct camera focus, and control the presentation live through Quick Access.

## Highlights

- **Character Pool** for reusable portraits and optional image variants.
- **Scene Presets** for scene casts, positions, scale, layer order, and camera framing.
- **Quick Access** for live portrait control without keeping the Director open.
- **Camera Focus** with per-character Zoom Frames, animated framing, and Home View reset.
- **Background effects** including Dim, Blur, and Focus (Dim + Blur), with multiple intensity levels.
- **Silhouette reveal** for concealed or dramatic character entrances.
- **Independent name layer** that stays readable regardless of portrait scale or overlap.
- **Performance Monitor** with per-image indicators, preset load estimates, and optimization advice.
- **Interactive first-run tutorial** and versioned release notes.

## Installation

Install Cast & Scene through the Foundry VTT package system when available, or manually:

1. Extract the release archive.
2. Copy the `cast-and-scene` folder into your Foundry `Data/modules/` directory.
3. Confirm that `module.json` is directly inside `Data/modules/cast-and-scene/`.
4. Restart Foundry VTT.
5. Enable **Cast & Scene** in your World.

## Basic workflow

1. Create reusable characters in **Character Pool**.
2. Create **Scene Presets** and add characters from the pool.
3. Arrange portraits directly on the Stage and define their Zoom Frames.
4. Associate presets with Foundry Scenes when useful.
5. During play, use **Quick Access** to show or hide portraits, control names and silhouettes, focus the camera, and apply background effects.

## Scene behavior

Previewing another Scene as GM hides the Cast & Scene presentation locally without changing the shared state seen by players. Activating a new Foundry Scene clears the shared Stage so the new Scene starts cleanly. Character Pool and saved Scene Presets remain intact.

## System compatibility

Cast & Scene is designed to be **system agnostic**. Its core functionality operates on Foundry Scenes, module-owned portrait data, and shared module state rather than game-system-specific Actors, Items, rolls, or rules data.

## Legacy pre-release migration

Worlds that used the pre-release `foundry-visual-novel` package can be migrated automatically. Cast & Scene imports the relevant world data into the `cast-and-scene` namespace without deleting the legacy data.

## Public API

```js
CastAndScene.showReleaseNotes();
CastAndScene.startTutorial();
```

A temporary `FoundryVisualNovel` compatibility alias is retained for pre-release macros and tests.

## Known issue

### Responsive Portrait Spacing
Portrait positioning responds to the available viewport. Different window sizes and aspect ratios can therefore change the apparent spacing between characters. Camera Focus remains normalized and functional. Cross-viewport Stage composition is being investigated for a future release.

## Performance note

Performance indicators are estimates. Actual GPU, memory, and network cost depends on image dimensions, browser, display resolution, active Foundry Scene, and client hardware.

## License

Cast & Scene is distributed free of charge under a proprietary license. Use in private, public, streamed, recorded, monetized, and commercial tabletop sessions is permitted. Redistribution, repackaging, sale, or distribution of modified versions requires prior written permission from Dungeon Maxter. See `LICENSE` for the complete terms.

## Independence notice

Cast & Scene is an independent add-on module for Foundry Virtual Tabletop and is not affiliated with or endorsed by Foundry Gaming LLC.
