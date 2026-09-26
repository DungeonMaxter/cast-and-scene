# Changelog

## 1.1.0 - Spotlight, Quick Variants and Variant Transitions

### Quick Variants
- Character Pool entries can keep any number of image variants.
- Each character copy inside a Scene Preset can expose up to six selected Quick Variants.
- Main can be selected as a Quick Variant alongside alternate images.
- Scene Preset Variant picker combines active-image selection with Quick Variant selection.
- Quick Access displays the six fixed slots in a compact 2x3 layout with thumbnails, tooltips and active-state highlighting.

### Variant transitions
- Per-character Variant Transition setting in Scene Presets.
- Available transitions: Instant, Flip, Dissolve, Blur and Flash.
- Quick Access variant changes use the transition configured for that Scene Preset character.

### Spotlight
- New Spotlight control in Quick Access.
- Spotlight temporarily emphasizes one visible character while dimming and slightly receding the others.
- Clicking the active character again restores the normal presentation.
- Spotlight changes do not modify saved Scene Preset position, scale or layer data.

### Interface and usability
- Quick Access portrait controls moved into a compact toolbar below each portrait.
- Director and Quick Access improved for Foundry light and dark interface themes.
- Responsive Scene Preset cards, footer controls and performance information refined for smaller viewports.
- Character Variant editor supports internal scrolling, resizing, remembered size and improved Add Variant focus behavior.
- Quick Access scrolling and empty Quick Variant slot contrast refined for both themes.

### Reliability
- Quick Variant selections persist with each Scene Preset character copy.
- Variant transitions, Spotlight, Silhouette and Camera Focus remain compatible with shared Stage synchronization.
- Existing Character Pool and Scene Preset data remain compatible with the 1.1 data model.

## 1.0.0 - Initial Public Release

### Core
- Character Pool with reusable portraits and image variants.
- Scene Presets with scene association, portrait positioning, scale, layer order, and camera framing.
- Quick Access palette for live session control.
- System-agnostic architecture for Foundry VTT v14.

### Camera & presentation
- Per-character Zoom Frame with draggable framing and center crosshair.
- Animated Camera Focus with reliable Home View reset.
- Dim, Blur, and Focus background effects with multiple intensity levels.
- Fixed-size name labels rendered above portrait layers.
- Show/Hide All and Show/Hide Names controls.
- Silhouette state with a soft reveal transition.

### Scene lifecycle & multiplayer
- Shared Stage state synchronized through Foundry world settings.
- GM scene preview does not alter the presentation seen by players.
- Activating a new Foundry Scene clears the shared Stage for all users while preserving saved Character Pool and Scene Preset data.
- Camera framing and reset synchronized between GM and players.

### UX & reliability
- First-run Welcome and guided tutorial.
- Context menus for Character Pool, Scene Presets, preset characters, and Quick Access.
- Performance Monitor with per-image indicators, preset estimates, and optimization guidance.
- Versioned data schema and migration framework for future compatibility.
- Automatic migration from the pre-release `foundry-visual-novel` namespace.
- Targeted safe-area observers for improved runtime performance.

### Known issue
- **Responsive Portrait Spacing:** different viewport sizes and aspect ratios can change the apparent spacing between portraits. Camera Focus remains normalized and functional. Further Stage-composition improvements are planned for investigation after 1.0.
