# Controls and presentation settings — 1.2.0

## Keyboard and macro controls

In Foundry's Configure Controls window, filter for Cast & Scene. All 114 keybindings start unassigned so they do not interfere with existing controls.

- **Next / Previous:** select a character in the selected Quick Access preset, including hidden characters, wrapping at either end. Selection is local to the GM and does not change the shared presentation.
- **Selected-character actions:** show/hide, Spotlight on/off, silhouette/reveal, Camera Focus on/off and Quick Variants 1–6.
- **Direct-slot actions:** the same ten actions for each character slot 1–10, following the left-to-right order in Quick Access.
- **Show all / Hide all:** show the selected preset's cast or clear the stage. Show All replaces the stage with that cast.

Spotlight and Camera Focus require a visible character. Missing character or variant slots do nothing. Keys operate when Foundry receives the keyboard event.

## Ready-to-use macros

Game Settings → Cast & Scene → **Create control macros** creates a dedicated Macro folder. Choose 14 basic macros (navigation, selected actions and show/hide all) or all 114 controls including direct slots. Repeating the operation skips existing tagged macros and preserves your edits. Nothing is created automatically at startup. All presentation actions require a GM.

Touch Portal may invoke these macros through an existing integration or forward keyboard input to Foundry. Cast & Scene does not provide an OS-global shortcut or a Touch Portal transport.

Use one action per Script macro:

```js
CastAndScene.nextCharacter();
CastAndScene.previousCharacter();
await CastAndScene.controlSelected("toggle");
await CastAndScene.controlSelected("spotlight");
await CastAndScene.controlSelected("silhouette");
await CastAndScene.controlSelected("focus");
await CastAndScene.selectQuickVariant(2);
await CastAndScene.controlSlot(3, "spotlight");
await CastAndScene.selectQuickVariant(2, 3);
await CastAndScene.toggleSlot(26);
await CastAndScene.showQuickAccessCast();
await CastAndScene.hideAll();
```

Slot APIs accept any positive integer, including slots beyond the first ten. Variant slots remain 1–6.

## Quick Access appearance — per browser

- **Quick Access Touch panel:** off by default. Enable it to tap portraits for selection and use larger action buttons beneath the cast. Standard mode keeps its compact icon and variant controls. Keyboard and macro commands work in either mode.
- **Quick Access preset appearance:** named tabs, or squares with linked map thumbnails, numbers or letters. Previews reuse existing Scene thumbnails, preferring the currently viewed linked Scene, with numbered fallbacks for unlinked/missing/failed images. No full map is loaded for these squares.
- **Quick Variant appearance:** mini portraits, numbers 1–6 or letters A–F. Assignments do not change.

The launcher defaults near the vertical center and outside the scene toolbar. Drag it to customize placement; the panel follows the launcher and stays within the viewport. Existing saved positions remain in use.

## Exact coordinates

Scene Preset cards expose editable X/Y percentages. The character editor provides numeric inputs and sliders synchronized with drag preview. Values are clamped to 0–100 and use the existing normalized position data. Changes to visible characters synchronize without changing Camera Focus or Spotlight.

## Preset switching — shared world setting

**Keep previous characters** is the default. **Replace previous characters** removes other presets' portraits when you show a character from a different preset.

Example: A1 and A2 are visible. Selecting B changes nothing. Showing B1 in Replace mode removes A1 and A2. Showing B2 keeps B1. Showing A1 again replaces B's cast. Removed portraits cannot leave stale Spotlight or Camera Focus targets behind. Changing the setting alone does not clear the stage.

Activating a new Foundry Scene resets the live cast, camera and Spotlight in either mode. A GM merely previewing another Scene does not clear the shared stage. Saved presets and the Character Pool remain intact.

## Character names — shared world settings

- **Position:** base or above the portrait's visible upper edge. Transparent padding and contain letterboxing are considered when image pixel access is permitted. This is artwork-bound alignment, not face detection.
- **Zoom behavior:** Attached labels move and scale with the camera. Floating labels follow the projected portrait while preserving readable text size and remaining within the visible stage.
- **Style:** framed, minimal without a box, or outlined text.
- **Text size:** Small 18px (the earlier size), Medium 24px or Large 32px. Attached labels scale with camera zoom; floating labels keep the chosen size.
- **Font:** standard families plus loaded Foundry/world fonts. Add custom fonts through Foundry's font configuration and reload clients as required. Player and Streamer clients must also load those fonts. Cast & Scene does not bundle or fetch additional font files.

Choices apply to players and the OBS/Streamer client. Global Show/Hide Names still applies. Remote images that forbid pixel access fall back to the image content box for above-head alignment.

## Forge and streaming

The module uses the Forge-aware global FilePicker when available. With Monk's Common Display, its presentation remains visible while Hide UI is enabled; local Cast & Scene hiding remains respected. The author confirmed the Forge/OBS Streamer workflow during release testing.

Stage Master compatibility and a separate OBS Utils layer have not been validated or implemented for this release. Different viewport aspect ratios may still affect apparent portrait spacing.
