# Changelog

## 1.0.0 — Initial Public Release

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
