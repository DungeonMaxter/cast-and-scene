const MODULE_ID = "cast-and-scene";
const LEGACY_MODULE_ID = "foundry-visual-novel";
const LIBRARY_SETTING = "characterLibrary";
const STATE_SETTING = "stageState";
const TABS_SETTING = "characterTabs";
const SCENE_BINDINGS_SETTING = "sceneBindings";
const POOL_SETTING = "characterPool";
const POOL_MIGRATED_SETTING = "characterPoolMigrated";
const RELEASE_SEEN_SETTING = "releaseSeen";
const RELEASE_NOTICE_DISABLED_SETTING = "releaseNoticeDisabled";
const TUTORIAL_COMPLETED_SETTING = "tutorialCompleted";
const FIRST_RUN_WELCOME_SEEN_SETTING = "firstRunWelcomeSeen";
const FIRST_RUN_BOOTSTRAP_SETTING = "firstRunBootstrap";
const COMMUNITY_CARD_SEEN_SETTING = "communityCardSeen";
const PATREON_URL = "https://www.patreon.com/cw/DungeonMaxter";
const DATA_SCHEMA_VERSION_SETTING = "dataSchemaVersion";
const LEGACY_NAMESPACE_MIGRATED_SETTING = "legacyNamespaceMigrated";
const DATA_SCHEMA_VERSION = 1;
const CURRENT_VERSION = "1.0.0";

const DEFAULT_CHARACTER = {
  id: null,
  characterId: null,
  name: "",
  image: "",
  x: 0.18,
  y: 1,
  scale: 1,
  mirror: false,
  tabId: null,
  variants: [],
  activeVariantId: null,
  focusX: 0.5,
  focusY: 0.28,
  focusZoom: 1.65,
  silhouette: false
};

const DEFAULT_STAGE_STATE = {
  portraits: [],
  dimmed: false,
  dimLevel: 0.58,
  dimFeather: "medium",
  dimMode: "manual",
  backgroundEffect: "dim",
  backgroundIntensity: "medium",
  namesVisible: true,
  camera: { enabled: false, x: 0, y: 0, zoom: 1, targetPortraitId: null, focusX: 0.5, focusY: 0.28, framing: 1.65 }
};

const DEFAULT_TABS = [
  { id: "main", name: "Main Characters" }
];

class VisualNovelStage {
  static resizeObserver = null;
  static safeAreaFrame = null;
  static currentState = null;
  static previewId = "__fvn-preview__";
  static previewDrag = null;
  static previewMoveCallback = null;
  static previewSourceCharacterId = null;
  static locallyHidden = false;

  static setLocalVisibility(visible = true) {
    this.locallyHidden = !visible;
    const stage = this.ensure();
    stage.hidden = this.locallyHidden;
    stage.setAttribute("aria-hidden", this.locallyHidden ? "true" : "false");
    if (!this.locallyHidden) {
      const state = this.normalizeStageState(game.settings.get(MODULE_ID, STATE_SETTING));
      this.renderState(state);
    }
  }

  static syncLocalSceneVisibility() {
    if (!game.user?.isGM) {
      this.setLocalVisibility(true);
      return;
    }
    const viewedSceneId = canvas?.scene?.id ?? null;
    const activeSceneId = game.scenes?.active?.id ?? null;
    this.setLocalVisibility(!viewedSceneId || !activeSceneId || viewedSceneId === activeSceneId);
  }

  static ensure() {
    let stage = document.getElementById("fvn-stage");
    if (stage) return stage;

    stage = document.createElement("section");
    stage.id = "fvn-stage";
    stage.className = "fvn-stage";
    stage.setAttribute("aria-label", "Cast & Scene Stage");
    stage.innerHTML = `
      <div class="fvn-stage__dimmer" aria-hidden="true"></div>
      <div class="fvn-stage__preview-grid" hidden aria-hidden="true">
        <span class="fvn-stage__preview-label"></span>
      </div>
      <div class="fvn-stage__camera-world">
        <div class="fvn-stage__portraits"></div>
        <div class="fvn-stage__names" aria-hidden="true"></div>
      </div>
    `;

    document.body.appendChild(stage);
    stage.hidden = this.locallyHidden;
    stage.setAttribute("aria-hidden", this.locallyHidden ? "true" : "false");
    this.activateSafeAreaTracking();
    this.activatePreviewDragging(stage);
    this.updateSafeArea();
    return stage;
  }

  static scheduleSafeAreaUpdate() {
    if (this.safeAreaFrame !== null) return;
    this.safeAreaFrame = window.requestAnimationFrame(() => {
      this.safeAreaFrame = null;
      this.updateSafeArea();
    });
  }

  static refreshSafeAreaObservers() {
    if (!this.resizeObserver) return;
    this.resizeObserver.disconnect();
    for (const selector of ["#controls", "#scene-controls", "#sidebar", "#hotbar"]) {
      const element = document.querySelector(selector);
      if (element) this.resizeObserver.observe(element);
    }
  }

  static activateSafeAreaTracking() {
    if (this.resizeObserver) return;

    const update = () => this.scheduleSafeAreaUpdate();
    window.addEventListener("resize", update, { passive: true });

    this.resizeObserver = new ResizeObserver(update);
    this.refreshSafeAreaObservers();
  }

  static updateSafeArea() {
    const stage = document.getElementById("fvn-stage");
    if (!stage) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8;

    const visibleRect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        rect.width <= 0 ||
        rect.height <= 0
      ) return null;
      return rect;
    };

    const leftRects = [visibleRect("#controls"), visibleRect("#scene-controls")].filter(Boolean);
    const rightRects = [visibleRect("#sidebar")].filter(Boolean);
    const bottomRects = [visibleRect("#hotbar")].filter(Boolean);

    const leftEdge = leftRects.length
      ? Math.max(...leftRects.map((rect) => rect.right)) + margin
      : margin;

    const rightEdge = rightRects.length
      ? Math.min(...rightRects.map((rect) => rect.left)) - margin
      : viewportWidth - margin;

    const bottomEdge = bottomRects.length
      ? Math.min(...bottomRects.map((rect) => rect.top)) - margin
      : viewportHeight - margin;

    const left = Math.max(margin, Math.min(leftEdge, viewportWidth - margin));
    const right = Math.max(margin, viewportWidth - Math.max(left + 1, rightEdge));
    const top = margin;
    const bottom = Math.max(margin, viewportHeight - Math.max(top + 1, bottomEdge));

    const safeWidth = Math.max(1, viewportWidth - left - right);
    const safeHeight = Math.max(1, viewportHeight - top - bottom);

    stage.style.setProperty("--fvn-safe-left", `${left}px`);
    stage.style.setProperty("--fvn-safe-right", `${right}px`);
    stage.style.setProperty("--fvn-safe-top", `${top}px`);
    stage.style.setProperty("--fvn-safe-bottom", `${bottom}px`);
    stage.style.setProperty("--fvn-safe-width", `${safeWidth}px`);
    stage.style.setProperty("--fvn-safe-height", `${safeHeight}px`);
    document.documentElement.style.setProperty("--fvn-safe-left", `${left}px`);
    document.documentElement.style.setProperty("--fvn-safe-right", `${right}px`);
    document.documentElement.style.setProperty("--fvn-safe-top", `${top}px`);
    document.documentElement.style.setProperty("--fvn-safe-bottom", `${bottom}px`);
    document.documentElement.style.setProperty("--fvn-safe-width", `${safeWidth}px`);
    document.documentElement.style.setProperty("--fvn-safe-height", `${safeHeight}px`);

    // Camera framing is normalized to the local Stage geometry. Re-resolve it
    // whenever the usable viewport changes instead of preserving GM pixels.
    // Use the state currently rendered by FVN instead of re-reading the world
    // setting during DOM mutations. A settings read can briefly be stale while a
    // GM write is in flight (notably during Camera Reset), which previously let
    // the safe-area observer re-apply the old focused Camera transform.
    const currentState = this.currentState
      ? this.normalizeStageState(this.currentState)
      : this.normalizeStageState(game.settings?.get?.(MODULE_ID, STATE_SETTING) ?? {});
    if (currentState.camera?.enabled) requestAnimationFrame(() => this.applyCameraTransform(currentState));
  }

  static normalizeCharacter(payload = {}) {
    const character = { ...DEFAULT_CHARACTER, ...payload };
    if (!Number.isFinite(Number(payload.x))) {
      character.x = ({ left: 0.18, center: 0.5, right: 0.82 })[payload.position] ?? DEFAULT_CHARACTER.x;
    }
    if (!Number.isFinite(Number(payload.y))) character.y = DEFAULT_CHARACTER.y;
    character.x = Math.min(1, Math.max(0, Number(character.x)));
    character.y = Math.min(1, Math.max(0, Number(character.y)));
    character.scale = Math.min(3, Math.max(0.25, Number(character.scale) || 1));
    character.id = character.id ?? character.characterId ?? foundry.utils.randomID();
    character.characterId = character.characterId ?? character.id;
    character.variants = Array.isArray(character.variants)
      ? character.variants.filter((variant) => variant?.name && variant?.image).map((variant) => ({
          id: variant.id ?? foundry.utils.randomID(),
          name: String(variant.name),
          image: String(variant.image)
        }))
      : [];
    if (!character.variants.some((variant) => String(variant.id) === String(character.activeVariantId))) {
      character.activeVariantId = null;
    }
    character.focusX = Math.min(1, Math.max(0, Number(character.focusX) || 0.5));
    character.focusY = Math.min(1, Math.max(0, Number(character.focusY) || 0.28));
    character.focusZoom = Math.min(3.3333, Math.max(0.8, Number(character.focusZoom) || 1.65));
    return character;
  }

  static normalizeStageState(raw = {}) {
    if (Array.isArray(raw?.portraits)) {
      return {
        portraits: raw.portraits.map((portrait) => this.normalizeCharacter(portrait)),
        dimmed: Boolean(raw.dimmed),
        dimLevel: Math.min(0.85, Math.max(0.15, Number(raw.dimLevel) || DEFAULT_STAGE_STATE.dimLevel)),
        dimFeather: ["none", "medium", "large"].includes(raw.dimFeather) ? raw.dimFeather : DEFAULT_STAGE_STATE.dimFeather,
        dimMode: ["manual", "auto", "camera"].includes(raw.dimMode) ? raw.dimMode : "manual",
        backgroundEffect: ["none", "dim", "blur", "focus"].includes(raw.backgroundEffect) ? raw.backgroundEffect : "dim",
        backgroundIntensity: ["small", "medium", "large"].includes(raw.backgroundIntensity) ? raw.backgroundIntensity : (raw.dimFeather === "large" ? "large" : "medium"),
        namesVisible: raw.namesVisible !== false,
        camera: this.normalizeCamera(raw.camera)
      };
    }

    // Migration from versions that stored one visible portrait directly.
    if (raw?.visible && raw?.image) {
      return {
        portraits: [this.normalizeCharacter(raw)],
        dimmed: false,
        dimLevel: DEFAULT_STAGE_STATE.dimLevel,
        dimFeather: DEFAULT_STAGE_STATE.dimFeather,
        dimMode: DEFAULT_STAGE_STATE.dimMode,
        backgroundEffect: DEFAULT_STAGE_STATE.backgroundEffect,
        backgroundIntensity: DEFAULT_STAGE_STATE.backgroundIntensity,
        namesVisible: DEFAULT_STAGE_STATE.namesVisible,
        camera: foundry.utils.deepClone(DEFAULT_STAGE_STATE.camera)
      };
    }

    return foundry.utils.deepClone(DEFAULT_STAGE_STATE);
  }


  static normalizeCamera(raw = {}) {
    return {
      enabled: Boolean(raw?.enabled),
      // x/y/zoom are retained for backward compatibility with pre-RC.2 states.
      x: Math.min(6, Math.max(-6, Number(raw?.x) || 0)),
      y: Math.min(6, Math.max(-6, Number(raw?.y) || 0)),
      zoom: Math.min(6, Math.max(0.75, Number(raw?.zoom) || 1)),
      targetPortraitId: raw?.targetPortraitId ? String(raw.targetPortraitId) : null,
      focusX: Math.min(1, Math.max(0, Number(raw?.focusX) || 0.5)),
      focusY: Math.min(1, Math.max(0, Number(raw?.focusY) || 0.28)),
      framing: Math.min(3.3333, Math.max(0.8, Number(raw?.framing) || 1.65))
    };
  }

  static resolveCameraTransform(state, camera) {
    if (!camera.enabled) return { x: 0, y: 0, zoom: 1 };
    if (!camera.targetPortraitId) return { x: camera.x, y: camera.y, zoom: camera.zoom };

    const stage = this.ensure();
    const stageRect = stage.getBoundingClientRect();
    const portrait = state.portraits.find((entry) => String(entry.id) === String(camera.targetPortraitId));
    const wrap = portrait ? this.getPortraitElement(portrait.id, { create: false }) : null;
    const image = wrap?.querySelector('.fvn-stage__portrait');
    if (!portrait || !image || !stageRect.width || !stageRect.height || !image.offsetWidth || !image.offsetHeight) {
      return { x: camera.x, y: camera.y, zoom: camera.zoom };
    }

    const portraitScale = Math.min(3, Math.max(0.25, Number(portrait.scale) || 1));
    const imageWidth = image.offsetWidth * portraitScale;
    const imageHeight = image.offsetHeight * portraitScale;
    const visualFocusX = portrait.mirror ? 1 - camera.focusX : camera.focusX;
    const pointX = Number(portrait.x) + ((visualFocusX - 0.5) * imageWidth / stageRect.width);
    const pointY = Number(portrait.y) - ((1 - camera.focusY) * imageHeight / stageRect.height);
    const frameWidthRatio = Math.min(1, Math.max(0.24, 0.8 / camera.framing));
    const frameWorldWidth = Math.max(1, imageWidth * frameWidthRatio);
    const zoom = Math.min(6, Math.max(0.75, stageRect.width / frameWorldWidth));
    return {
      x: Math.min(6, Math.max(-6, -(pointX - 0.5) * zoom)),
      y: Math.min(6, Math.max(-6, -(pointY - 0.5) * zoom)),
      zoom
    };
  }

  static applyCameraTransform(state, camera = this.normalizeCamera(state?.camera)) {
    const stage = this.ensure();
    const world = stage.querySelector('.fvn-stage__camera-world');
    if (!world) return;
    const resolved = this.resolveCameraTransform(state, camera);
    world.style.setProperty('--fvn-camera-x', String(camera.enabled ? resolved.x : 0));
    world.style.setProperty('--fvn-camera-y', String(camera.enabled ? resolved.y : 0));
    world.style.setProperty('--fvn-camera-zoom', String(camera.enabled ? resolved.zoom : 1));
    world.style.setProperty('--fvn-camera-duration', '700ms');
  }

  static getPortraitElement(id, { create = true } = {}) {
    const stage = this.ensure();
    const container = stage.querySelector(".fvn-stage__portraits");
    let wrap = container.querySelector(`[data-portrait-id="${CSS.escape(String(id))}"]`);
    if (wrap || !create) return wrap;

    wrap = document.createElement("div");
    wrap.className = "fvn-stage__portrait-wrap";
    wrap.dataset.portraitId = id;
    wrap.innerHTML = `
      <img class="fvn-stage__portrait" alt="" draggable="false" />
      <img class="fvn-stage__silhouette-overlay" alt="" draggable="false" aria-hidden="true" />
      <div class="fvn-stage__drag-hint"><i class="fa-solid fa-up-down-left-right"></i></div>
      <div class="fvn-stage__focus-frame" data-focus-frame aria-label="Zoom Frame">
        <span class="fvn-stage__focus-frame-label">Zoom Frame</span>
        <span class="fvn-stage__focus-cross" aria-hidden="true"><i class="fa-solid fa-crosshairs"></i></span>
        <button type="button" class="fvn-stage__focus-frame-resize" data-focus-frame-resize aria-label="Resize camera frame"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>
      </div>
      <button type="button" class="fvn-stage__scale-handle fvn-stage__scale-handle--nw" data-scale-handle="nw" aria-label="Scale portrait"></button>
      <button type="button" class="fvn-stage__scale-handle fvn-stage__scale-handle--ne" data-scale-handle="ne" aria-label="Scale portrait"></button>
      <button type="button" class="fvn-stage__scale-handle fvn-stage__scale-handle--sw" data-scale-handle="sw" aria-label="Scale portrait"></button>
      <button type="button" class="fvn-stage__scale-handle fvn-stage__scale-handle--se" data-scale-handle="se" aria-label="Scale portrait"></button>
    `;
    container.appendChild(wrap);
    return wrap;
  }

  static renderPortrait(payload = {}, { preview = false } = {}) {
    const character = this.normalizeCharacter(payload);
    const id = preview ? this.previewId : character.id;
    const wrap = this.getPortraitElement(id);
    const portrait = wrap.querySelector(".fvn-stage__portrait");
    const silhouetteOverlay = wrap.querySelector(".fvn-stage__silhouette-overlay");

    if (wrap._fvnRemovalTimeout) clearTimeout(wrap._fvnRemovalTimeout);
    wrap._fvnRemovalTimeout = null;
    wrap.classList.remove("fvn-stage__portrait-wrap--exiting");
    wrap.classList.toggle("fvn-stage__portrait-wrap--preview", preview);
    wrap.style.left = `${character.x * 100}%`;
    wrap.style.top = `${character.y * 100}%`;
    wrap.style.setProperty("--fvn-character-scale", character.scale);
    if (Number.isFinite(Number(character.layer))) wrap.style.zIndex = String(character.layer);
    wrap.dataset.characterId = character.characterId ?? character.id;
    wrap.dataset.mirror = String(Boolean(character.mirror));
    wrap.classList.toggle("fvn-stage__portrait-wrap--silhouette", Boolean(character.silhouette));

    const focusFrame = wrap.querySelector("[data-focus-frame]");
    if (focusFrame) {
      const visualFocusX = character.mirror ? 1 - character.focusX : character.focusX;
      const frameWidth = Math.min(100, Math.max(24, 80 / character.focusZoom));
      const stageRect = this.ensure().getBoundingClientRect();
      const cameraAspect = stageRect.width > 0 && stageRect.height > 0 ? stageRect.width / stageRect.height : (16 / 9);
      focusFrame.style.setProperty("--fvn-camera-aspect", String(cameraAspect));
      focusFrame.style.left = `${visualFocusX * 100}%`;
      focusFrame.style.top = `${character.focusY * 100}%`;
      focusFrame.style.width = `${frameWidth}%`;
    }

    if (character.image) {
      portrait.src = character.image;
      if (silhouetteOverlay) silhouetteOverlay.src = character.image;
    } else {
      portrait.removeAttribute("src");
      silhouetteOverlay?.removeAttribute("src");
    }
    portrait.alt = character.name || game.i18n.localize("FVN.UnknownCharacter");
    portrait.style.transform = `scaleX(${character.mirror ? -1 : 1})`;
    if (silhouetteOverlay) silhouetteOverlay.style.transform = `scaleX(${character.mirror ? -1 : 1})`;

    requestAnimationFrame(() => wrap.classList.add("fvn-stage__portrait-wrap--visible"));
    return wrap;
  }

  static renderNameplate(character, { visible = true } = {}) {
    const stage = this.ensure();
    const layer = stage.querySelector(".fvn-stage__names");
    if (!layer) return;
    const id = String(character.id);
    let label = layer.querySelector(`[data-nameplate-id="${CSS.escape(id)}"]`);
    if (!label) {
      label = document.createElement("div");
      label.className = "fvn-stage__nameplate";
      label.dataset.nameplateId = id;
      layer.appendChild(label);
    }
    label.textContent = character.name || "";
    label.style.left = `${character.x * 100}%`;
    label.style.top = `${character.y * 100}%`;
    label.hidden = !visible || !character.name;
  }

  static renderState(rawState = {}) {
    const state = this.normalizeStageState(rawState);
    // Keep an authoritative local snapshot of what is actually rendered. This
    // prevents observers and resize handlers from resurrecting an older Camera
    // state while game.settings.set is still propagating.
    this.currentState = foundry.utils.deepClone(state);
    const stage = this.ensure();
    stage.hidden = this.locallyHidden;
    stage.setAttribute("aria-hidden", this.locallyHidden ? "true" : "false");
    const container = stage.querySelector(".fvn-stage__portraits");
    const camera = this.normalizeCamera(state.camera);
    const backgroundEnabled = state.dimMode === "auto"
      ? state.portraits.length > 0
      : state.dimMode === "camera"
        ? camera.enabled
        : state.dimmed;
    const backgroundEffect = backgroundEnabled ? state.backgroundEffect : "none";
    stage.classList.toggle("fvn-stage--dimmed", backgroundEffect === "dim" || backgroundEffect === "focus");
    stage.classList.toggle("fvn-stage--blurred", backgroundEffect === "blur" || backgroundEffect === "focus");
    stage.dataset.backgroundEffect = backgroundEffect;
    stage.dataset.backgroundIntensity = state.backgroundIntensity;
    stage.dataset.dimFeather = state.dimFeather;
    const dimLevels = { small: 0.32, medium: 0.5, large: 0.66 };
    const blurLevels = { small: "2px", medium: "5px", large: "10px" };
    stage.style.setProperty("--fvn-dim-level", String(dimLevels[state.backgroundIntensity] ?? state.dimLevel));
    stage.style.setProperty("--fvn-blur-level", blurLevels[state.backgroundIntensity] ?? "5px");
    stage.classList.toggle("fvn-stage--camera-active", camera.enabled);
    stage.classList.toggle("fvn-stage--camera-edit", camera.enabled && Boolean(game.user?.isGM));
    const guide = stage.querySelector(".fvn-stage__camera-guide");
    if (guide) {
      guide.hidden = !(camera.enabled && Boolean(game.user?.isGM));
      guide.querySelector(".fvn-stage__camera-label span").textContent = `${game.i18n.localize("FVN.Camera")} ${Math.round(camera.zoom * 100)}%`;
      guide.querySelector(".fvn-stage__camera-help").textContent = game.i18n.localize("FVN.CameraDragHelp");
    }
    const keep = new Set(state.portraits.map((portrait) => String(portrait.id)));
    const namesLayer = stage.querySelector(".fvn-stage__names");
    if (namesLayer) {
      for (const label of namesLayer.querySelectorAll("[data-nameplate-id]")) {
        if (!keep.has(String(label.dataset.nameplateId))) label.remove();
      }
    }

    for (const wrap of container.querySelectorAll(".fvn-stage__portrait-wrap:not(.fvn-stage__portrait-wrap--preview)")) {
      if (keep.has(String(wrap.dataset.portraitId))) {
        if (wrap._fvnRemovalTimeout) clearTimeout(wrap._fvnRemovalTimeout);
        wrap._fvnRemovalTimeout = null;
        wrap.classList.remove("fvn-stage__portrait-wrap--exiting");
        continue;
      }
      if (wrap.classList.contains("fvn-stage__portrait-wrap--exiting")) continue;
      wrap.classList.add("fvn-stage__portrait-wrap--exiting");
      wrap._fvnRemovalTimeout = window.setTimeout(() => wrap.remove(), 280);
    }

    const total = state.portraits.length;
    state.portraits.forEach((portrait, index) => {
      const rendered = { ...portrait, layer: total - index };
      const wrap = this.renderPortrait(rendered);
      this.renderNameplate(rendered, { visible: state.namesVisible });
      if (camera.enabled && String(camera.targetPortraitId) === String(portrait.id)) {
        const image = wrap?.querySelector('.fvn-stage__portrait');
        if (image && !image.complete) image.addEventListener('load', () => this.applyCameraTransform(state, camera), { once: true });
      }
    });
    this.applyCameraTransform(state, camera);
    if (camera.enabled && camera.targetPortraitId) requestAnimationFrame(() => this.applyCameraTransform(state, camera));
  }

  static showPreview(payload = {}, onMove = null) {
    const stage = this.ensure();
    const previewGrid = stage.querySelector(".fvn-stage__preview-grid");
    previewGrid.hidden = false;
    stage.classList.add("fvn-stage--preview-active");
    previewGrid.querySelector(".fvn-stage__preview-label").textContent = game.i18n.localize("FVN.ScenePreview");
    this.previewMoveCallback = onMove;
    this.previewSourceCharacterId = payload.characterId && payload.characterId !== this.previewId
      ? String(payload.characterId)
      : null;

    for (const wrap of stage.querySelectorAll(".fvn-stage__portrait-wrap:not(.fvn-stage__portrait-wrap--preview)")) {
      const sameCharacter = this.previewSourceCharacterId && String(wrap.dataset.characterId) === this.previewSourceCharacterId;
      wrap.classList.toggle("fvn-stage__portrait-wrap--editing-hidden", Boolean(sameCharacter));
    }

    this.renderPortrait({ ...payload, id: this.previewId }, { preview: true });
  }

  static hidePreview() {
    const stage = this.ensure();
    stage.querySelector(".fvn-stage__preview-grid").hidden = true;
    stage.classList.remove("fvn-stage--preview-active");
    this.getPortraitElement(this.previewId, { create: false })?.remove();
    for (const wrap of stage.querySelectorAll(".fvn-stage__portrait-wrap--editing-hidden")) {
      wrap.classList.remove("fvn-stage__portrait-wrap--editing-hidden");
    }
    this.previewMoveCallback = null;
    this.previewSourceCharacterId = null;
    this.previewDrag = null;
    document.documentElement.classList.remove("fvn-document--positioning", "fvn-document--scaling");
  }


  static activatePreviewDragging(stage) {
    stage.addEventListener("pointerdown", (event) => {
      const wrap = event.target.closest(".fvn-stage__portrait-wrap--preview");
      if (!wrap || event.button !== 0) return;

      const stageRect = stage.getBoundingClientRect();
      const currentX = Math.min(1, Math.max(0, Number.parseFloat(wrap.style.left) / 100 || 0));
      const currentY = Math.min(1, Math.max(0, Number.parseFloat(wrap.style.top) / 100 || 0));
      const anchorClientX = stageRect.left + (currentX * stageRect.width);
      const anchorClientY = stageRect.top + (currentY * stageRect.height);
      const focusFrame = event.target.closest("[data-focus-frame]");
      const focusFrameResize = event.target.closest("[data-focus-frame-resize]");
      const scaleHandle = event.target.closest("[data-scale-handle]");

      if (focusFrameResize && focusFrame) {
        const frameRect = focusFrame.getBoundingClientRect();
        const image = wrap.querySelector(".fvn-stage__portrait");
        const imageRect = image?.getBoundingClientRect();
        this.previewDrag = {
          type: "focus-resize",
          pointerId: event.pointerId,
          wrap,
          startClientX: event.clientX,
          startWidth: frameRect.width,
          anchorLeft: imageRect ? frameRect.left - imageRect.left : 0,
          anchorTop: imageRect ? frameRect.top - imageRect.top : 0
        };
        focusFrameResize.setPointerCapture?.(event.pointerId);
        document.documentElement.classList.add("fvn-document--focusing");
      } else if (focusFrame) {
        const frameRect = focusFrame.getBoundingClientRect();
        this.previewDrag = {
          type: "focus",
          pointerId: event.pointerId,
          wrap,
          grabOffsetX: event.clientX - (frameRect.left + frameRect.width / 2),
          grabOffsetY: event.clientY - (frameRect.top + frameRect.height / 2)
        };
        focusFrame.setPointerCapture?.(event.pointerId);
        document.documentElement.classList.add("fvn-document--focusing");
      } else if (scaleHandle) {
        const startScale = Math.min(3, Math.max(0.25, Number(wrap.style.getPropertyValue("--fvn-character-scale")) || 1));
        const startDistance = Math.max(20, Math.hypot(event.clientX - anchorClientX, event.clientY - anchorClientY));
        this.previewDrag = {
          type: "scale",
          pointerId: event.pointerId,
          anchorClientX,
          anchorClientY,
          startDistance,
          startScale
        };
        document.documentElement.classList.add("fvn-document--scaling");
      } else {
        this.previewDrag = {
          type: "move",
          pointerId: event.pointerId,
          stageRect,
          grabOffsetX: event.clientX - anchorClientX,
          grabOffsetY: event.clientY - anchorClientY
        };
        document.documentElement.classList.add("fvn-document--positioning");
      }

      event.preventDefault();
      event.stopPropagation();

      const move = (moveEvent) => {
        if (!this.previewDrag || moveEvent.pointerId !== this.previewDrag.pointerId) return;
        if (this.previewDrag.type === "scale") this.scalePreviewToPointer(moveEvent);
        else if (this.previewDrag.type === "focus-resize") this.resizeFocusFrameToPointer(moveEvent);
        else if (this.previewDrag.type === "focus") this.moveFocusToPointer(moveEvent);
        else this.movePreviewToPointer(moveEvent);
      };

      const end = (endEvent) => {
        if (!this.previewDrag || endEvent.pointerId !== this.previewDrag.pointerId) return;
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", end, true);
        window.removeEventListener("pointercancel", end, true);
        this.previewDrag = null;
        document.documentElement.classList.remove("fvn-document--positioning", "fvn-document--scaling", "fvn-document--focusing");
      };

      window.addEventListener("pointermove", move, true);
      window.addEventListener("pointerup", end, true);
      window.addEventListener("pointercancel", end, true);
    }, true);
  }

  static scalePreviewToPointer(event) {
    if (!this.previewDrag || this.previewDrag.type !== "scale") return;
    const distance = Math.max(20, Math.hypot(
      event.clientX - this.previewDrag.anchorClientX,
      event.clientY - this.previewDrag.anchorClientY
    ));
    const ratio = distance / this.previewDrag.startDistance;
    const scale = Math.min(3, Math.max(0.25, this.previewDrag.startScale * ratio));
    const wrap = this.getPortraitElement(this.previewId, { create: false });
    if (wrap) wrap.style.setProperty("--fvn-character-scale", scale.toFixed(4));
    this.previewMoveCallback?.({ scale });
  }

  static moveFocusToPointer(event) {
    if (!this.previewDrag || this.previewDrag.type !== "focus") return;
    const wrap = this.previewDrag.wrap;
    const image = wrap?.querySelector(".fvn-stage__portrait");
    const frame = wrap?.querySelector("[data-focus-frame]");
    const rect = image?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;

    const pointerX = event.clientX - (this.previewDrag.grabOffsetX ?? 0);
    const pointerY = event.clientY - (this.previewDrag.grabOffsetY ?? 0);
    const frameRect = frame?.getBoundingClientRect();
    const halfWidthRatio = frameRect?.width ? Math.min(0.5, frameRect.width / (2 * rect.width)) : 0;
    const halfHeightRatio = frameRect?.height ? Math.min(0.5, frameRect.height / (2 * rect.height)) : 0;
    const visualX = Math.min(1 - halfWidthRatio, Math.max(halfWidthRatio, (pointerX - rect.left) / rect.width));
    const focusY = Math.min(1 - halfHeightRatio, Math.max(halfHeightRatio, (pointerY - rect.top) / rect.height));
    const mirrored = wrap.dataset.mirror === "true";
    const focusX = mirrored ? 1 - visualX : visualX;

    if (frame) {
      frame.style.left = `${visualX * 100}%`;
      frame.style.top = `${focusY * 100}%`;
    }
    this.previewMoveCallback?.({ focusX, focusY });
  }

  static resizeFocusFrameToPointer(event) {
    if (!this.previewDrag || this.previewDrag.type !== "focus-resize") return;
    const wrap = this.previewDrag.wrap;
    const image = wrap?.querySelector(".fvn-stage__portrait");
    const frame = wrap?.querySelector("[data-focus-frame]");
    const imageRect = image?.getBoundingClientRect();
    if (!frame || !imageRect?.width || !imageRect?.height) return;

    const delta = event.clientX - this.previewDrag.startClientX;
    const cameraAspect = Math.max(0.1, Number.parseFloat(getComputedStyle(frame).aspectRatio) || (16 / 9));
    const minWidthPx = imageRect.width * 0.24;

    // Resize from the bottom-right handle while keeping the current top-left
    // corner fixed. This lets a frame placed near the upper-left edge expand
    // across the remaining portrait instead of being blocked by its old centre.
    const anchorLeft = Math.min(imageRect.width, Math.max(0, Number(this.previewDrag.anchorLeft) || 0));
    const anchorTop = Math.min(imageRect.height, Math.max(0, Number(this.previewDrag.anchorTop) || 0));
    const maxWidthByRightEdge = imageRect.width - anchorLeft;
    const maxWidthByBottomEdge = (imageRect.height - anchorTop) * cameraAspect;
    const maxWidthPx = Math.max(minWidthPx, Math.min(imageRect.width, maxWidthByRightEdge, maxWidthByBottomEdge));
    const widthPx = Math.min(maxWidthPx, Math.max(minWidthPx, this.previewDrag.startWidth + delta));
    const heightPx = widthPx / cameraAspect;

    const centerX = (anchorLeft + (widthPx / 2)) / imageRect.width;
    const centerY = (anchorTop + (heightPx / 2)) / imageRect.height;
    const visualFocusX = Math.min(1, Math.max(0, centerX));
    const focusY = Math.min(1, Math.max(0, centerY));
    const mirrored = wrap.dataset.mirror === "true";
    const focusX = mirrored ? 1 - visualFocusX : visualFocusX;
    const widthPercent = (widthPx / imageRect.width) * 100;
    const focusZoom = Math.min(3.3333, Math.max(0.8, 80 / widthPercent));

    frame.style.left = `${visualFocusX * 100}%`;
    frame.style.top = `${focusY * 100}%`;
    frame.style.width = `${widthPercent}%`;
    this.previewMoveCallback?.({ focusX, focusY, focusZoom });
  }

  static movePreviewToPointer(event) {
    const stage = this.ensure();
    const rect = stage.getBoundingClientRect();
    const grabOffsetX = this.previewDrag?.grabOffsetX ?? 0;
    const grabOffsetY = this.previewDrag?.grabOffsetY ?? 0;
    const anchorClientX = event.clientX - grabOffsetX;
    const anchorClientY = event.clientY - grabOffsetY;
    const x = Math.min(1, Math.max(0, (anchorClientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (anchorClientY - rect.top) / rect.height));
    const wrap = this.getPortraitElement(this.previewId, { create: false });
    if (wrap) {
      wrap.style.left = `${x * 100}%`;
      wrap.style.top = `${y * 100}%`;
    }
    this.previewMoveCallback?.({ x, y });
  }
}


class VisualNovelScenePalette {
  static root = null;
  static expanded = false;
  static currentTabId = null;
  static dragState = null;
  static suppressNextClick = false;
  static tutorialMode = false;
  static positionStorageKey = `${MODULE_ID}.scenePalettePosition`;

  static getBindings() {
    const raw = game.settings.get(MODULE_ID, SCENE_BINDINGS_SETTING);
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  }

  static getCurrentSceneId() {
    return canvas?.scene?.id ?? null;
  }

  static getAvailableTabs() {
    const sceneId = this.getCurrentSceneId();
    const bindings = this.getBindings();
    const boundIds = new Set(sceneId && Array.isArray(bindings[sceneId]) ? bindings[sceneId].map(String) : []);
    return VisualNovelDirector.getTabs()
      .map((tab) => ({ ...tab, isSceneBound: boundIds.has(String(tab.id)) }))
      .sort((a, b) => Number(b.isSceneBound) - Number(a.isSceneBound));
  }

  static getBoundTabs() {
    return this.getAvailableTabs().filter((tab) => tab.isSceneBound);
  }

  static ensure() {
    if (!game.user.isGM) return null;
    if (this.root?.isConnected) return this.root;
    this.root = document.createElement("aside");
    this.root.id = "fvn-scene-palette";
    this.root.className = "fvn-scene-palette";
    this.root.innerHTML = `
      <div class="fvn-scene-palette__panel" data-region="palette-panel" hidden>
        <div class="fvn-scene-palette__header"><i class="fa-solid fa-bolt"></i><span>${game.i18n.localize("FVN.QuickAccess")}</span></div>
        <div class="fvn-scene-palette__tabs" data-region="palette-tabs"></div>
        <div class="fvn-scene-palette__portraits" data-region="palette-portraits"></div>
        <div class="fvn-scene-palette__controls">
          <div class="fvn-scene-palette__utility-row">
            <button type="button" data-action="toggle-palette-all" class="fvn-scene-palette__all">
              <i class="fa-solid fa-eye-slash"></i>
              <span>${game.i18n.localize("FVN.HideAll")}</span>
            </button>
            <button type="button" data-action="toggle-palette-names" class="fvn-scene-palette__names">
              <i class="fa-solid fa-tag"></i>
              <span>${game.i18n.localize("FVN.HideNames")}</span>
            </button>
          </div>
          <button type="button" data-action="reset-palette-camera" class="fvn-scene-palette__reset-camera" title="${game.i18n.localize("FVN.ResetCamera")}">
            <i class="fa-solid fa-arrows-to-circle"></i>
            <span>${game.i18n.localize("FVN.ResetCamera")}</span>
          </button>
          <button type="button" data-action="toggle-palette-dim" class="fvn-scene-palette__dim">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>${game.i18n.localize("FVN.BackgroundEffectToggle")}</span>
          </button>
        </div>
      </div>
      <button type="button" class="fvn-scene-palette__toggle" data-action="toggle-palette" title="${game.i18n.localize("FVN.QuickAccess")}">
        <i class="fa-solid fa-masks-theater"></i>
      </button>`;
    document.body.appendChild(this.root);
    this.restorePosition();
    const toggle = this.root.querySelector("[data-action='toggle-palette']");
    toggle.addEventListener("pointerdown", (event) => this.startDrag(event));
    this.root.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-action='select-variant']");
      if (!select) return;
      const characterId = select.closest("[data-character-id]")?.dataset.characterId;
      if (characterId) await VisualNovelDirector.setCharacterVariant(characterId, select.value || null);
    });
    this.root.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;
      if (action === "toggle-palette") {
        if (this.suppressNextClick) {
          this.suppressNextClick = false;
          return;
        }
        this.expanded = !this.expanded;
        this.render();
      }
      if (action === "select-palette-tab") {
        this.currentTabId = event.target.closest("[data-tab-id]")?.dataset.tabId ?? null;
        this.render();
      }
      if (action === "toggle-palette-character") {
        const id = event.target.closest("[data-character-id]")?.dataset.characterId;
        if (!id) return;
        const visible = VisualNovelDirector.getVisibleIds().has(String(id));
        if (visible) await VisualNovelAPI.hide(id);
        else await VisualNovelAPI.show(id);
        this.render();
      }
      if (action === "toggle-palette-all") {
        const hasVisible = VisualNovelDirector.getVisibleIds().size > 0;
        if (hasVisible) await VisualNovelAPI.hideAll();
        else await VisualNovelAPI.showAll(this.currentTabId);
        this.render();
      }
      if (action === "toggle-palette-names") {
        await VisualNovelAPI.toggleNames();
        this.render();
      }
      if (action === "toggle-palette-dim") {
        const state = VisualNovelAPI.getState();
        if (state.dimMode === "auto") return;
        await VisualNovelAPI.toggleDim();
        this.render();
      }
      if (action === "reset-palette-camera") {
        await VisualNovelAPI.resetCamera();
        this.render();
      }
      if (action === "focus-palette-character") {
        const id = event.target.closest("[data-character-id]")?.dataset.characterId;
        if (id) await VisualNovelAPI.focusCharacter(id);
        this.render();
      }
      if (action === "toggle-palette-silhouette") {
        const id = event.target.closest("[data-character-id]")?.dataset.characterId;
        if (id) await VisualNovelAPI.toggleSilhouette(id);
        this.render();
      }
    });
    this.root.addEventListener("contextmenu", (event) => this.openContextMenu(event));
    return this.root;
  }

  static openContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    document.querySelector(".fvn-palette-context-menu")?.remove();
    const menu = document.createElement("div");
    menu.className = "fvn-context-menu fvn-palette-context-menu";
    menu.innerHTML = `
      <button type="button" data-palette-menu="pool"><i class="fa-solid fa-address-book"></i><span>${game.i18n.localize("FVN.CharacterPool")}</span></button>
      <button type="button" data-palette-menu="presets"><i class="fa-solid fa-layer-group"></i><span>${game.i18n.localize("FVN.SceneSheets")}</span></button>`;
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8))}px`;
    const close = () => menu.remove();
    menu.addEventListener("click", async (clickEvent) => {
      const target = clickEvent.target.closest("[data-palette-menu]");
      if (!target) return;
      await VisualNovelDirector.open();
      VisualNovelDirector.toggleMinimized(false);
      VisualNovelDirector.setViewMode(target.dataset.paletteMenu === "pool" ? "pool" : "tabs");
      close();
    });
    window.addEventListener("pointerdown", (downEvent) => {
      if (!downEvent.target.closest(".fvn-palette-context-menu")) close();
    }, { capture: true, once: true });
  }


  static startDrag(event) {
    if (event.button !== 0) return;
    const toggle = event.currentTarget;
    const rootRect = this.root.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: toggleRect.left,
      startBottom: window.innerHeight - toggleRect.bottom,
      rootOffsetX: toggleRect.left - rootRect.left,
      moved: false
    };
    toggle.setPointerCapture?.(event.pointerId);
    toggle.classList.add("is-dragging");
    const onMove = (moveEvent) => this.onDragMove(moveEvent);
    const onUp = (upEvent) => {
      toggle.removeEventListener("pointermove", onMove);
      toggle.removeEventListener("pointerup", onUp);
      toggle.removeEventListener("pointercancel", onUp);
      this.endDrag(upEvent, toggle);
    };
    toggle.addEventListener("pointermove", onMove);
    toggle.addEventListener("pointerup", onUp);
    toggle.addEventListener("pointercancel", onUp);
  }

  static onDragMove(event) {
    const state = this.dragState;
    if (!state || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < 5) return;
    state.moved = true;
    event.preventDefault();

    const toggleSize = 48;
    const margin = 8;
    const minLeft = margin;
    const maxLeft = Math.max(minLeft, window.innerWidth - toggleSize - margin);
    const minBottom = margin;
    const maxBottom = Math.max(minBottom, window.innerHeight - toggleSize - margin);
    const left = Math.min(maxLeft, Math.max(minLeft, state.startLeft + dx));
    const bottom = Math.min(maxBottom, Math.max(minBottom, state.startBottom - dy));

    this.root.style.left = `${left - state.rootOffsetX}px`;
    this.root.style.bottom = `${bottom}px`;
    this.root.style.right = "auto";
    this.root.style.top = "auto";
  }

  static endDrag(event, toggle) {
    const state = this.dragState;
    if (!state || event.pointerId !== state.pointerId) return;
    toggle.releasePointerCapture?.(event.pointerId);
    toggle.classList.remove("is-dragging");
    this.dragState = null;
    if (!state.moved) return;
    this.suppressNextClick = true;
    const toggleRect = toggle.getBoundingClientRect();
    const position = {
      left: Math.round(toggleRect.left),
      bottom: Math.round(window.innerHeight - toggleRect.bottom)
    };
    localStorage.setItem(this.positionStorageKey, JSON.stringify(position));
  }

  static restorePosition() {
    let position = null;
    try {
      position = JSON.parse(localStorage.getItem(this.positionStorageKey) || "null");
    } catch (_error) {
      position = null;
    }
    if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.bottom)) return;
    const toggleSize = 48;
    const margin = 8;
    const left = Math.min(Math.max(margin, position.left), Math.max(margin, window.innerWidth - toggleSize - margin));
    const bottom = Math.min(Math.max(margin, position.bottom), Math.max(margin, window.innerHeight - toggleSize - margin));
    this.root.style.left = `${left}px`;
    this.root.style.bottom = `${bottom}px`;
    this.root.style.right = "auto";
    this.root.style.top = "auto";
  }

  static render() {
    if (!game.user.isGM) return;
    const root = this.ensure();
    const tabs = this.getAvailableTabs();
    root.hidden = false;
    if (!tabs.length && !this.tutorialMode) {
      this.currentTabId = null;
    }
    if (!tabs.some((tab) => tab.id === this.currentTabId)) this.currentTabId = tabs[0].id;
    const panel = root.querySelector("[data-region='palette-panel']");
    panel.hidden = !this.expanded;
    root.classList.toggle("fvn-scene-palette--expanded", this.expanded);
    const tabsRegion = root.querySelector("[data-region='palette-tabs']");
    tabsRegion.innerHTML = tabs.length ? tabs.map((tab) => `<button type="button" data-action="select-palette-tab" data-tab-id="${tab.id}" class="${tab.id === this.currentTabId ? "is-active" : ""} ${tab.isSceneBound ? "is-scene-bound" : "is-unbound"}" title="${VisualNovelAPI.escapeHtml(tab.name)}${tab.isSceneBound ? ` · ${game.i18n.localize("FVN.BoundToCurrentScene")}` : ""}">${tab.isSceneBound ? '<i class="fa-solid fa-link"></i>' : ''}<span>${VisualNovelAPI.escapeHtml(tab.name)}</span></button>`).join("") : `<div class="fvn-scene-palette__empty-tab">${game.i18n.localize("FVN.NoScenePresets")}</div>`;
    const state = VisualNovelAPI.getState();
    const dimButton = root.querySelector("[data-action='toggle-palette-dim']");
    if (dimButton) {
      const automatic = state.dimMode === "auto";
      const cameraOnly = state.dimMode === "camera";
      const effectiveDimmed = automatic ? state.portraits.length > 0 : cameraOnly ? VisualNovelStage.normalizeCamera(state.camera).enabled : state.dimmed;
      dimButton.disabled = automatic || cameraOnly;
      dimButton.classList.toggle("is-active", effectiveDimmed);
      dimButton.classList.toggle("is-disabled", automatic || cameraOnly);
      dimButton.title = automatic
        ? game.i18n.localize("FVN.BackgroundAutomatic")
        : cameraOnly
          ? game.i18n.localize("FVN.BackgroundDuringCameraFocus")
          : game.i18n.localize(effectiveDimmed ? "FVN.RestoreBackground" : "FVN.BackgroundEffectToggle");
      const dimLabel = dimButton.querySelector("span");
      if (dimLabel) dimLabel.textContent = game.i18n.localize(effectiveDimmed ? "FVN.RestoreBackground" : "FVN.BackgroundEffectToggle");
    }
    const camera = VisualNovelStage.normalizeCamera(state.camera);
    const resetCameraButton = root.querySelector('[data-action="reset-palette-camera"]');
    if (resetCameraButton) resetCameraButton.disabled = !camera.enabled && camera.x === 0 && camera.y === 0 && camera.zoom === 1;
    const allButton = root.querySelector('[data-action="toggle-palette-all"]');
    if (allButton) {
      const hasVisible = state.portraits.length > 0;
      const icon = allButton.querySelector("i");
      const label = allButton.querySelector("span");
      if (icon) icon.className = hasVisible ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
      if (label) label.textContent = game.i18n.localize(hasVisible ? "FVN.HideAll" : "FVN.ShowAll");
    }
    const namesButton = root.querySelector('[data-action="toggle-palette-names"]');
    if (namesButton) {
      namesButton.classList.toggle("is-active", state.namesVisible);
      namesButton.setAttribute("aria-pressed", String(state.namesVisible));
      const label = namesButton.querySelector("span");
      if (label) label.textContent = game.i18n.localize(state.namesVisible ? "FVN.HideNames" : "FVN.ShowNames");
    }
    const visible = VisualNovelDirector.getVisibleIds();
    const characters = this.currentTabId ? VisualNovelDirector.getLibrary().filter((entry) => entry.tabId === this.currentTabId) : [];
    const portraits = root.querySelector("[data-region='palette-portraits']");
    portraits.innerHTML = characters.length ? characters.map((character) => {
      const active = visible.has(String(character.id));
      return `<div class="fvn-scene-palette__item" data-character-id="${character.id}">
        <button type="button" data-action="toggle-palette-character" class="fvn-scene-palette__portrait ${active ? "is-active" : ""}" title="${VisualNovelAPI.escapeHtml(character.name)}">
          <span class="fvn-checkerboard"><img src="${VisualNovelDirector.getDisplayImage(character)}" alt="${VisualNovelAPI.escapeHtml(character.name)}" /></span>
          <small>${VisualNovelAPI.escapeHtml(character.name)}</small>
        </button>
        <button type="button" data-action="focus-palette-character" class="fvn-scene-palette__focus ${VisualNovelAPI.lastFocus?.characterId === String(character.id) ? "is-active" : ""}" title="${game.i18n.localize(VisualNovelAPI.lastFocus?.characterId === String(character.id) ? "FVN.RestoreFocus" : "FVN.FocusCharacter")}" ${active ? "" : "disabled"}><i class="fa-solid fa-crosshairs"></i></button>
        <button type="button" data-action="toggle-palette-silhouette" class="fvn-scene-palette__silhouette ${Boolean(character.silhouette) ? "is-active" : ""}" title="${game.i18n.localize("FVN.Silhouette")}"><i class="fa-solid fa-user-secret"></i></button>
        ${VisualNovelDirector.variantOptions(character)}
      </div>`;
    }).join("") : `<div class="fvn-scene-palette__empty">${game.i18n.localize("FVN.EmptyLibrary")}</div>`;
    VisualNovelStage.scheduleSafeAreaUpdate();
  }
}

class VisualNovelDirector {
  static panel = null;
  static contextMenu = null;
  static contextMenuTarget = null;
  static editingId = null;
  static dragState = null;
  static resizeState = null;
  static currentTabId = null;
  static visibleOnly = false;
  static viewMode = "tabs";
  static editingPoolId = null;
  static editorLayout = null;
  static assetMetricsCache = new Map();
  static performanceRefreshToken = 0;

  static async open() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("FVN.GMOnly"));
      return;
    }

    if (this.panel?.isConnected) {
      this.toggleMinimized();
      return;
    }

    this.panel = document.createElement("section");
    this.panel.id = "fvn-director";
    this.panel.className = "fvn-director";
    this.panel.innerHTML = `
      <header class="fvn-director__header" title="${game.i18n.localize("FVN.DoubleClickCollapse")}">
        <h2><i class="fa-solid fa-masks-theater"></i> ${game.i18n.localize("FVN.Director")}</h2>
        <div class="fvn-director__header-actions">
          <button type="button" data-action="tutorial" title="${game.i18n.localize("FVN.StartTutorial")}"><i class="fa-solid fa-graduation-cap"></i></button>
          <button type="button" data-action="minimize" title="${game.i18n.localize("FVN.Minimize")}"><i data-region="collapse-icon" class="fa-solid fa-chevron-down"></i></button>
          <button type="button" data-action="close" title="${game.i18n.localize("FVN.Close")}"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </header>

      <div class="fvn-director__body">
        <aside class="fvn-director__sidebar">
          <nav class="fvn-view-switch" aria-label="${game.i18n.localize("FVN.ViewMode")}">
            <button type="button" data-action="view-pool"><i class="fa-solid fa-address-book"></i> ${game.i18n.localize("FVN.CharacterPool")}</button>
            <div class="fvn-view-switch__divider" role="separator" aria-hidden="true"></div>
            <button type="button" data-action="view-tabs" class="is-active"><i class="fa-solid fa-layer-group"></i> ${game.i18n.localize("FVN.SceneSheets")}</button>
          </nav>
          <div class="fvn-tab-manager">
            <div class="fvn-sidebar-heading">
              <span>${game.i18n.localize("FVN.SceneSheets")}</span>
              <div class="fvn-tab-actions">
                <button type="button" data-action="new-tab" title="${game.i18n.localize("FVN.NewTab")}"><i class="fa-solid fa-folder-plus"></i></button>
                <button type="button" data-action="create-tabs-from-scenes" title="${game.i18n.localize("FVN.CreateTabsFromScenes")}"><i class="fa-solid fa-clapperboard"></i></button>
                <button type="button" data-action="rename-tab" title="${game.i18n.localize("FVN.RenameTab")}"><i class="fa-solid fa-pen-to-square"></i></button>
                <button type="button" data-action="duplicate-tab" title="${game.i18n.localize("FVN.DuplicateTab")}"><i class="fa-solid fa-copy"></i></button>
                <button type="button" data-action="bind-scenes" title="${game.i18n.localize("FVN.BindScenes")}"><i class="fa-solid fa-link"></i></button>
                <button type="button" data-action="delete-tab" title="${game.i18n.localize("FVN.DeleteTab")}"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
            <div class="fvn-tabs" data-region="tabs"></div>
          </div>
        </aside>
        <main class="fvn-director__content">
        <div class="fvn-toolbar">
          <div class="fvn-search-wrap">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input type="search" data-field="search" placeholder="${game.i18n.localize("FVN.Search")}" />
          </div>
          <button type="button" data-action="filter-visible" class="fvn-filter-button" title="${game.i18n.localize("FVN.VisibleOnly")}"><i class="fa-solid fa-eye"></i></button>
          <button type="button" data-action="add-from-pool" class="fvn-pool-add"><i class="fa-solid fa-copy"></i> ${game.i18n.localize("FVN.AddCharacter")}</button>
          <button type="button" data-action="new-character" class="fvn-primary"><i class="fa-solid fa-plus"></i> <span data-region="new-character-label">${game.i18n.localize("FVN.NewCharacter")}</span></button>
        </div>


        <form class="fvn-scene-binding-editor fvn-scene-binding-editor--hidden" data-region="scene-binding-editor">
          <div class="fvn-scene-binding-editor__header">
            <strong data-region="binding-title"></strong>
            <button type="button" data-action="close-bindings" title="${game.i18n.localize("FVN.Close")}"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="fvn-scene-binding-editor__list" data-region="binding-scenes"></div>
          <button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${game.i18n.localize("FVN.SaveSceneBindings")}</button>
        </form>

        <form class="fvn-tab-editor fvn-tab-editor--hidden" data-region="tab-editor">
          <input type="text" name="tabName" maxlength="80" autocomplete="off" />
          <button type="submit" title="${game.i18n.localize("FVN.Save")}"><i class="fa-solid fa-check"></i></button>
          <button type="button" data-action="cancel-tab-edit" title="${game.i18n.localize("FVN.Cancel")}"><i class="fa-solid fa-xmark"></i></button>
        </form>

        <div class="fvn-character-list" data-region="character-list"></div>

        <section class="fvn-pool-picker fvn-pool-picker--hidden" data-region="pool-picker">
          <header><strong>${game.i18n.localize("FVN.AddFromPool")}</strong><button type="button" data-action="close-pool-picker"><i class="fa-solid fa-xmark"></i></button></header>
          <div class="fvn-pool-picker__search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-field="pool-search" placeholder="${game.i18n.localize("FVN.SearchPool")}" /></div>
          <div class="fvn-pool-picker__list" data-region="pool-picker-list"></div>
          <footer><button type="button" data-action="confirm-pool-add"><i class="fa-solid fa-copy"></i> ${game.i18n.localize("FVN.AddSelected")}</button></footer>
        </section>

        <form class="fvn-editor fvn-editor--hidden" data-region="editor">
          <h3 data-region="editor-title">${game.i18n.localize("FVN.NewCharacter")}</h3>

          <label>
            <span>${game.i18n.localize("FVN.Name")}</span>
            <input type="text" name="name" required />
          </label>

          <label>
            <span>${game.i18n.localize("FVN.ImagePath")}</span>
            <div class="fvn-file-row">
              <input type="text" name="image" required />
              <button type="button" data-action="browse"><i class="fa-solid fa-folder-open"></i></button>
            </div>
          </label>

          <section class="fvn-variants-editor">
            <div class="fvn-variants-editor__header">
              <div><strong>${game.i18n.localize("FVN.Variants")}</strong><small>${game.i18n.localize("FVN.VariantsOptional")}</small></div>
              <button type="button" data-action="add-variant"><i class="fa-solid fa-plus"></i> ${game.i18n.localize("FVN.AddVariant")}</button>
            </div>
            <div class="fvn-variants-editor__list" data-region="variant-list"></div>
          </section>

          <label data-region="editor-tab-field">
            <span>${game.i18n.localize("FVN.Tab")}</span>
            <select name="tabId"></select>
          </label>

          <div class="fvn-editor__grid">
            <label class="fvn-scale-control">
              <span>${game.i18n.localize("FVN.Scale")} <output data-region="scale-output">100%</output></span>
              <input type="range" name="scale" min="0.25" max="3" step="0.05" value="1" />
            </label>

            <label class="fvn-checkbox">
              <input type="checkbox" name="mirror" />
              <span>${game.i18n.localize("FVN.Mirror")}</span>
            </label>
          </div>

          <section class="fvn-focus-editor">
            <div class="fvn-focus-editor__title"><strong><i class="fa-solid fa-crosshairs"></i> ${game.i18n.localize("FVN.CameraFocus")}</strong><small>${game.i18n.localize("FVN.CameraFocusHelp")}</small></div>
            <p class="fvn-focus-editor__instruction"><i class="fa-solid fa-hand-pointer"></i> ${game.i18n.localize("FVN.FocusDragHelp")}</p>
            <input type="hidden" name="focusX" value="0.5" />
            <input type="hidden" name="focusY" value="0.28" />
            <input type="hidden" name="focusZoom" value="1.65" />
            <div class="fvn-focus-editor__coordinates"><span>X <output data-region="focus-x-output">50%</output></span><span>Y <output data-region="focus-y-output">28%</output></span><span>${game.i18n.localize("FVN.FocusZoom")} <output data-region="focus-zoom-output">165%</output></span></div>
          </section>

          <div class="fvn-direct-position">
            <div>
              <strong>${game.i18n.localize("FVN.Position")}</strong>
              <output data-region="position-output">X 18% · Y 100%</output>
            </div>
            <p><i class="fa-solid fa-up-down-left-right"></i> ${game.i18n.localize("FVN.DirectPositionHelp")}</p>
            <p><i class="fa-solid fa-up-right-and-down-left-from-center"></i> ${game.i18n.localize("FVN.DirectScaleHelp")}</p>
            <input type="hidden" name="x" value="0.18" />
            <input type="hidden" name="y" value="1" />
          </div>

          <div class="fvn-editor__actions">
            <button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${game.i18n.localize("FVN.Save")}</button>
            <button type="button" data-action="cancel-edit">${game.i18n.localize("FVN.Cancel")}</button>
          </div>
        </form>
        </main>
      </div>

      <footer class="fvn-director__footer">
        <section class="fvn-preset-performance" data-region="preset-performance">
          <div class="fvn-preset-performance__heading">
            <span><i class="fa-solid fa-gauge-high"></i> ${game.i18n.localize("FVN.PresetLoad")}</span>
            <strong data-region="performance-label">${game.i18n.localize("FVN.PerformanceCalculating")}</strong>
          </div>
          <div class="fvn-performance-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <span data-region="performance-fill"></span>
          </div>
          <div class="fvn-preset-performance__summary" data-region="performance-summary"></div>
        </section>
        <section class="fvn-footer-group fvn-footer-group--stage">
          <div class="fvn-footer-group__title"><i class="fa-solid fa-clapperboard"></i> ${game.i18n.localize("FVN.Stage")}</div>
          <div class="fvn-background-controls">
            <label>
              <span>${game.i18n.localize("FVN.BackgroundActivation")}</span>
              <select data-action="dim-mode">
                <option value="manual">${game.i18n.localize("FVN.BackgroundManual")}</option>
                <option value="auto">${game.i18n.localize("FVN.BackgroundAutomatic")}</option>
                <option value="camera">${game.i18n.localize("FVN.BackgroundDuringCameraFocus")}</option>
              </select>
            </label>
            <label>
              <span>${game.i18n.localize("FVN.BackgroundEffect")}</span>
              <select data-action="background-effect">
                <option value="none">${game.i18n.localize("FVN.BackgroundNone")}</option>
                <option value="dim">${game.i18n.localize("FVN.BackgroundDim")}</option>
                <option value="blur">${game.i18n.localize("FVN.BackgroundBlur")}</option>
                <option value="focus">${game.i18n.localize("FVN.BackgroundFocus")}</option>
              </select>
            </label>
            <label>
              <span>${game.i18n.localize("FVN.BackgroundIntensity")}</span>
              <select data-action="background-intensity">
                <option value="small">${game.i18n.localize("FVN.IntensitySmall")}</option>
                <option value="medium">${game.i18n.localize("FVN.IntensityMedium")}</option>
                <option value="large">${game.i18n.localize("FVN.IntensityLarge")}</option>
              </select>
            </label>
          </div>
          <div class="fvn-stage-actions">
            <button type="button" data-action="toggle-dim" class="fvn-dim-button"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>${game.i18n.localize("FVN.BackgroundEffectToggle")}</span></button>
            <button type="button" data-action="reset-camera" class="fvn-camera-reset"><i class="fa-solid fa-arrows-to-circle"></i> ${game.i18n.localize("FVN.ResetCamera")}</button>
            <button type="button" data-action="toggle-names" class="fvn-names-toggle"><i class="fa-solid fa-tag"></i> <span>${game.i18n.localize("FVN.HideNames")}</span></button>
            <button type="button" data-action="toggle-all" class="fvn-danger"><i class="fa-solid fa-eye-slash"></i> <span>${game.i18n.localize("FVN.HideAll")}</span></button>
          </div>
        </section>
        <div class="fvn-preset-status" data-region="preset-status" data-level="green">
          <i class="fa-solid fa-circle-info"></i>
          <span>${game.i18n.localize("FVN.PerformanceCalculating")}</span>
        </div>
      </footer>
      <div class="fvn-director__resize-handle" data-role="resize-handle" aria-hidden="true"></div>
    `;

    document.body.appendChild(this.panel);
    this.restorePanelSize();
    this.restorePanelPosition();
    this.restoreMinimizedState();
    this.activateListeners();
    await this.renderTabs();
    await this.renderCharacters();
  }

  static activateListeners() {
    const header = this.panel.querySelector(".fvn-director__header");
    header.addEventListener("pointerdown", (event) => this.startDrag(event));
    header.addEventListener("dblclick", (event) => {
      if (event.target.closest("button, input, select, textarea, a")) return;
      event.preventDefault();
      this.toggleMinimized();
    });
    this.panel.querySelector("[data-role='resize-handle']").addEventListener("pointerdown", (event) => this.startResize(event));

    this.panel.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const action = button.dataset.action;
      const characterId = button.closest("[data-character-id]")?.dataset.characterId;

      switch (action) {
        case "close": this.close(); break;
        case "tutorial": await VisualNovelOnboarding.startTutorial(); break;
        case "minimize": this.toggleMinimized(); break;
        case "view-tabs": this.setViewMode("tabs"); break;
        case "view-pool": this.setViewMode("pool"); break;
        case "new-character": this.openEditor(null, { pool: this.viewMode === "pool" }); break;
        case "add-from-pool": this.openPoolPicker(); break;
        case "close-pool-picker": this.closePoolPicker(); break;
        case "confirm-pool-add": await this.addSelectedFromPool(); break;
        case "new-tab": this.openTabEditor("create"); break;
        case "create-tabs-from-scenes": await this.createTabsFromScenes(); break;
        case "rename-tab": this.openTabEditor("rename"); break;
        case "duplicate-tab": await this.duplicateCurrentTab(); break;
        case "cancel-tab-edit": this.closeTabEditor(); break;
        case "delete-tab": await this.deleteCurrentTab(); break;
        case "bind-scenes": this.openSceneBindingEditor(); break;
        case "close-bindings": this.closeSceneBindingEditor(); break;
        case "select-tab": this.selectTab(button.dataset.tabId); break;
        case "cancel-edit": this.closeEditor(); break;
        case "browse": this.browseImage(); break;
        case "add-variant": this.addVariantRow(); break;
        case "browse-variant": this.browseVariantImage(button.closest("[data-variant-row]")); break;
        case "delete-variant": button.closest("[data-variant-row]")?.remove(); break;
        case "toggle": await this.toggleCharacter(characterId); break;
        case "filter-visible": this.toggleVisibleFilter(); break;
        case "toggle-dim": await VisualNovelAPI.toggleDim(); break;
        case "reset-camera": await VisualNovelAPI.resetCamera(); break;
        case "toggle-names": await VisualNovelAPI.toggleNames(); break;
        case "focus-character": await VisualNovelAPI.focusCharacter(characterId); break;
        case "show": await this.showCharacter(characterId); break;
        case "hide": await VisualNovelAPI.hide(characterId); break;
        case "edit": this.viewMode === "pool" ? await this.editPoolCharacter(characterId) : await this.editCharacter(characterId); break;
        case "delete": this.viewMode === "pool" ? await this.deletePoolCharacter(characterId) : await this.deleteCharacter(characterId); break;
        case "hide-all": await VisualNovelAPI.hideAll(); break;
        case "toggle-all": {
          const hasVisible = VisualNovelDirector.getVisibleIds().size > 0;
          if (hasVisible) await VisualNovelAPI.hideAll();
          else await VisualNovelAPI.showAll(this.currentTabId);
          break;
        }
      }
    });

    const characterList = this.panel.querySelector("[data-region='character-list']");
    characterList.addEventListener("pointerdown", (event) => this.startCharacterLayerPointerDrag(event));
    this.panel.addEventListener("contextmenu", (event) => this.openContextMenu(event));
    window.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".fvn-context-menu")) this.closeContextMenu();
    }, true);
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.closeContextMenu();
    });
    window.addEventListener("resize", () => this.closeContextMenu());

    this.panel.querySelector("[data-field='search']").addEventListener("input", () => this.renderCharacters());
    this.panel.querySelector("[data-field='pool-search']").addEventListener("input", () => this.renderPoolPicker());
    const tabEditor = this.panel.querySelector("[data-region='tab-editor']");
    tabEditor.addEventListener("submit", (event) => this.saveTabEditor(event));
    const bindingEditor = this.panel.querySelector("[data-region='scene-binding-editor']");
    bindingEditor.addEventListener("submit", (event) => this.saveSceneBindings(event));

    const editor = this.panel.querySelector("[data-region='editor']");
    editor.addEventListener("submit", (event) => this.saveCharacter(event));
    editor.addEventListener("input", () => this.updateScenePreview());
    editor.addEventListener("change", () => this.updateScenePreview());

    this.panel.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-action='select-variant']");
      if (!select) return;
      const characterId = select.closest("[data-character-id]")?.dataset.characterId;
      if (characterId) await this.setCharacterVariant(characterId, select.value || null);
    });

    this.panel.querySelector('[data-action="dim-mode"]').addEventListener("change", (event) => VisualNovelAPI.setDimMode(event.currentTarget.value));
    this.panel.querySelector('[data-action="background-effect"]').addEventListener("change", (event) => VisualNovelAPI.setBackgroundEffect(event.currentTarget.value));
    this.panel.querySelector('[data-action="background-intensity"]').addEventListener("change", (event) => VisualNovelAPI.setBackgroundIntensity(event.currentTarget.value));
  }


  static openContextMenu(event) {
    const tab = event.target.closest(".fvn-tab[data-tab-id]");
    const characterCard = event.target.closest(".fvn-character[data-character-id]");
    if (!tab && !characterCard) return;

    event.preventDefault();
    event.stopPropagation();
    this.closeContextMenu();

    let items = [];
    if (tab) {
      const tabId = tab.dataset.tabId;
      this.contextMenuTarget = { type: "tab", id: tabId };
      items = [
        { action: "context-select-tab", icon: "fa-folder-open", label: "FVN.ContextOpenPreset" },
        { action: "context-rename-tab", icon: "fa-pen-to-square", label: "FVN.RenameTab" },
        { action: "context-duplicate-tab", icon: "fa-copy", label: "FVN.DuplicateTab" },
        { separator: true },
        { action: "context-bind-scenes", icon: "fa-link", label: "FVN.BindScenes" },
        { separator: true },
        { action: "context-delete-tab", icon: "fa-trash", label: "FVN.DeleteTab", danger: true }
      ];
    } else {
      const characterId = characterCard.dataset.characterId;
      const pool = characterCard.classList.contains("fvn-character--pool") || this.viewMode === "pool";
      this.contextMenuTarget = { type: pool ? "pool-character" : "scene-character", id: characterId };
      if (pool) {
        items = [
          { action: "context-add-pool-character", icon: "fa-plus", label: "FVN.ContextAddToPreset" },
          { separator: true },
          { action: "context-edit-character", icon: "fa-pen", label: "FVN.Edit" },
          { action: "context-delete-character", icon: "fa-trash", label: "FVN.Delete", danger: true }
        ];
      } else {
        const visible = this.getVisibleIds().has(String(characterId));
        items = [
          { action: "context-toggle-character", icon: visible ? "fa-eye-slash" : "fa-eye", label: visible ? "FVN.Hide" : "FVN.Show" },
          { action: "context-focus-character", icon: "fa-crosshairs", label: "FVN.FocusCharacter", disabled: !visible },
          { action: "context-toggle-silhouette", icon: "fa-user-secret", label: "FVN.Silhouette" },
          { separator: true },
          { action: "context-edit-character", icon: "fa-pen", label: "FVN.Edit" },
          { action: "context-duplicate-character", icon: "fa-copy", label: "FVN.ContextDuplicateCharacter" },
          { separator: true },
          { action: "context-delete-character", icon: "fa-trash", label: "FVN.ContextRemoveFromPreset", danger: true }
        ];
      }
    }

    const menu = document.createElement("div");
    menu.className = "fvn-context-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = items.map((item) => {
      if (item.separator) return '<div class="fvn-context-menu__separator" role="separator"></div>';
      return `<button type="button" role="menuitem" data-context-action="${item.action}" class="${item.danger ? "is-danger" : ""}" ${item.disabled ? "disabled" : ""}>
        <i class="fa-solid ${item.icon}"></i><span>${game.i18n.localize(item.label)}</span>
      </button>`;
    }).join("");
    menu.addEventListener("click", async (clickEvent) => {
      const button = clickEvent.target.closest("[data-context-action]");
      if (!button || button.disabled) return;
      const action = button.dataset.contextAction;
      const target = this.contextMenuTarget ? { ...this.contextMenuTarget } : null;
      this.closeContextMenu();
      if (target) await this.executeContextAction(action, target);
    });
    document.body.appendChild(menu);
    this.contextMenu = menu;

    const margin = 8;
    const rect = menu.getBoundingClientRect();
    const left = Math.min(window.innerWidth - rect.width - margin, Math.max(margin, event.clientX));
    const top = Math.min(window.innerHeight - rect.height - margin, Math.max(margin, event.clientY));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
  }

  static closeContextMenu() {
    this.contextMenu?.remove();
    this.contextMenu = null;
    this.contextMenuTarget = null;
  }

  static async executeContextAction(action, target) {
    if (target.type === "tab" && this.currentTabId !== target.id) {
      this.currentTabId = target.id;
      await this.renderTabs();
      await this.renderCharacters();
    }

    switch (action) {
      case "context-select-tab":
        this.selectTab(target.id);
        break;
      case "context-rename-tab":
        this.openTabEditor("rename");
        break;
      case "context-duplicate-tab":
        await this.duplicateCurrentTab();
        break;
      case "context-bind-scenes":
        this.openSceneBindingEditor();
        break;
      case "context-delete-tab":
        await this.deleteCurrentTab();
        break;
      case "context-toggle-character":
        await this.toggleCharacter(target.id);
        break;
      case "context-focus-character":
        await VisualNovelAPI.focusCharacter(target.id);
        break;
      case "context-toggle-silhouette":
        await VisualNovelAPI.toggleSilhouette(target.id);
        break;
      case "context-edit-character":
        target.type === "pool-character" ? await this.editPoolCharacter(target.id) : await this.editCharacter(target.id);
        break;
      case "context-duplicate-character":
        await this.duplicateSceneCharacter(target.id);
        break;
      case "context-add-pool-character":
        await this.addPoolCharacterToCurrentPreset(target.id);
        break;
      case "context-delete-character":
        target.type === "pool-character" ? await this.deletePoolCharacter(target.id) : await this.deleteCharacter(target.id);
        break;
    }
  }

  static async duplicateSceneCharacter(characterId) {
    const library = this.getLibrary();
    const source = library.find((entry) => String(entry.id) === String(characterId));
    if (!source) return;
    const duplicate = foundry.utils.deepClone(source);
    duplicate.id = foundry.utils.randomID();
    duplicate.x = Math.min(1, Math.max(0, Number(source.x ?? 0.5) + 0.04));
    duplicate.y = Math.min(1, Math.max(0, Number(source.y ?? 1)));
    library.push(duplicate);
    await this.setLibrary(library);
    await this.renderCharacters();
    ui.notifications.info(game.i18n.format("FVN.ContextCharacterDuplicated", { name: source.name }));
  }

  static async addPoolCharacterToCurrentPreset(characterId) {
    const source = this.getPool().find((entry) => String(entry.id) === String(characterId));
    if (!source) return;
    const library = this.getLibrary();
    library.push({
      ...foundry.utils.deepClone(source),
      id: foundry.utils.randomID(),
      sourceId: source.id,
      tabId: this.currentTabId
    });
    await this.setLibrary(library);
    ui.notifications.info(game.i18n.format("FVN.ContextCharacterAdded", { name: source.name }));
  }


  static toggleMinimized(force = null) {
    if (!this.panel) return;
    const next = force === null ? !this.panel.classList.contains("fvn-director--minimized") : Boolean(force);
    this.panel.classList.toggle("fvn-director--minimized", next);
    const icon = this.panel.querySelector('[data-region="collapse-icon"]');
    icon?.classList.toggle("fa-chevron-down", !next);
    icon?.classList.toggle("fa-chevron-right", next);
    localStorage.setItem(`${MODULE_ID}.directorMinimized`, next ? "1" : "0");
  }

  static restoreMinimizedState() {
    const minimized = localStorage.getItem(`${MODULE_ID}.directorMinimized`) === "1";
    this.toggleMinimized(minimized);
  }

  static startResize(event) {
    if (event.button !== 0) return;
    const rect = this.panel.getBoundingClientRect();
    this.resizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height
    };
    document.documentElement.classList.add("fvn-document--resizing");

    const move = (moveEvent) => this.resizePanel(moveEvent);
    const end = (endEvent) => {
      if (endEvent.pointerId !== this.resizeState?.pointerId) return;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      this.endResize();
    };

    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    event.preventDefault();
    event.stopPropagation();
  }

  static resizePanel(event) {
    if (!this.resizeState || event.pointerId !== this.resizeState.pointerId) return;
    const rect = this.panel.getBoundingClientRect();
    const maxWidth = Math.max(360, window.innerWidth - rect.left - 8);
    const maxHeight = Math.max(260, window.innerHeight - rect.top - 8);
    const width = Math.min(maxWidth, Math.max(360, this.resizeState.startWidth + event.clientX - this.resizeState.startX));
    const height = Math.min(maxHeight, Math.max(260, this.resizeState.startHeight + event.clientY - this.resizeState.startY));
    this.panel.style.width = `${width}px`;
    this.panel.style.height = `${height}px`;
  }

  static endResize() {
    if (!this.panel) return;
    this.resizeState = null;
    document.documentElement.classList.remove("fvn-document--resizing");
    const rect = this.panel.getBoundingClientRect();
    localStorage.setItem(`${MODULE_ID}.directorSize`, JSON.stringify({ width: rect.width, height: rect.height }));
  }

  static restorePanelSize() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(`${MODULE_ID}.directorSize`) || "null"); }
    catch (_error) { saved = null; }
    if (!saved || !Number.isFinite(saved.width) || !Number.isFinite(saved.height)) return;
    this.panel.style.width = `${Math.min(Math.max(360, saved.width), window.innerWidth - 16)}px`;
    this.panel.style.height = `${Math.min(Math.max(260, saved.height), window.innerHeight - 16)}px`;
  }

  static startDrag(event) {
    if (event.button !== 0 || event.target.closest("button, input, select, textarea, a")) return;

    const rect = this.panel.getBoundingClientRect();
    this.dragState = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    this.panel.classList.add("fvn-director--dragging");
    document.documentElement.classList.add("fvn-document--dragging");

    const move = (moveEvent) => this.dragPanel(moveEvent);
    const end = (endEvent) => {
      if (endEvent.pointerId !== this.dragState?.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      this.endDrag();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    event.preventDefault();
  }

  static dragPanel(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    const panelRect = this.panel.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - panelRect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - Math.min(panelRect.height, window.innerHeight - 16) - 8);
    const left = Math.min(maxLeft, Math.max(8, event.clientX - this.dragState.offsetX));
    const top = Math.min(maxTop, Math.max(8, event.clientY - this.dragState.offsetY));
    this.panel.style.left = `${left}px`;
    this.panel.style.top = `${top}px`;
    this.panel.style.right = "auto";
  }

  static endDrag() {
    if (!this.panel) return;
    this.dragState = null;
    this.panel.classList.remove("fvn-director--dragging");
    document.documentElement.classList.remove("fvn-document--dragging");
    const rect = this.panel.getBoundingClientRect();
    localStorage.setItem(`${MODULE_ID}.directorPosition`, JSON.stringify({ left: rect.left, top: rect.top }));
  }

  static restorePanelPosition() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(`${MODULE_ID}.directorPosition`) || "null"); }
    catch (_error) { saved = null; }
    if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return;
    const rect = this.panel.getBoundingClientRect();
    const left = Math.min(Math.max(8, saved.left), Math.max(8, window.innerWidth - rect.width - 8));
    const top = Math.min(Math.max(8, saved.top), Math.max(8, window.innerHeight - Math.min(rect.height, window.innerHeight - 16) - 8));
    this.panel.style.left = `${left}px`;
    this.panel.style.top = `${top}px`;
    this.panel.style.right = "auto";
  }

  static close() {
    document.documentElement.classList.remove("fvn-document--dragging");
    document.documentElement.classList.remove("fvn-document--resizing");
    VisualNovelStage.hidePreview();
    this.panel?.remove();
    this.panel = null;
    this.editingId = null;
    this.editingPoolId = null;
    this.editorLayout = null;
  }

  static getTabs() {
    const tabs = game.settings.get(MODULE_ID, TABS_SETTING);
    return Array.isArray(tabs) && tabs.length ? tabs : foundry.utils.deepClone(DEFAULT_TABS);
  }

  static async setTabs(tabs) {
    await game.settings.set(MODULE_ID, TABS_SETTING, tabs);
    VisualNovelScenePalette.render();
  }

  static ensureCurrentTab() {
    const tabs = this.getTabs();
    if (!tabs.some((tab) => tab.id === this.currentTabId)) this.currentTabId = tabs[0]?.id ?? null;
    return tabs;
  }

  static async renderTabs() {
    if (!this.panel?.isConnected) return;
    const tabs = this.ensureCurrentTab();
    const region = this.panel.querySelector("[data-region='tabs']");
    region.innerHTML = tabs.map((tab) => `
      <button type="button" class="fvn-tab ${tab.id === this.currentTabId ? "fvn-tab--active" : ""}" data-action="select-tab" data-tab-id="${tab.id}">
        ${VisualNovelAPI.escapeHtml(tab.name)}${this.getSceneBindingCount(tab.id) ? ` <i class="fa-solid fa-link fvn-tab__binding" title="${this.getSceneBindingCount(tab.id)}"></i>` : ""}
      </button>
    `).join("");

    const editorSelect = this.panel.querySelector("[data-region='editor'] select[name='tabId']");
    if (editorSelect) {
      const selected = editorSelect.value || this.currentTabId;
      editorSelect.innerHTML = tabs.map((tab) => `<option value="${tab.id}">${VisualNovelAPI.escapeHtml(tab.name)}</option>`).join("");
      editorSelect.value = tabs.some((tab) => tab.id === selected) ? selected : (tabs[0]?.id ?? "");
    }
  }

  static selectTab(tabId) {
    if (!this.getTabs().some((tab) => tab.id === tabId)) return;
    this.currentTabId = tabId;
    this.renderTabs();
    this.renderCharacters();
  }

  static openTabEditor(mode = "create") {
    const form = this.panel?.querySelector("[data-region='tab-editor']");
    if (!form) return;
    const tabs = this.ensureCurrentTab();
    const current = tabs.find((entry) => entry.id === this.currentTabId);
    form.dataset.mode = mode;
    form.elements.tabName.value = mode === "rename" ? (current?.name ?? "") : game.i18n.localize("FVN.NewTabDefault");
    form.classList.remove("fvn-tab-editor--hidden");
    form.elements.tabName.focus();
    form.elements.tabName.select();
  }

  static closeTabEditor() {
    const form = this.panel?.querySelector("[data-region='tab-editor']");
    if (!form) return;
    form.reset();
    form.dataset.mode = "";
    form.classList.add("fvn-tab-editor--hidden");
  }

  static async saveTabEditor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.tabName.value.trim();
    if (!name) return;

    const tabs = this.ensureCurrentTab();
    if (form.dataset.mode === "rename") {
      const tab = tabs.find((entry) => entry.id === this.currentTabId);
      if (!tab) return;
      tab.name = name;
      await this.setTabs(tabs);
    } else {
      const tab = { id: foundry.utils.randomID(), name };
      tabs.push(tab);
      await this.setTabs(tabs);
      this.currentTabId = tab.id;
    }

    this.closeTabEditor();
    await this.renderTabs();
    await this.renderCharacters();
  }

  static async createTabsFromScenes() {
    const scenes = game.scenes?.contents ?? [];
    if (!scenes.length) {
      ui.notifications.warn(game.i18n.localize("FVN.NoScenes"));
      return;
    }

    const content = document.createElement("div");
    content.className = "fvn-scene-tab-dialog";
    content.innerHTML = `
      <p class="fvn-scene-tab-dialog__help">${game.i18n.localize("FVN.CreateTabsFromScenesHelp")}</p>
      <div class="fvn-scene-tab-dialog__toolbar">
        <button type="button" data-action="select-all-scenes"><i class="fa-solid fa-check-double"></i> ${game.i18n.localize("FVN.SelectAll")}</button>
        <button type="button" data-action="clear-scenes"><i class="fa-solid fa-xmark"></i> ${game.i18n.localize("FVN.ClearSelection")}</button>
      </div>
      <div class="fvn-scene-tab-dialog__list">
        ${scenes.map((scene) => `
          <label class="fvn-scene-tab-dialog__row">
            <input type="checkbox" name="sceneIds" value="${scene.id}">
            <img src="${scene.thumbnail || scene.background?.src || 'icons/svg/mystery-man.svg'}" alt="">
            <span>${VisualNovelAPI.escapeHtml(scene.name)}</span>
            ${canvas?.scene?.id === scene.id ? `<em>${game.i18n.localize("FVN.CurrentScene")}</em>` : ""}
          </label>
        `).join("")}
      </div>
    `;

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("FVN.CreateTabsFromScenes") },
      content: content.innerHTML,
      position: { width: 520 },
      buttons: [
        {
          action: "cancel",
          label: game.i18n.localize("FVN.Cancel")
        },
        {
          action: "create",
          icon: "<i class='fa-solid fa-folder-plus'></i>",
          label: game.i18n.localize("FVN.CreateSelectedTabs"),
          default: true,
          callback: (_event, button) => [...button.form.querySelectorAll('input[name="sceneIds"]:checked')].map((input) => input.value)
        }
      ],
      render: (_event, dialog) => {
        const root = dialog.element instanceof HTMLElement ? dialog.element : dialog.element?.[0];
        if (!root) return;
        root.querySelector('[data-action="select-all-scenes"]')?.addEventListener("click", () => {
          for (const checkbox of root.querySelectorAll('input[name="sceneIds"]')) checkbox.checked = true;
        });
        root.querySelector('[data-action="clear-scenes"]')?.addEventListener("click", () => {
          for (const checkbox of root.querySelectorAll('input[name="sceneIds"]')) checkbox.checked = false;
        });
      },
      modal: true,
      rejectClose: false
    });

    if (!Array.isArray(result)) return;
    if (!result.length) {
      ui.notifications.warn(game.i18n.localize("FVN.SelectAtLeastOneScene"));
      return;
    }

    const selectedScenes = result.map((sceneId) => game.scenes.get(sceneId)).filter(Boolean);
    const tabs = this.ensureCurrentTab();
    const bindings = this.getSceneBindings();
    let created = 0;
    let reused = 0;
    let lastTabId = this.currentTabId;

    for (const scene of selectedScenes) {
      let tab = tabs.find((entry) => entry.sourceSceneId === scene.id);
      if (!tab) {
        const normalizedName = String(scene.name).trim().toLocaleLowerCase();
        tab = tabs.find((entry) => String(entry.name).trim().toLocaleLowerCase() === normalizedName);
      }

      if (!tab) {
        tab = {
          id: foundry.utils.randomID(),
          name: scene.name,
          sourceSceneId: scene.id
        };
        tabs.push(tab);
        created += 1;
      } else {
        reused += 1;
        if (!tab.sourceSceneId) tab.sourceSceneId = scene.id;
      }

      const sceneTabs = new Set(Array.isArray(bindings[scene.id]) ? bindings[scene.id] : []);
      sceneTabs.add(tab.id);
      bindings[scene.id] = [...sceneTabs];
      lastTabId = tab.id;
    }

    await game.settings.set(MODULE_ID, SCENE_BINDINGS_SETTING, bindings);
    await this.setTabs(tabs);
    this.currentTabId = lastTabId;
    await this.renderTabs();
    await this.renderCharacters();
    VisualNovelScenePalette.render();
    ui.notifications.info(game.i18n.format("FVN.SceneTabsCreated", { created, reused }));
  }

  static getDuplicateTabName(baseName, tabs) {
    const names = new Set(tabs.map((entry) => String(entry.name).trim().toLocaleLowerCase()));
    let index = 1;
    while (true) {
      const suffix = index === 1 ? game.i18n.localize("FVN.CopySuffix") : game.i18n.format("FVN.CopyNumberSuffix", { number: index });
      const candidate = `${baseName} ${suffix}`;
      if (!names.has(candidate.trim().toLocaleLowerCase())) return candidate;
      index += 1;
    }
  }

  static async duplicateCurrentTab() {
    const tabs = this.ensureCurrentTab();
    const sourceTab = tabs.find((entry) => entry.id === this.currentTabId);
    if (!sourceTab) return;

    const sourceSceneIds = Object.entries(this.getSceneBindings())
      .filter(([, ids]) => Array.isArray(ids) && ids.includes(sourceTab.id))
      .map(([sceneId]) => sceneId);

    const copyBindings = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("FVN.DuplicateTab") },
      content: sourceSceneIds.length
        ? `<p>${game.i18n.format("FVN.DuplicateBindingsPrompt", { count: sourceSceneIds.length })}</p>`
        : `<p>${game.i18n.localize("FVN.DuplicateNoBindingsPrompt")}</p>`,
      yes: {
        icon: sourceSceneIds.length ? "<i class='fa-solid fa-link'></i>" : "<i class='fa-solid fa-copy'></i>",
        label: sourceSceneIds.length ? game.i18n.localize("FVN.CopyBindings") : game.i18n.localize("FVN.DuplicateWithoutBindings")
      },
      no: {
        label: sourceSceneIds.length ? game.i18n.localize("FVN.DoNotCopyBindings") : game.i18n.localize("FVN.Cancel")
      },
      modal: true
    });

    if (!copyBindings && !sourceSceneIds.length) return;

    const duplicateTab = {
      ...foundry.utils.deepClone(sourceTab),
      id: foundry.utils.randomID(),
      name: this.getDuplicateTabName(sourceTab.name, tabs)
    };
    delete duplicateTab.sourceSceneId;

    const copies = this.getLibrary()
      .filter((character) => character.tabId === sourceTab.id)
      .map((character) => ({
        ...foundry.utils.deepClone(character),
        id: foundry.utils.randomID(),
        tabId: duplicateTab.id
      }));

    tabs.push(duplicateTab);
    await this.setTabs(tabs);
    await this.setLibrary([...this.getLibrary(), ...copies]);
    this.currentTabId = duplicateTab.id;

    if (copyBindings && sourceSceneIds.length) {
      const bindings = this.getSceneBindings();
      for (const sceneId of sourceSceneIds) {
        const ids = new Set(Array.isArray(bindings[sceneId]) ? bindings[sceneId] : []);
        ids.add(duplicateTab.id);
        bindings[sceneId] = [...ids];
      }
      await game.settings.set(MODULE_ID, SCENE_BINDINGS_SETTING, bindings);
    }

    await this.renderTabs();
    await this.renderCharacters();
    VisualNovelScenePalette.render();
    ui.notifications.info(game.i18n.format("FVN.TabDuplicated", { name: duplicateTab.name, count: copies.length }));
  }

  static async deleteCurrentTab() {
    const tabs = this.ensureCurrentTab();
    const tab = tabs.find((entry) => entry.id === this.currentTabId);
    if (!tab) return;
    if (tabs.length <= 1) {
      ui.notifications.warn(game.i18n.localize("FVN.CannotDeleteLastTab"));
      return;
    }

    const library = this.getLibrary();
    const characterIds = new Set(library.filter((character) => character.tabId === tab.id).map((character) => String(character.id)));
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("FVN.DeleteTab") },
      content: `
        <div class="fvn-delete-tab-confirm">
          <p><strong>${VisualNovelAPI.escapeHtml(tab.name)}</strong></p>
          <p>${game.i18n.format("FVN.DeleteTabCharacterCount", { count: characterIds.size })}</p>
          <p>${game.i18n.localize("FVN.DeleteTabPoolSafe")}</p>
          <p class="fvn-delete-tab-confirm__warning"><i class="fa-solid fa-triangle-exclamation"></i> ${game.i18n.localize("FVN.DeleteTabIrreversible")}</p>
        </div>`,
      yes: { icon: "<i class='fa-solid fa-trash'></i>", label: game.i18n.localize("FVN.Delete") },
      no: { label: game.i18n.localize("FVN.Cancel") },
      modal: true
    });
    if (!confirmed) return;

    const remainingTabs = tabs.filter((entry) => entry.id !== tab.id);
    const nextLibrary = library.filter((character) => character.tabId !== tab.id);
    const bindings = this.getSceneBindings();
    for (const [sceneId, ids] of Object.entries(bindings)) {
      const next = (Array.isArray(ids) ? ids : []).filter((id) => id !== tab.id);
      if (next.length) bindings[sceneId] = next;
      else delete bindings[sceneId];
    }

    const state = VisualNovelAPI.getState();
    const nextPortraits = state.portraits.filter((portrait) => !characterIds.has(String(portrait.characterId ?? portrait.id)));
    const stageChanged = nextPortraits.length !== state.portraits.length;
    state.portraits = nextPortraits;

    await game.settings.set(MODULE_ID, SCENE_BINDINGS_SETTING, bindings);
    await this.setTabs(remainingTabs);
    await this.setLibrary(nextLibrary);
    if (stageChanged) await VisualNovelAPI.commitState(state);

    this.currentTabId = remainingTabs[0]?.id ?? null;
    this.closeEditor();
    await this.renderTabs();
    await this.renderCharacters();
    VisualNovelScenePalette.render();
    ui.notifications.info(game.i18n.format("FVN.TabDeleted", { count: characterIds.size }));
  }

  static getSceneBindings() {
    const raw = game.settings.get(MODULE_ID, SCENE_BINDINGS_SETTING);
    return raw && typeof raw === "object" && !Array.isArray(raw) ? foundry.utils.deepClone(raw) : {};
  }

  static getSceneBindingCount(tabId) {
    const bindings = this.getSceneBindings();
    return Object.values(bindings).filter((ids) => Array.isArray(ids) && ids.includes(tabId)).length;
  }

  static openSceneBindingEditor() {
    const form = this.panel?.querySelector("[data-region='scene-binding-editor']");
    if (!form || !this.currentTabId) return;
    const tab = this.getTabs().find((entry) => entry.id === this.currentTabId);
    const bindings = this.getSceneBindings();
    const scenes = game.scenes?.contents ?? [];
    form.querySelector("[data-region='binding-title']").textContent = game.i18n.format("FVN.BindingTitle", { name: tab?.name ?? "" });
    form.querySelector("[data-region='binding-scenes']").innerHTML = scenes.length ? scenes.map((scene) => {
      const checked = Array.isArray(bindings[scene.id]) && bindings[scene.id].includes(this.currentTabId);
      return `<label class="fvn-scene-binding-row"><input type="checkbox" name="sceneIds" value="${scene.id}" ${checked ? "checked" : ""}/><span>${VisualNovelAPI.escapeHtml(scene.name)}</span>${canvas?.scene?.id === scene.id ? `<em>${game.i18n.localize("FVN.CurrentScene")}</em>` : ""}</label>`;
    }).join("") : `<div class="fvn-empty">${game.i18n.localize("FVN.NoScenes")}</div>`;
    form.classList.remove("fvn-scene-binding-editor--hidden");
  }

  static closeSceneBindingEditor() {
    this.panel?.querySelector("[data-region='scene-binding-editor']")?.classList.add("fvn-scene-binding-editor--hidden");
  }

  static async saveSceneBindings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const selected = new Set([...form.querySelectorAll('input[name="sceneIds"]:checked')].map((input) => input.value));
    const bindings = this.getSceneBindings();
    for (const scene of game.scenes?.contents ?? []) {
      const current = new Set(Array.isArray(bindings[scene.id]) ? bindings[scene.id] : []);
      if (selected.has(scene.id)) current.add(this.currentTabId);
      else current.delete(this.currentTabId);
      if (current.size) bindings[scene.id] = [...current];
      else delete bindings[scene.id];
    }
    await game.settings.set(MODULE_ID, SCENE_BINDINGS_SETTING, bindings);
    this.closeSceneBindingEditor();
    await this.renderTabs();
    VisualNovelScenePalette.render();
    ui.notifications.info(game.i18n.localize("FVN.SceneBindingsSaved"));
  }

  static getLibrary() {
    const library = game.settings.get(MODULE_ID, LIBRARY_SETTING);
    return Array.isArray(library) ? library : [];
  }

  static async setLibrary(library) {
    await game.settings.set(MODULE_ID, LIBRARY_SETTING, library);
    VisualNovelScenePalette.render();
  }

  static getPool() {
    const pool = game.settings.get(MODULE_ID, POOL_SETTING);
    return Array.isArray(pool) ? pool : [];
  }

  static async setPool(pool) {
    await game.settings.set(MODULE_ID, POOL_SETTING, pool);
  }

  static setViewMode(mode) {
    this.viewMode = mode === "pool" ? "pool" : "tabs";
    this.closePoolPicker();
    this.closeEditor();
    this.updateViewMode();
    void this.renderCharacters();
  }

  static updateViewMode() {
    if (!this.panel) return;
    const poolMode = this.viewMode === "pool";
    this.panel.classList.toggle("fvn-director--pool-mode", poolMode);
    this.panel.querySelector('[data-action="view-tabs"]')?.classList.toggle("is-active", !poolMode);
    this.panel.querySelector('[data-action="view-pool"]')?.classList.toggle("is-active", poolMode);
    const label = this.panel.querySelector('[data-region="new-character-label"]');
    if (label) label.textContent = game.i18n.localize("FVN.NewPoolCharacter");
  }

  static getCoordinates(character = {}) {
    if (Number.isFinite(Number(character.x)) && Number.isFinite(Number(character.y))) {
      return { x: Number(character.x), y: Number(character.y) };
    }
    return { x: ({ left: 0.18, center: 0.5, right: 0.82 })[character.position] ?? 0.18, y: 1 };
  }

  static getVisibleIds() {
    const state = VisualNovelStage.normalizeStageState(game.settings.get(MODULE_ID, STATE_SETTING));
    return new Set(state.portraits.map((portrait) => String(portrait.characterId ?? portrait.id)));
  }

  static formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return game.i18n.localize("FVN.UnknownSize");
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
  }

  static performanceLevel(score) {
    if (score < 30) return "green";
    if (score < 55) return "yellow";
    if (score < 78) return "orange";
    return "red";
  }

  static performanceLabel(level) {
    return game.i18n.localize({
      green: "FVN.PerformanceLight",
      yellow: "FVN.PerformanceMedium",
      orange: "FVN.PerformanceHeavy",
      red: "FVN.PerformanceVeryHeavy"
    }[level]);
  }

  static async getAssetMetrics(path) {
    const src = String(path || "").trim();
    if (!src) return { src, width: 0, height: 0, decodedBytes: 0, fileBytes: 0, format: "-", error: true };
    if (this.assetMetricsCache.has(src)) return this.assetMetricsCache.get(src);

    const promise = (async () => {
      const dimensions = await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
        image.onerror = () => resolve({ width: 0, height: 0 });
        image.src = src;
      });
      let fileBytes = 0;
      try {
        const response = await fetch(src, { method: "HEAD", cache: "force-cache" });
        fileBytes = Number(response.headers.get("content-length")) || 0;
      } catch (_error) { fileBytes = 0; }
      const clean = src.split(/[?#]/)[0];
      const extension = clean.includes(".") ? clean.split(".").pop().toUpperCase() : "-";
      return {
        src,
        width: dimensions.width,
        height: dimensions.height,
        decodedBytes: dimensions.width * dimensions.height * 4,
        fileBytes,
        format: extension,
        error: !dimensions.width || !dimensions.height
      };
    })();
    this.assetMetricsCache.set(src, promise);
    return promise;
  }

  static characterPerformance(metrics) {
    const decodedMB = metrics.decodedBytes / 1048576;
    const megapixels = (metrics.width * metrics.height) / 1000000;
    const score = Math.min(100, decodedMB * 1.45 + Math.max(0, megapixels - 4) * 3);
    return { score, level: this.performanceLevel(score) };
  }

  static characterPerformanceTooltip(character, metrics) {
    const perf = this.characterPerformance(metrics);
    return [
      `${this.performanceLabel(perf.level)}`,
      `${game.i18n.localize("FVN.FileSize")}: ${this.formatBytes(metrics.fileBytes)}`,
      `${game.i18n.localize("FVN.ImageDimensions")}: ${metrics.width || "?"} × ${metrics.height || "?"} px`,
      `${game.i18n.localize("FVN.EstimatedTextureMemory")}: ${this.formatBytes(metrics.decodedBytes)}`,
      `${game.i18n.localize("FVN.Format")}: ${metrics.format}`
    ].join("\n");
  }

  static async updatePresetPerformance(characters = null) {
    if (!this.panel?.isConnected || this.viewMode !== "tabs") return;
    const token = ++this.performanceRefreshToken;
    const tabs = this.ensureCurrentTab();
    const fallbackTabId = tabs[0]?.id ?? null;
    const presetCharacters = characters ?? this.getLibrary()
      .map((character) => ({ ...character, tabId: character.tabId ?? fallbackTabId }))
      .filter((character) => character.tabId === this.currentTabId);
    const state = VisualNovelAPI.getState();
    const visibleIds = new Set(state.portraits.map((portrait) => String(portrait.characterId ?? portrait.id)));
    const records = await Promise.all(presetCharacters.map(async (character) => ({
      character,
      metrics: await this.getAssetMetrics(this.getDisplayImage(character))
    })));
    if (token !== this.performanceRefreshToken || !this.panel?.isConnected) return;

    let totalDecoded = 0;
    let visibleDecoded = 0;
    let transfer = 0;
    let unknownFiles = 0;
    for (const record of records) {
      totalDecoded += record.metrics.decodedBytes;
      transfer += record.metrics.fileBytes;
      if (!record.metrics.fileBytes) unknownFiles += 1;
      if (visibleIds.has(String(record.character.id))) visibleDecoded += record.metrics.decodedBytes;
      const dot = this.panel.querySelector(`.fvn-performance-dot[data-character-id="${CSS.escape(String(record.character.id))}"]`);
      if (dot) {
        const perf = this.characterPerformance(record.metrics);
        dot.dataset.level = perf.level;
        dot.title = this.characterPerformanceTooltip(record.character, record.metrics);
        dot.setAttribute("aria-label", dot.title);
      }
    }

    const visibleCount = presetCharacters.filter((character) => visibleIds.has(String(character.id))).length;
    const textureMB = visibleDecoded / 1048576;
    const totalTextureMB = totalDecoded / 1048576;
    const effect = state.backgroundEffect;
    const intensityFactor = { small: 4, medium: 9, large: 16 }[state.backgroundIntensity] ?? 9;
    const effectPoints = effect === "blur" ? intensityFactor : effect === "focus" ? intensityFactor + 4 : effect === "dim" ? 1 : 0;
    const cameraPoints = state.camera?.enabled ? 4 : 0;
    const countPoints = Math.max(0, visibleCount - 2) * 4;
    const score = Math.min(100, textureMB * 0.42 + effectPoints + cameraPoints + countPoints);
    const level = this.performanceLevel(score);

    const root = this.panel.querySelector('[data-region="preset-performance"]');
    if (!root) return;
    root.dataset.level = level;
    const meter = root.querySelector(".fvn-performance-bar");
    meter?.setAttribute("aria-valuenow", String(Math.round(score)));
    const fill = root.querySelector('[data-region="performance-fill"]');
    if (fill) fill.style.width = `${Math.max(3, score)}%`;
    const label = root.querySelector('[data-region="performance-label"]');
    if (label) label.textContent = `${this.performanceLabel(level)} · ${Math.round(score)}/100`;
    const summary = root.querySelector('[data-region="performance-summary"]');
    if (summary) summary.textContent = game.i18n.format("FVN.PerformanceSummary", {
      visible: visibleCount,
      total: presetCharacters.length,
      active: this.formatBytes(visibleDecoded),
      stored: this.formatBytes(totalDecoded),
      transfer: unknownFiles === records.length && records.length ? game.i18n.localize("FVN.UnknownSize") : this.formatBytes(transfer)
    });

    const largest = [...records].sort((a, b) => b.metrics.decodedBytes - a.metrics.decodedBytes)[0];
    let messageKey = "FVN.StatusHealthy";
    let data = {};
    if (!presetCharacters.length) messageKey = "FVN.StatusEmpty";
    else if (level === "red") messageKey = "FVN.StatusCritical";
    else if (level === "orange") messageKey = "FVN.StatusHeavy";
    else if (largest && largest.metrics.width * largest.metrics.height > 12000000) {
      messageKey = "FVN.StatusLargeImage";
      data = { name: largest.character.name, width: largest.metrics.width, height: largest.metrics.height };
    } else if ((effect === "blur" || effect === "focus") && state.backgroundIntensity === "large") messageKey = "FVN.StatusBlurAdvice";
    else if (visibleCount > 5) messageKey = "FVN.StatusManyVisible";
    else if (totalTextureMB > 180 && textureMB < 80) messageKey = "FVN.StatusGoodVisibility";

    const status = this.panel.querySelector('[data-region="preset-status"]');
    if (status) {
      status.dataset.level = level;
      const text = status.querySelector("span");
      if (text) text.textContent = game.i18n.format(messageKey, data);
    }
  }

  static async renderCharacters() {
    if (!this.panel?.isConnected) return;
    this.updateViewMode();
    if (this.viewMode === "pool") return this.renderPoolCharacters();
    const query = this.panel.querySelector("[data-field='search']").value.trim().toLocaleLowerCase();
    const tabs = this.ensureCurrentTab();
    const fallbackTabId = tabs[0]?.id ?? null;
    const library = this.getLibrary()
      .map((character) => ({ ...character, tabId: character.tabId ?? fallbackTabId }))
      .filter((character) => character.tabId === this.currentTabId)
      .filter((character) => character.name.toLocaleLowerCase().includes(query));
    const visibleIds = this.getVisibleIds();
    const filteredLibrary = this.visibleOnly
      ? library.filter((character) => visibleIds.has(String(character.id)))
      : library;
    const list = this.panel.querySelector("[data-region='character-list']");

    this.updateToolbarState();
    this.updateFooterState();
    void this.updatePresetPerformance(library);

    if (!filteredLibrary.length) {
      const emptyKey = this.visibleOnly ? "FVN.NoVisibleCharacters" : (query ? "FVN.NoResults" : "FVN.EmptyLibrary");
      list.innerHTML = `<div class="fvn-empty">${game.i18n.localize(emptyKey)}</div>`;
      return;
    }

    list.innerHTML = filteredLibrary.map((character) => {
      const { x, y } = this.getCoordinates(character);
      const visible = visibleIds.has(String(character.id));
      return `
        <article class="fvn-character ${visible ? "fvn-character--visible" : ""}" data-character-id="${character.id}">
          <span class="fvn-character__drag-handle" title="${game.i18n.localize("FVN.ReorderLayer")}"><i class="fa-solid fa-grip-vertical"></i></span>
          <span class="fvn-performance-dot" data-character-id="${character.id}" data-level="loading" title="${game.i18n.localize("FVN.PerformanceCalculating")}" aria-label="${game.i18n.localize("FVN.PerformanceCalculating")}"></span>
          <button type="button" class="fvn-character__thumb" data-action="toggle" title="${visible ? game.i18n.localize("FVN.Hide") : game.i18n.localize("FVN.Show")}">
            <span class="fvn-checkerboard"><img src="${this.getDisplayImage(character)}" alt="${VisualNovelAPI.escapeHtml(character.name)}" /></span>
          </button>
          <button type="button" class="fvn-character__info" data-action="toggle" title="${visible ? game.i18n.localize("FVN.Hide") : game.i18n.localize("FVN.Show")}">
            <span class="fvn-character__title"><strong>${VisualNovelAPI.escapeHtml(character.name)}</strong>${visible ? `<em><i class="fa-solid fa-circle"></i> ${game.i18n.localize("FVN.OnStage")}</em>` : ""}</span>
            <span>${Math.round(character.scale * 100)}% · X ${Math.round(x * 100)} · Y ${Math.round(y * 100)}</span>
          </button>
          ${this.variantOptions(character)}
          <div class="fvn-character__actions">
            <button type="button" data-action="toggle" class="${visible ? "is-active" : ""}" title="${visible ? game.i18n.localize("FVN.Hide") : game.i18n.localize("FVN.Show")}"><i class="fa-solid ${visible ? "fa-eye-slash" : "fa-eye"}"></i></button>
            <button type="button" data-action="edit" title="${game.i18n.localize("FVN.Edit")}"><i class="fa-solid fa-pen"></i></button>
            <button type="button" data-action="delete" title="${game.i18n.localize("FVN.Delete")}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </article>`;
    }).join("");
  }

  static async renderPoolCharacters() {
    const query = this.panel.querySelector("[data-field='search']").value.trim().toLocaleLowerCase();
    const pool = this.getPool().filter((character) => character.name.toLocaleLowerCase().includes(query));
    const list = this.panel.querySelector("[data-region='character-list']");
    this.updateToolbarState();
    this.updateFooterState();
    if (!pool.length) {
      list.innerHTML = `<div class="fvn-empty">${game.i18n.localize(query ? "FVN.NoResults" : "FVN.EmptyPool")}</div>`;
      return;
    }
    list.innerHTML = pool.map((character) => {
      const copies = this.getLibrary().filter((entry) => entry.sourceId === character.id).length;
      return `<article class="fvn-character fvn-character--pool" data-character-id="${character.id}">
        <span class="fvn-character__pool-icon"><i class="fa-solid fa-address-card"></i></span>
        <div class="fvn-character__thumb"><span class="fvn-checkerboard"><img src="${this.getDisplayImage(character)}" alt="${VisualNovelAPI.escapeHtml(character.name)}" /></span></div>
        <div class="fvn-character__info"><span class="fvn-character__title"><strong>${VisualNovelAPI.escapeHtml(character.name)}</strong></span><span>${game.i18n.format("FVN.PoolCopies", { count: copies })}${character.variants?.length ? ` · ${game.i18n.format("FVN.VariantCount", { count: character.variants.length })}` : ""}</span></div>
        <div class="fvn-character__actions">
          <button type="button" data-action="edit" title="${game.i18n.localize("FVN.Edit")}"><i class="fa-solid fa-pen"></i></button>
          <button type="button" data-action="delete" title="${game.i18n.localize("FVN.Delete")}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </article>`;
    }).join("");
  }

  static openPoolPicker() {
    const picker = this.panel?.querySelector("[data-region='pool-picker']");
    if (!picker) return;
    picker.classList.remove("fvn-pool-picker--hidden");
    picker.querySelector('[data-field="pool-search"]').value = "";
    this.renderPoolPicker();
  }

  static closePoolPicker() {
    this.panel?.querySelector("[data-region='pool-picker']")?.classList.add("fvn-pool-picker--hidden");
  }

  static renderPoolPicker() {
    const picker = this.panel?.querySelector("[data-region='pool-picker']");
    if (!picker || picker.classList.contains("fvn-pool-picker--hidden")) return;
    const query = picker.querySelector('[data-field="pool-search"]').value.trim().toLocaleLowerCase();
    const pool = this.getPool().filter((character) => character.name.toLocaleLowerCase().includes(query));
    const list = picker.querySelector('[data-region="pool-picker-list"]');
    list.innerHTML = pool.length ? pool.map((character) => `<label class="fvn-pool-choice">
      <input type="checkbox" name="poolCharacter" value="${character.id}" />
      <span class="fvn-checkerboard"><img src="${this.getDisplayImage(character)}" alt="${VisualNovelAPI.escapeHtml(character.name)}" /></span>
      <strong>${VisualNovelAPI.escapeHtml(character.name)}</strong>
    </label>`).join("") : `<div class="fvn-empty">${game.i18n.localize("FVN.EmptyPool")}</div>`;
  }

  static async addSelectedFromPool() {
    const picker = this.panel?.querySelector("[data-region='pool-picker']");
    if (!picker) return;
    const ids = [...picker.querySelectorAll('input[name="poolCharacter"]:checked')].map((input) => input.value);
    if (!ids.length) return ui.notifications.warn(game.i18n.localize("FVN.SelectPoolCharacters"));
    const pool = this.getPool();
    const library = this.getLibrary();
    for (const id of ids) {
      const original = pool.find((entry) => entry.id === id);
      if (!original) continue;
      library.push({ ...foundry.utils.deepClone(original), id: foundry.utils.randomID(), sourceId: original.id, tabId: this.currentTabId });
    }
    await this.setLibrary(library);
    this.closePoolPicker();
    await this.renderCharacters();
    ui.notifications.info(game.i18n.format("FVN.AddedFromPool", { count: ids.length }));
  }

  static startCharacterLayerPointerDrag(event) {
    const handle = event.target.closest(".fvn-character__drag-handle");
    const card = handle?.closest("[data-character-id]");
    if (!card || event.button !== 0) return;

    event.preventDefault();
    this.layerDragId = card.dataset.characterId;
    this.layerDragTargetId = null;
    this.layerDragBefore = true;
    card.classList.add("fvn-character--dragging-layer");
    document.documentElement.classList.add("fvn-document--layer-dragging");

    const move = (moveEvent) => this.updateCharacterLayerPointerDrag(moveEvent);
    const up = async (upEvent) => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      if (this.layerDragTargetId && this.layerDragTargetId !== this.layerDragId) {
        await this.reorderCharacterLayer(this.layerDragId, this.layerDragTargetId, this.layerDragBefore);
      }
      this.endCharacterLayerDrag();
    };

    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
  }

  static updateCharacterLayerPointerDrag(event) {
    if (!this.layerDragId) return;
    event.preventDefault();
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const card = element?.closest?.("[data-character-id]");

    for (const entry of this.panel?.querySelectorAll(".fvn-character--drop-before, .fvn-character--drop-after") ?? []) {
      entry.classList.remove("fvn-character--drop-before", "fvn-character--drop-after");
    }

    if (!card || card.dataset.characterId === this.layerDragId || !this.panel.contains(card)) {
      this.layerDragTargetId = null;
      return;
    }

    const rect = card.getBoundingClientRect();
    this.layerDragTargetId = card.dataset.characterId;
    this.layerDragBefore = event.clientY < rect.top + (rect.height / 2);
    card.classList.add(this.layerDragBefore ? "fvn-character--drop-before" : "fvn-character--drop-after");
  }

  static endCharacterLayerDrag() {
    this.layerDragId = null;
    this.layerDragTargetId = null;
    document.documentElement.classList.remove("fvn-document--layer-dragging");
    for (const card of this.panel?.querySelectorAll(".fvn-character--dragging-layer, .fvn-character--drop-before, .fvn-character--drop-after") ?? []) {
      card.classList.remove("fvn-character--dragging-layer", "fvn-character--drop-before", "fvn-character--drop-after");
    }
  }

  static async reorderCharacterLayer(draggedId, targetId, before) {
    const library = this.getLibrary();
    const draggedIndex = library.findIndex((entry) => String(entry.id) === String(draggedId));
    const targetIndex = library.findIndex((entry) => String(entry.id) === String(targetId));
    if (draggedIndex < 0 || targetIndex < 0) return;

    const [dragged] = library.splice(draggedIndex, 1);
    let insertionIndex = library.findIndex((entry) => String(entry.id) === String(targetId));
    if (!before) insertionIndex += 1;
    library.splice(insertionIndex, 0, dragged);
    await this.setLibrary(library);

    const state = VisualNovelAPI.getState();
    const order = new Map(library.map((entry, index) => [String(entry.id), index]));
    state.portraits.sort((a, b) => {
      const aIndex = order.get(String(a.characterId ?? a.id));
      const bIndex = order.get(String(b.characterId ?? b.id));
      return (aIndex ?? Number.MAX_SAFE_INTEGER) - (bIndex ?? Number.MAX_SAFE_INTEGER);
    });
    await VisualNovelAPI.commitState(state);
  }

  static toggleVisibleFilter() {
    this.visibleOnly = !this.visibleOnly;
    void this.renderCharacters();
  }

  static updateToolbarState() {
    const button = this.panel?.querySelector('[data-action="filter-visible"]');
    if (!button) return;
    const poolMode = this.viewMode === "pool";
    button.hidden = poolMode;
    const addButton = this.panel?.querySelector('[data-action="add-from-pool"]');
    if (addButton) addButton.hidden = poolMode;
    const newButton = this.panel?.querySelector('[data-action="new-character"]');
    if (newButton) newButton.hidden = !poolMode;
    button.classList.toggle("is-active", this.visibleOnly);
    button.setAttribute("aria-pressed", String(this.visibleOnly));
  }

  static updateFooterState() {
    const button = this.panel?.querySelector('[data-action="toggle-dim"]');
    if (!button) return;
    const state = VisualNovelAPI.getState();
    const effectiveDimmed = state.dimMode === "auto" ? state.portraits.length > 0 : state.dimmed;
    button.classList.toggle("is-active", effectiveDimmed);
    button.classList.toggle("is-disabled", state.dimMode === "auto");
    button.disabled = state.dimMode === "auto";
    button.setAttribute("aria-pressed", String(effectiveDimmed));
    const label = button.querySelector("span");
    if (label) label.textContent = game.i18n.localize(effectiveDimmed ? "FVN.RestoreBackground" : "FVN.DimBackground");
    const mode = this.panel?.querySelector('[data-action="dim-mode"]');
    const effect = this.panel?.querySelector('[data-action="background-effect"]');
    const intensity = this.panel?.querySelector('[data-action="background-intensity"]');
    if (mode) mode.value = state.dimMode;
    if (effect) effect.value = state.backgroundEffect;
    if (intensity) intensity.value = state.backgroundIntensity;
    const resetCameraButton = this.panel?.querySelector('[data-action="reset-camera"]');
    if (resetCameraButton) resetCameraButton.disabled = !state.camera?.enabled;
    const namesButton = this.panel?.querySelector('[data-action="toggle-names"]');
    if (namesButton) {
      namesButton.classList.toggle("is-active", state.namesVisible);
      namesButton.setAttribute("aria-pressed", String(state.namesVisible));
      const label = namesButton.querySelector("span");
      if (label) label.textContent = game.i18n.localize(state.namesVisible ? "FVN.HideNames" : "FVN.ShowNames");
    }
    const toggleAllButton = this.panel?.querySelector('[data-action="toggle-all"]');
    if (toggleAllButton) {
      const hasVisible = state.portraits.length > 0;
      toggleAllButton.classList.toggle("fvn-danger", hasVisible);
      toggleAllButton.classList.toggle("fvn-show-all", !hasVisible);
      const icon = toggleAllButton.querySelector("i");
      const label = toggleAllButton.querySelector("span");
      if (icon) icon.className = hasVisible ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
      if (label) label.textContent = game.i18n.localize(hasVisible ? "FVN.HideAll" : "FVN.ShowAll");
    }
  }

  static async toggleCharacter(characterId) {
    const visible = this.getVisibleIds().has(String(characterId));
    if (visible) await VisualNovelAPI.hide(characterId);
    else await this.showCharacter(characterId);
  }

  static openEditor(character = null, { pool = false } = {}) {
    // Always return to the untransformed Home View before editing a Zoom Frame.
    // This keeps the frame at a usable size and makes its preview independent
    // from any camera focus that was active during play.
    void VisualNovelAPI.resetCamera();

    this.editingPoolId = pool ? (character?.id ?? null) : null;
    this.editingId = pool ? null : (character?.id ?? null);
    this.enterEditorMode();
    const editor = this.panel.querySelector("[data-region='editor']");
    const { x, y } = this.getCoordinates(character ?? {});
    editor.classList.remove("fvn-editor--hidden");
    editor.querySelector("[data-region='editor-title']").textContent = game.i18n.localize(pool ? (character ? "FVN.EditPoolCharacter" : "FVN.NewPoolCharacter") : (character ? "FVN.EditCharacter" : "FVN.NewCharacter"));
    editor.querySelector('[data-region="editor-tab-field"]').hidden = pool;
    editor.elements.name.value = character?.name ?? "";
    editor.elements.image.value = character?.image ?? "";
    this.renderVariantRows(character?.variants ?? []);
    this.renderTabs();
    editor.elements.tabId.value = character?.tabId ?? this.currentTabId ?? this.getTabs()[0]?.id ?? "";
    editor.elements.scale.value = character?.scale ?? 1;
    editor.elements.mirror.checked = character?.mirror ?? false;
    editor.elements.focusX.value = character?.focusX ?? 0.5;
    editor.elements.focusY.value = character?.focusY ?? 0.28;
    editor.elements.focusZoom.value = character?.focusZoom ?? 1.65;
    this.updateFocusOutput(editor);
    this.updateScaleOutput(editor);
    editor.elements.x.value = x;
    editor.elements.y.value = y;
    this.updatePositionOutput(editor);
    this.updateScenePreview();
    editor.elements.name.focus();
  }

  static renderVariantRows(variants = []) {
    const list = this.panel?.querySelector("[data-region='variant-list']");
    if (!list) return;
    list.innerHTML = "";
    for (const variant of variants) this.addVariantRow(variant);
    if (!variants.length) list.innerHTML = `<p class="fvn-variants-editor__empty">${game.i18n.localize("FVN.NoVariants")}</p>`;
  }

  static addVariantRow(variant = {}) {
    const list = this.panel?.querySelector("[data-region='variant-list']");
    if (!list) return;
    list.querySelector(".fvn-variants-editor__empty")?.remove();
    const row = document.createElement("div");
    row.className = "fvn-variant-row";
    row.dataset.variantRow = "";
    row.dataset.variantId = variant.id ?? foundry.utils.randomID();
    row.innerHTML = `
      <input type="text" data-variant-field="name" value="${VisualNovelAPI.escapeHtml(variant.name ?? "")}" placeholder="${game.i18n.localize("FVN.VariantName")}" />
      <div class="fvn-file-row">
        <input type="text" data-variant-field="image" value="${VisualNovelAPI.escapeHtml(variant.image ?? "")}" placeholder="${game.i18n.localize("FVN.ImagePath")}" />
        <button type="button" data-action="browse-variant" title="${game.i18n.localize("FVN.Browse")}"><i class="fa-solid fa-folder-open"></i></button>
      </div>
      <button type="button" data-action="delete-variant" class="fvn-danger-icon" title="${game.i18n.localize("FVN.Delete")}"><i class="fa-solid fa-trash"></i></button>`;
    list.appendChild(row);
  }

  static browseVariantImage(row) {
    const input = row?.querySelector("[data-variant-field='image']");
    if (!input) return;
    this.openImagePicker(input);
  }

  static collectVariants(form) {
    return [...form.querySelectorAll("[data-variant-row]")].map((row) => ({
      id: row.dataset.variantId || foundry.utils.randomID(),
      name: row.querySelector("[data-variant-field='name']")?.value.trim() ?? "",
      image: row.querySelector("[data-variant-field='image']")?.value.trim() ?? ""
    })).filter((variant) => variant.name && variant.image);
  }

  static getDisplayImage(character) {
    const variant = (character?.variants ?? []).find((entry) => String(entry.id) === String(character?.activeVariantId));
    return variant?.image || character?.image || "";
  }

  static variantOptions(character) {
    if (!Array.isArray(character?.variants) || !character.variants.length) return "";
    const options = [`<option value="">${game.i18n.localize("FVN.MainImage")}</option>`, ...character.variants.map((variant) =>
      `<option value="${variant.id}" ${String(character.activeVariantId) === String(variant.id) ? "selected" : ""}>${VisualNovelAPI.escapeHtml(variant.name)}</option>`
    )].join("");
    return `<label class="fvn-variant-select"><i class="fa-solid fa-masks-theater"></i><select data-action="select-variant" title="${game.i18n.localize("FVN.SelectVariant")}">${options}</select></label>`;
  }

  static async setCharacterVariant(characterId, variantId) {
    const library = this.getLibrary();
    const index = library.findIndex((entry) => String(entry.id) === String(characterId));
    if (index < 0) return;
    const character = library[index];
    character.activeVariantId = (character.variants ?? []).some((entry) => String(entry.id) === String(variantId)) ? variantId : null;
    library[index] = character;
    await this.setLibrary(library);
    if (this.getVisibleIds().has(String(characterId))) await VisualNovelAPI.show(character);
    else {
      await this.renderCharacters();
      VisualNovelScenePalette.render();
    }
  }

  static closeEditor() {
    VisualNovelStage.hidePreview();
    this.editingId = null;
    this.editingPoolId = null;
    const editor = this.panel.querySelector("[data-region='editor']");
    editor.reset();
    editor.classList.add("fvn-editor--hidden");
    this.exitEditorMode();
  }

  static enterEditorMode() {
    if (!this.panel || this.panel.classList.contains("fvn-director--editor-mode")) return;
    const rect = this.panel.getBoundingClientRect();
    this.editorLayout = {
      width: this.panel.style.width,
      height: this.panel.style.height,
      left: this.panel.style.left,
      top: this.panel.style.top,
      right: this.panel.style.right,
      rectWidth: rect.width,
      rectHeight: rect.height
    };
    this.panel.classList.add("fvn-director--editor-mode");
    const compactWidth = Math.min(720, Math.max(520, window.innerWidth - 32));
    const compactHeight = Math.min(760, Math.max(420, window.innerHeight - 32));
    this.panel.style.width = `${compactWidth}px`;
    this.panel.style.height = `${compactHeight}px`;
    const current = this.panel.getBoundingClientRect();
    const left = Math.min(Math.max(8, current.left), Math.max(8, window.innerWidth - compactWidth - 8));
    const top = Math.min(Math.max(8, current.top), Math.max(8, window.innerHeight - compactHeight - 8));
    this.panel.style.left = `${left}px`;
    this.panel.style.top = `${top}px`;
    this.panel.style.right = "auto";
  }

  static exitEditorMode() {
    if (!this.panel) return;
    this.panel.classList.remove("fvn-director--editor-mode");
    const layout = this.editorLayout;
    this.editorLayout = null;
    if (!layout) return;
    this.panel.style.width = layout.width;
    this.panel.style.height = layout.height;
    this.panel.style.left = layout.left;
    this.panel.style.top = layout.top;
    this.panel.style.right = layout.right;
  }

  static updateScenePreview() {
    const editor = this.panel?.querySelector("[data-region='editor']");
    if (!editor || editor.classList.contains("fvn-editor--hidden")) return;

    const preview = {
      id: this.editingId ?? VisualNovelStage.previewId,
      characterId: this.editingId ?? VisualNovelStage.previewId,
      name: editor.elements.name.value.trim(),
      image: editor.elements.image.value.trim(),
      x: Math.min(1, Math.max(0, Number(editor.elements.x.value) || 0)),
      y: Math.min(1, Math.max(0, Number(editor.elements.y.value) || 0)),
      scale: Math.min(3, Math.max(0.25, Number(editor.elements.scale.value) || 1)),
      mirror: editor.elements.mirror.checked,
      focusX: Math.min(1, Math.max(0, Number(editor.elements.focusX.value) || 0.5)),
      focusY: Math.min(1, Math.max(0, Number(editor.elements.focusY.value) || 0.28)),
      focusZoom: Math.min(3.3333, Math.max(0.8, Number(editor.elements.focusZoom.value) || 1.65))
    };

    VisualNovelStage.showPreview(preview, ({ x, y, scale, focusX, focusY, focusZoom }) => {
      if (Number.isFinite(x)) editor.elements.x.value = x.toFixed(4);
      if (Number.isFinite(y)) editor.elements.y.value = y.toFixed(4);
      if (Number.isFinite(scale)) editor.elements.scale.value = scale.toFixed(2);
      if (Number.isFinite(focusX)) editor.elements.focusX.value = focusX.toFixed(4);
      if (Number.isFinite(focusY)) editor.elements.focusY.value = focusY.toFixed(4);
      if (Number.isFinite(focusZoom)) editor.elements.focusZoom.value = focusZoom.toFixed(4);
      this.updatePositionOutput(editor);
      this.updateScaleOutput(editor);
      this.updateFocusOutput(editor);
    });
    this.updatePositionOutput(editor);
    this.updateScaleOutput(editor);
    this.updateFocusOutput(editor);
  }

  static updateFocusOutput(editor) {
    const focusX = Math.min(1, Math.max(0, Number(editor.elements.focusX?.value) || 0.5));
    const focusY = Math.min(1, Math.max(0, Number(editor.elements.focusY?.value) || 0.28));
    const focusZoom = Math.min(3.3333, Math.max(0.8, Number(editor.elements.focusZoom?.value) || 1.65));
    const xOut = editor.querySelector('[data-region="focus-x-output"]');
    const yOut = editor.querySelector('[data-region="focus-y-output"]');
    const zOut = editor.querySelector('[data-region="focus-zoom-output"]');
    if (xOut) xOut.textContent = `${Math.round(focusX * 100)}%`;
    if (yOut) yOut.textContent = `${Math.round(focusY * 100)}%`;
    if (zOut) zOut.textContent = `${Math.round(focusZoom * 100)}%`;
  }

  static updateScaleOutput(editor) {
    const scale = Math.min(3, Math.max(0.25, Number(editor.elements.scale.value) || 1));
    const output = editor.querySelector("[data-region='scale-output']");
    if (output) output.textContent = `${Math.round(scale * 100)}%`;
  }

  static updatePositionOutput(editor) {
    const x = Math.min(1, Math.max(0, Number(editor.elements.x.value) || 0));
    const y = Math.min(1, Math.max(0, Number(editor.elements.y.value) || 0));
    editor.querySelector("[data-region='position-output']").textContent = `X ${Math.round(x * 100)}% · Y ${Math.round(y * 100)}%`;
  }

  static browseImage() {
    const input = this.panel.querySelector("[name='image']");
    this.openImagePicker(input);
  }

  static openImagePicker(input) {
    if (!input) return;

    const panel = this.panel;
    const pickerLayout = panel ? {
      width: panel.style.width,
      left: panel.style.left,
      top: panel.style.top,
      right: panel.style.right,
      zIndex: panel.style.zIndex
    } : null;

    const restoreDirector = () => {
      if (!panel || !pickerLayout) return;
      panel.classList.remove("fvn-director--picker-open");
      panel.style.width = pickerLayout.width;
      panel.style.left = pickerLayout.left;
      panel.style.top = pickerLayout.top;
      panel.style.right = pickerLayout.right;
      panel.style.zIndex = pickerLayout.zIndex;
    };

    const FilePickerClass = foundry?.applications?.apps?.FilePicker ?? globalThis.FilePicker;
    if (!FilePickerClass) {
      ui.notifications.error("Foundry Visual Novel: FilePicker API unavailable.");
      restoreDirector();
      return;
    }

    const picker = new FilePickerClass({
      type: "image",
      current: input.value,
      callback: (path) => {
        input.value = path;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    if (panel) {
      const rect = panel.getBoundingClientRect();
      panel.classList.add("fvn-director--picker-open");
      panel.style.width = `${Math.min(500, Math.max(420, window.innerWidth * 0.38))}px`;
      panel.style.left = "8px";
      panel.style.right = "auto";
      panel.style.top = `${Math.min(Math.max(8, rect.top), Math.max(8, window.innerHeight - 440))}px`;
      panel.style.zIndex = "90";
    }

    const originalClose = picker.close?.bind(picker);
    if (originalClose) {
      picker.close = async (...args) => {
        restoreDirector();
        return originalClose(...args);
      };
    }

    Hooks.once("renderFilePicker", (app, html) => {
      if (app !== picker) return;
      window.setTimeout(() => {
        app.bringToFront?.();
        const candidate = html?.[0] ?? app.element?.[0] ?? app.element ?? document.getElementById(app.id);
        const element = candidate instanceof HTMLElement ? candidate : candidate?.[0];
        if (element?.style) element.style.zIndex = "1000";
      }, 0);
    });

    picker.render(true);
  }

  static async saveCharacter(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    const image = form.elements.image.value.trim();

    if (!name || !image) {
      ui.notifications.warn(game.i18n.localize("FVN.RequiredFields"));
      return;
    }

    if (this.viewMode === "pool" || this.editingPoolId !== null) {
      const pool = this.getPool();
      const existing = pool.find((entry) => entry.id === this.editingPoolId) ?? {};
      const variants = this.collectVariants(form);
      const character = {
        ...existing,
        id: this.editingPoolId ?? foundry.utils.randomID(), name, image,
        variants,
        activeVariantId: variants.some((variant) => String(variant.id) === String(existing.activeVariantId)) ? existing.activeVariantId : null,
        x: Math.min(1, Math.max(0, Number(form.elements.x.value) || 0)),
        y: Math.min(1, Math.max(0, Number(form.elements.y.value) || 0)),
        scale: Math.min(3, Math.max(0.25, Number(form.elements.scale.value) || 1)),
        mirror: form.elements.mirror.checked,
        focusX: Math.min(1, Math.max(0, Number(form.elements.focusX.value) || 0.5)),
        focusY: Math.min(1, Math.max(0, Number(form.elements.focusY.value) || 0.28)),
        focusZoom: Math.min(3.3333, Math.max(0.8, Number(form.elements.focusZoom.value) || 1.65))
      };
      const index = pool.findIndex((entry) => entry.id === character.id);
      if (index >= 0) pool[index] = character; else pool.push(character);
      await this.setPool(pool);
      this.closeEditor();
      await this.renderCharacters();
      ui.notifications.info(game.i18n.localize("FVN.CharacterSaved"));
      return;
    }

    const library = this.getLibrary();
    const existing = library.find((entry) => entry.id === this.editingId) ?? {};
    const variants = this.collectVariants(form);
    const character = {
      ...existing,
      id: this.editingId ?? foundry.utils.randomID(),
      name,
      image,
      variants,
      activeVariantId: variants.some((variant) => String(variant.id) === String(existing.activeVariantId)) ? existing.activeVariantId : null,
      tabId: form.elements.tabId.value || this.currentTabId || this.getTabs()[0]?.id || null,
      x: Math.min(1, Math.max(0, Number(form.elements.x.value) || 0)),
      y: Math.min(1, Math.max(0, Number(form.elements.y.value) || 0)),
      scale: Math.min(3, Math.max(0.25, Number(form.elements.scale.value) || 1)),
      mirror: form.elements.mirror.checked,
      focusX: Math.min(1, Math.max(0, Number(form.elements.focusX.value) || 0.5)),
      focusY: Math.min(1, Math.max(0, Number(form.elements.focusY.value) || 0.28)),
      focusZoom: Math.min(3.3333, Math.max(0.8, Number(form.elements.focusZoom.value) || 1.65))
    };

    const index = library.findIndex((entry) => entry.id === character.id);
    if (index >= 0) library[index] = character;
    else library.push(character);

    const wasVisible = this.getVisibleIds().has(String(character.id));
    await this.setLibrary(library);
    this.closeEditor();
    if (wasVisible) await VisualNovelAPI.show(character);
    await this.renderCharacters();
    ui.notifications.info(game.i18n.localize("FVN.CharacterSaved"));
  }

  static async editPoolCharacter(characterId) {
    const character = this.getPool().find((entry) => entry.id === characterId);
    if (character) this.openEditor(character, { pool: true });
  }

  static async deletePoolCharacter(characterId) {
    const character = this.getPool().find((entry) => entry.id === characterId);
    if (!character) return;
    const copies = this.getLibrary().filter((entry) => entry.sourceId === characterId).length;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("FVN.DeletePoolCharacter") },
      content: `<p>${game.i18n.format("FVN.DeletePoolConfirm", { name: VisualNovelAPI.escapeHtml(character.name), count: copies })}</p>`,
      yes: { icon: "<i class='fa-solid fa-trash'></i>", label: game.i18n.localize("FVN.Delete") },
      no: { label: game.i18n.localize("FVN.Cancel") }, modal: true
    });
    if (!confirmed) return;
    await this.setPool(this.getPool().filter((entry) => entry.id !== characterId));
    await this.renderCharacters();
  }

  static async editCharacter(characterId) {
    const character = this.getLibrary().find((entry) => entry.id === characterId);
    if (character) this.openEditor(character);
  }

  static async deleteCharacter(characterId) {
    const character = this.getLibrary().find((entry) => entry.id === characterId);
    if (!character) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("FVN.DeleteCharacter") },
      content: `<p>${game.i18n.format("FVN.DeleteConfirm", { name: VisualNovelAPI.escapeHtml(character.name) })}</p>`,
      yes: { icon: "<i class='fa-solid fa-trash'></i>", label: game.i18n.localize("FVN.Delete") },
      no: { label: game.i18n.localize("FVN.Cancel") },
      modal: true
    });

    if (!confirmed) return;
    await VisualNovelAPI.hide(characterId);
    await this.setLibrary(this.getLibrary().filter((entry) => entry.id !== characterId));
    await this.renderCharacters();
  }

  static async showCharacter(characterId) {
    const character = this.getLibrary().find((entry) => entry.id === characterId);
    if (character) {
      await VisualNovelAPI.show(character);
      await this.renderCharacters();
    }
  }
}


class VisualNovelOnboarding {
  static overlay = null;
  static tutorialStep = 0;

  static releaseNotes() {
    return {
      features: [
        game.i18n.localize("FVN.ReleaseFeatureArchitecture"),
        game.i18n.localize("FVN.ReleaseFeaturePolish"),
        game.i18n.localize("FVN.ReleaseFeatureOnboarding"),
        game.i18n.localize("FVN.ReleaseFeatureDiagnostics")
      ],
      fixes: [
        game.i18n.localize("FVN.ReleaseFixLayout"),
        game.i18n.localize("FVN.ReleaseFixConsistency"),
        game.i18n.localize("FVN.ReleaseFixMaintenance")
      ]
    };
  }

  static async showCommunityCard() {
    if (!game.user?.isGM) return false;
    if (game.settings.get(MODULE_ID, COMMUNITY_CARD_SEEN_SETTING)) return false;

    const content = `
      <div class="fvn-community-card">
        <img class="fvn-community-card__logo" src="modules/${MODULE_ID}/assets/branding/dungeon-maxter-logo.png" alt="Dungeon Maxter" />
        <div class="fvn-community-card__body">
          <h3>Cast & Scene</h3>
          <p>Cast & Scene is a system-agnostic module designed for Game Masters who want to enrich Theatre of the Mind by bringing the characters of their adventures onto the scene.</p>
          <a class="fvn-community-card__patreon" href="${PATREON_URL}" target="_blank" rel="noopener noreferrer">
            <i class="fa-brands fa-patreon"></i>
            <span>Join Dungeon Maxter on Patreon</span>
          </a>
        </div>
      </div>`;

    try {
      const message = await ChatMessage.create({
        content,
        whisper: [],
        speaker: ChatMessage.getSpeaker({ alias: "Cast & Scene" })
      });
      if (!message) return false;
      await game.settings.set(MODULE_ID, COMMUNITY_CARD_SEEN_SETTING, true);
      return true;
    } catch (error) {
      console.error(`${MODULE_ID} | Community card failed to post`, error);
      return false;
    }
  }

  static async showReleaseNotes({ force = false } = {}) {
    if (!game.user.isGM) return;
    const disabled = game.settings.get(MODULE_ID, RELEASE_NOTICE_DISABLED_SETTING);
    const seen = game.settings.get(MODULE_ID, RELEASE_SEEN_SETTING);
    const firstRunSeen = Boolean(game.settings.get(MODULE_ID, FIRST_RUN_BOOTSTRAP_SETTING));
    // First-run Welcome is world-specific and must appear once even when this
    // browser has already seen Cast & Scene in another World. The user's
    // release-notice preference only applies after this World has completed
    // its own first-run Welcome.
    if (!force && firstRunSeen && (disabled || seen === CURRENT_VERSION)) return;
    const notes = this.releaseNotes();
    const content = `
      <div class="fvn-release-notes">
        <header><img class="fvn-release-notes__logo" src="modules/${MODULE_ID}/assets/branding/dungeon-maxter-logo.png" alt="Dungeon Maxter" /><div><h2>${game.i18n.localize("FVN.WelcomeTitle")}</h2><p>${game.i18n.format("FVN.WelcomeVersion", { version: CURRENT_VERSION })}</p></div></header>
        <section><h3>${game.i18n.localize("FVN.WhatsNew")}</h3><ul>${notes.features.map((item) => `<li><i class="fa-solid fa-check"></i><span>${item}</span></li>`).join("")}</ul></section>
        <section><h3>${game.i18n.localize("FVN.Fixed")}</h3><ul>${notes.fixes.map((item) => `<li><i class="fa-solid fa-wrench"></i><span>${item}</span></li>`).join("")}</ul></section>
        <label class="fvn-release-notes__choice"><input type="checkbox" name="disableReleaseNotes" /> <span>${game.i18n.localize("FVN.DoNotShowReleaseNotes")}</span></label>
      </div>`;
    let tutorialRequested = false;
    let tutorialLaunched = false;
    const confirmed = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("FVN.WelcomeTitle") },
      content,
      buttons: [
        {
          action: "tutorial",
          icon: "fa-solid fa-graduation-cap",
          label: game.i18n.localize("FVN.StartTutorial"),
          default: false,
          callback: async (_event, _button, dialog) => {
            tutorialRequested = true;
            const disable = Boolean(dialog?.element?.querySelector?.('[name="disableReleaseNotes"]')?.checked);
            await game.settings.set(MODULE_ID, RELEASE_SEEN_SETTING, CURRENT_VERSION);
            await game.settings.set(MODULE_ID, FIRST_RUN_WELCOME_SEEN_SETTING, true);
            await game.settings.set(MODULE_ID, FIRST_RUN_BOOTSTRAP_SETTING, "complete");
            if (disable) await game.settings.set(MODULE_ID, RELEASE_NOTICE_DISABLED_SETTING, true);
            tutorialLaunched = true;
            window.setTimeout(async () => {
              try { await dialog?.close?.(); } catch (_error) {}
              window.setTimeout(() => void this.startTutorial(), 180);
            }, 0);
            return "tutorial";
          }
        },
        {
          action: "close",
          icon: "fa-solid fa-check",
          label: game.i18n.localize("FVN.Close"),
          default: true,
          callback: async (_event, _button, dialog) => {
            const disable = Boolean(dialog?.element?.querySelector?.('[name="disableReleaseNotes"]')?.checked);
            await game.settings.set(MODULE_ID, RELEASE_SEEN_SETTING, CURRENT_VERSION);
            await game.settings.set(MODULE_ID, FIRST_RUN_WELCOME_SEEN_SETTING, true);
            await game.settings.set(MODULE_ID, FIRST_RUN_BOOTSTRAP_SETTING, "complete");
            if (disable) await game.settings.set(MODULE_ID, RELEASE_NOTICE_DISABLED_SETTING, true);
            return "close";
          }
        }
      ],
      rejectClose: false
    });

    await this.showCommunityCard();

    if (!tutorialLaunched && (tutorialRequested || confirmed === "tutorial")) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      await this.startTutorial();
    }
  }

  static tutorialSteps() {
    return [
      { selector: '.fvn-director__sidebar [data-action="view-pool"]', view: "pool", title: "FVN.TutorialPoolTitle", body: "FVN.TutorialPoolBody" },
      { selector: '.fvn-director__sidebar [data-action="view-tabs"]', view: "tabs", title: "FVN.TutorialPresetsTitle", body: "FVN.TutorialPresetsBody" },
      { selector: '.fvn-director__main', view: "tabs", title: "FVN.TutorialStageTitle", body: "FVN.TutorialStageBody" },
      { selector: '.fvn-preset-performance', view: "tabs", title: "FVN.TutorialPerformanceTitle", body: "FVN.TutorialPerformanceBody" },
      { selector: '.fvn-footer-group--stage', view: "tabs", title: "FVN.TutorialControlsTitle", body: "FVN.TutorialControlsBody" },
      { selector: '.fvn-scene-palette', title: "FVN.TutorialQuickTitle", body: "FVN.TutorialQuickBody", optional: true }
    ];
  }

  static async startTutorial() {
    if (!game.user.isGM) return;
    if (!VisualNovelDirector.panel?.isConnected) await VisualNovelDirector.open();
    VisualNovelDirector.toggleMinimized(false);

    const deadline = Date.now() + 2500;
    while (!VisualNovelDirector.panel?.isConnected && Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    if (!VisualNovelDirector.panel?.isConnected) {
      ui.notifications.error(game.i18n.localize("FVN.TutorialStartFailed"));
      return;
    }

    // Tutorial layout is deterministic: keep the Director centered and keep
    // Quick Access hidden until its dedicated step. This avoids the onboarding
    // UI competing for space with Foundry v14 applications.
    const panel = VisualNovelDirector.panel;
    if (panel?.isConnected) {
      const rect = panel.getBoundingClientRect();
      const left = Math.max(8, Math.round((window.innerWidth - rect.width) / 2));
      const top = Math.max(8, Math.round((window.innerHeight - rect.height) / 2));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = "auto";
    }

    VisualNovelScenePalette.tutorialMode = true;
    VisualNovelScenePalette.ensure();
    VisualNovelScenePalette.expanded = false;
    VisualNovelScenePalette.render();
    if (VisualNovelScenePalette.root) VisualNovelScenePalette.root.hidden = true;

    this.tutorialStep = 0;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    try {
      await this.renderTutorial();
    } catch (error) {
      console.error(`${MODULE_ID} | Tutorial failed to render`, error);
      ui.notifications.error(game.i18n.localize("FVN.TutorialStartFailed"));
    }
  }

  static clearTutorialOverlay() {
    this.overlay?.remove();
    this.overlay = null;
  }

  static stopTutorial({ completed = false } = {}) {
    this.clearTutorialOverlay();
    if (VisualNovelScenePalette.tutorialMode) {
      VisualNovelScenePalette.tutorialMode = false;
      VisualNovelScenePalette.expanded = false;
      VisualNovelScenePalette.render();
      VisualNovelScenePalette.restorePosition();
    }
    if (completed) void game.settings.set(MODULE_ID, TUTORIAL_COMPLETED_SETTING, true);
  }

  static async renderTutorial() {
    this.clearTutorialOverlay();
    const steps = this.tutorialSteps();
    let step = steps[this.tutorialStep];

    if (step.view) {
      VisualNovelDirector.setViewMode(step.view);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }

    const isQuickAccessStep = step.selector === '.fvn-scene-palette';
    if (VisualNovelScenePalette.tutorialMode) {
      VisualNovelScenePalette.ensure();
      VisualNovelScenePalette.expanded = isQuickAccessStep;
      VisualNovelScenePalette.render();
      if (VisualNovelScenePalette.root) {
        VisualNovelScenePalette.root.hidden = !isQuickAccessStep;
        if (isQuickAccessStep) {
          VisualNovelScenePalette.root.style.left = "18px";
          VisualNovelScenePalette.root.style.right = "auto";
          VisualNovelScenePalette.root.style.bottom = "104px";
          VisualNovelScenePalette.root.style.top = "auto";
        }
      }
      if (isQuickAccessStep) await new Promise((resolve) => window.setTimeout(resolve, 60));
    }

    let target = document.querySelector(step.selector);
    while (!target && step.optional && this.tutorialStep < steps.length - 1) {
      this.tutorialStep += 1;
      step = steps[this.tutorialStep];
      target = document.querySelector(step.selector);
    }
    if (!target) target = VisualNovelDirector.panel;
    if (!target?.isConnected) {
      ui.notifications.error(game.i18n.localize("FVN.TutorialStartFailed"));
      return;
    }

    const rect = target.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'fvn-tutorial-overlay';
    overlay.innerHTML = `
      <div class="fvn-tutorial-spotlight" aria-hidden="true"></div>
      <div class="fvn-tutorial-card">
        <div class="fvn-tutorial-card__step">${game.i18n.format("FVN.TutorialStep", { current: this.tutorialStep + 1, total: steps.length })}</div>
        <h3>${game.i18n.localize(step.title)}</h3>
        <p>${game.i18n.localize(step.body)}</p>
        <footer>
          <button type="button" data-action="skip">${game.i18n.localize("FVN.Skip")}</button>
          <span></span>
          <button type="button" data-action="back" ${this.tutorialStep === 0 ? 'disabled' : ''}>${game.i18n.localize("FVN.Back")}</button>
          <button type="button" data-action="next">${this.tutorialStep === steps.length - 1 ? game.i18n.localize("FVN.Finish") : game.i18n.localize("FVN.Next")}</button>
        </footer>
      </div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    const viewportMargin = 18;
    const spotlight = overlay.querySelector('.fvn-tutorial-spotlight');
    const spotLeft = Math.max(viewportMargin, rect.left - 5);
    const spotTop = Math.max(viewportMargin, rect.top - 5);
    const spotRight = Math.min(window.innerWidth - viewportMargin, rect.right + 5);
    const spotBottom = Math.min(window.innerHeight - viewportMargin, rect.bottom + 5);
    spotlight.style.left = `${spotLeft}px`;
    spotlight.style.top = `${spotTop}px`;
    spotlight.style.width = `${Math.max(1, spotRight - spotLeft)}px`;
    spotlight.style.height = `${Math.max(1, spotBottom - spotTop)}px`;

    const card = overlay.querySelector('.fvn-tutorial-card');
    const cardRect = card.getBoundingClientRect();
    const width = cardRect.width || 340;
    const height = cardRect.height || 210;
    const gap = 14;
    const candidates = [
      { left: spotRight + gap, top: spotTop },
      { left: spotLeft - width - gap, top: spotTop },
      { left: spotLeft, top: spotBottom + gap },
      { left: spotLeft, top: spotTop - height - gap }
    ];
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const fits = ({ left, top }) => left >= viewportMargin && top >= viewportMargin && left + width <= window.innerWidth - viewportMargin && top + height <= window.innerHeight - viewportMargin;
    let chosen = candidates.find(fits);
    if (!chosen) {
      chosen = {
        left: clamp(window.innerWidth - width - viewportMargin, viewportMargin, window.innerWidth - width - viewportMargin),
        top: clamp(viewportMargin, viewportMargin, window.innerHeight - height - viewportMargin)
      };
    }
    card.style.left = `${chosen.left}px`;
    card.style.top = `${chosen.top}px`;

    overlay.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'skip') return this.stopTutorial();
      if (action === 'back') this.tutorialStep = Math.max(0, this.tutorialStep - 1);
      if (action === 'next') {
        if (this.tutorialStep >= steps.length - 1) return this.stopTutorial({ completed: true });
        this.tutorialStep += 1;
      }
      await this.renderTutorial();
    });
  }

}

class VisualNovelAPI {
  static lastFocus = null;
  static getState() {
    return VisualNovelStage.normalizeStageState(game.settings.get(MODULE_ID, STATE_SETTING));
  }

  static async commitState(state) {
    if (!game.user?.isGM) {
      console.warn(`${MODULE_ID} | Rejected Stage state write from non-GM user.`);
      return false;
    }

    const normalized = VisualNovelStage.normalizeStageState(state);
    await game.settings.set(MODULE_ID, STATE_SETTING, normalized);
    await VisualNovelDirector.renderCharacters();
    VisualNovelScenePalette.render();
    return true;
  }

  static async show(characterOrId, overrides = {}) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("FVN.GMOnly"));
      return;
    }

    let character = characterOrId;
    if (typeof characterOrId === "string") {
      character = VisualNovelDirector.getLibrary().find((entry) => entry.id === characterOrId);
    }

    const displayImage = VisualNovelDirector.getDisplayImage(character);
    if (!displayImage) {
      ui.notifications.warn(game.i18n.localize("FVN.CharacterNotFound"));
      return;
    }

    const coordinates = VisualNovelDirector.getCoordinates(character);
    const portrait = VisualNovelStage.normalizeCharacter({
      ...DEFAULT_CHARACTER,
      ...character,
      image: displayImage,
      ...coordinates,
      ...overrides,
      id: character.id ?? overrides.id ?? foundry.utils.randomID(),
      characterId: character.id ?? character.characterId ?? overrides.characterId
    });

    const state = this.getState();
    const index = state.portraits.findIndex((entry) => String(entry.characterId ?? entry.id) === String(portrait.characterId ?? portrait.id));
    if (index >= 0) state.portraits[index] = portrait;
    else state.portraits.push(portrait);

    const libraryOrder = new Map(VisualNovelDirector.getLibrary().map((entry, orderIndex) => [String(entry.id), orderIndex]));
    state.portraits.sort((a, b) => {
      const aIndex = libraryOrder.get(String(a.characterId ?? a.id));
      const bIndex = libraryOrder.get(String(b.characterId ?? b.id));
      return (aIndex ?? Number.MAX_SAFE_INTEGER) - (bIndex ?? Number.MAX_SAFE_INTEGER);
    });

    await this.commitState(state);
  }

  static async hide(characterOrId = null) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("FVN.GMOnly"));
      return;
    }

    if (characterOrId === null || characterOrId === undefined) return this.hideAll();
    const id = typeof characterOrId === "string" ? characterOrId : (characterOrId.characterId ?? characterOrId.id);
    const state = this.getState();
    state.portraits = state.portraits.filter((entry) => String(entry.characterId ?? entry.id) !== String(id));
    await this.commitState(state);
  }

  static async hideAll() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("FVN.GMOnly"));
      return;
    }
    const current = this.getState();
    const state = {
      ...foundry.utils.deepClone(DEFAULT_STAGE_STATE),
      dimmed: current.dimmed,
      dimLevel: current.dimLevel,
      dimFeather: current.dimFeather,
      dimMode: current.dimMode,
      backgroundEffect: current.backgroundEffect,
      backgroundIntensity: current.backgroundIntensity,
      namesVisible: current.namesVisible,
      camera: foundry.utils.deepClone(current.camera ?? DEFAULT_STAGE_STATE.camera)
    };
    await this.commitState(state);
  }

  static async clearStage() {
    if (!game.user.isGM) return;

    const current = this.getState();
    const state = {
      ...foundry.utils.deepClone(DEFAULT_STAGE_STATE),
      // Preserve Stage preferences, but clear all live presentation state.
      dimmed: false,
      dimLevel: current.dimLevel,
      dimFeather: current.dimFeather,
      dimMode: current.dimMode,
      backgroundEffect: current.backgroundEffect,
      backgroundIntensity: current.backgroundIntensity,
      namesVisible: current.namesVisible,
      portraits: [],
      camera: { enabled: false, x: 0, y: 0, zoom: 1 }
    };

    this.lastFocus = null;
    await this.commitState(state);
  }

  static async showAll(tabId = null) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("FVN.GMOnly"));
      return;
    }
    const characters = VisualNovelDirector.getLibrary().filter((entry) => !tabId || String(entry.tabId) === String(tabId));
    if (!characters.length) return;
    const state = this.getState();
    state.portraits = characters.map((character) => {
      const coordinates = VisualNovelDirector.getCoordinates(character);
      return VisualNovelStage.normalizeCharacter({
        ...DEFAULT_CHARACTER,
        ...character,
        image: VisualNovelDirector.getDisplayImage(character),
        ...coordinates,
        id: character.id,
        characterId: character.id
      });
    });
    await this.commitState(state);
  }

  static async toggleNames(force = null) {
    if (!game.user.isGM) return;
    const state = this.getState();
    state.namesVisible = force === null ? !state.namesVisible : Boolean(force);
    await this.commitState(state);
  }

  static async toggleDim(force = null) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("FVN.GMOnly"));
      return;
    }
    const state = this.getState();
    state.dimmed = force === null ? !state.dimmed : Boolean(force);
    if (state.dimmed && state.backgroundEffect === "none") state.backgroundEffect = "dim";
    await this.commitState(state);
  }



  static async toggleSilhouette(characterId, force = null) {
    if (!game.user.isGM || !characterId) return;
    const id = String(characterId);
    const library = VisualNovelDirector.getLibrary();
    const character = library.find((entry) => String(entry.id) === id);
    const state = this.getState();
    const portrait = state.portraits.find((entry) => String(entry.characterId ?? entry.id) === id);
    const current = character ? Boolean(character.silhouette) : Boolean(portrait?.silhouette);
    const next = force === null ? !current : Boolean(force);

    if (character) {
      character.silhouette = next;
      await VisualNovelDirector.setLibrary(library);
    }
    if (portrait) portrait.silhouette = next;

    if (portrait) await this.commitState(state);
    else VisualNovelScenePalette.render();
  }

  static async resetCamera() {
    if (!game.user.isGM) return;
    const state = this.getState();
    state.camera = foundry.utils.deepClone(DEFAULT_STAGE_STATE.camera);
    this.lastFocus = null;

    // Apply Home View immediately on the GM client. The authoritative world
    // setting update then propagates the same reset to every connected client.
    VisualNovelStage.renderState(state);
    VisualNovelScenePalette.render();
    await this.commitState(state);
  }

  static async focusCharacter(characterId) {
    if (!game.user.isGM || !characterId) return;
    const state = this.getState();
    const id = String(characterId);

    const portrait = state.portraits.find((entry) => String(entry.characterId ?? entry.id) === id);
    const character = VisualNovelDirector.getLibrary().find((entry) => String(entry.id) === id);

    // The authoritative Camera state, rather than transient local memory,
    // determines whether a second click should return to Home View. This stays
    // reliable after rerenders, reloads, palette updates, and multiplayer sync.
    const currentCamera = VisualNovelStage.normalizeCamera(state.camera);
    if (portrait && currentCamera.enabled && String(currentCamera.targetPortraitId) === String(portrait.id)) {
      await this.resetCamera();
      return;
    }
    if (!portrait || !character) {
      ui.notifications.warn(game.i18n.localize("FVN.FocusRequiresVisible"));
      return;
    }

    const stage = VisualNovelStage.ensure();
    const wrap = VisualNovelStage.getPortraitElement(portrait.id, { create: false });
    const image = wrap?.querySelector('.fvn-stage__portrait');
    const stageRect = stage.getBoundingClientRect();
    if (!image || !stageRect.width || !stageRect.height) return;

    const focusX = Math.min(1, Math.max(0, Number(character.focusX) || 0.5));
    const focusY = Math.min(1, Math.max(0, Number(character.focusY) || 0.28));
    const framing = Math.min(3.3333, Math.max(0.8, Number(character.focusZoom) || 1.65));
    const portraitScale = Math.min(3, Math.max(0.25, Number(portrait.scale) || 1));
    const imageWidth = image.offsetWidth * portraitScale;
    const imageHeight = image.offsetHeight * portraitScale;
    const visualFocusX = portrait.mirror ? 1 - focusX : focusX;
    const pointX = Number(portrait.x) + ((visualFocusX - 0.5) * imageWidth / stageRect.width);
    const pointY = Number(portrait.y) - ((1 - focusY) * imageHeight / stageRect.height);

    // The editor frame width is stored as a percentage of the portrait image.
    // Derive the real camera zoom from that exact world-space rectangle, so the
    // resulting viewport matches the frame rather than treating focusZoom as an
    // arbitrary camera multiplier. The frame uses the live Stage aspect ratio.
    const frameWidthRatio = Math.min(1, Math.max(0.24, 0.8 / framing));
    const frameWorldWidth = Math.max(1, imageWidth * frameWidthRatio);
    const zoom = Math.min(6, Math.max(0.75, stageRect.width / frameWorldWidth));

    this.lastFocus = { characterId: id };
    state.camera = VisualNovelStage.normalizeCamera({
      enabled: true,
      // Legacy transform is kept as a fallback while images are loading.
      zoom,
      x: -(pointX - 0.5) * zoom,
      y: -(pointY - 0.5) * zoom,
      // RC.2 authoritative camera descriptor. Each client resolves these
      // normalized values against its own supported viewport.
      targetPortraitId: portrait.id,
      focusX,
      focusY,
      framing
    });
    await this.commitState(state);
  }

  static async setDimMode(mode) {
    if (!game.user.isGM) return;
    const state = this.getState();
    state.dimMode = ["manual", "auto", "camera"].includes(mode) ? mode : "manual";
    if (state.dimMode === "auto") state.dimmed = state.portraits.length > 0;
    if (state.dimMode === "camera") state.dimmed = false;
    await this.commitState(state);
  }

  static async setDimFeather(feather) {
    if (!game.user.isGM) return;
    const state = this.getState();
    state.dimFeather = ["none", "medium", "large"].includes(feather) ? feather : "medium";
    await this.commitState(state);
  }

  static async setBackgroundEffect(effect) {
    if (!game.user.isGM) return;
    const state = this.getState();
    state.backgroundEffect = ["none", "dim", "blur", "focus"].includes(effect) ? effect : "dim";
    if (state.backgroundEffect === "none") state.dimmed = false;
    await this.commitState(state);
  }

  static async setBackgroundIntensity(intensity) {
    if (!game.user.isGM) return;
    const state = this.getState();
    state.backgroundIntensity = ["small", "medium", "large"].includes(intensity) ? intensity : "medium";
    await this.commitState(state);
  }

  static escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }
}

let lastDirectorOpenRequest = 0;

function requestOpenDirector(event = null) {
  if (!game.user.isGM) return;
  const now = performance.now();
  if ((now - lastDirectorOpenRequest) < 150) return;
  lastDirectorOpenRequest = now;
  event?.preventDefault?.();
  void VisualNovelDirector.open();
}

function registerSceneControl(controls) {
  if (!game.user.isGM) return;

  const tool = {
    name: "fvn-director",
    title: "FVN.Director",
    icon: "fa-solid fa-masks-theater",
    button: true,
    visible: true,
    order: 100,
    onChange: requestOpenDirector
  };

  if (Array.isArray(controls)) {
    const tokenControls = controls.find((control) => control.name === "token");
    if (tokenControls?.tools && !tokenControls.tools.some((entry) => entry.name === tool.name)) tokenControls.tools.push(tool);
    return;
  }

  const tokenControls = controls.tokens ?? controls.token;
  if (!tokenControls) return;
  if (Array.isArray(tokenControls.tools)) {
    if (!tokenControls.tools.some((entry) => entry.name === tool.name)) tokenControls.tools.push(tool);
  } else {
    tokenControls.tools ??= {};
    tokenControls.tools[tool.name] = tool;
  }
}

class CastAndSceneNamespaceMigration {
  static worldSettingKeys = [
    LIBRARY_SETTING,
    POOL_SETTING,
    POOL_MIGRATED_SETTING,
    TABS_SETTING,
    SCENE_BINDINGS_SETTING,
    STATE_SETTING,
    DATA_SCHEMA_VERSION_SETTING
  ];

  static getStoredWorldSetting(fullKey) {
    const worldStorage = game.settings.storage?.get?.("world");
    if (!worldStorage) return null;

    // Foundry's world settings storage is a DocumentCollection. Its internal
    // collection is keyed by Setting document id, not necessarily by the
    // setting's `namespace.key` string, so Collection#get(fullKey) is not a
    // reliable legacy lookup in v14. Search the Setting documents by `key`.
    const direct = worldStorage.get?.(fullKey);
    if (direct?.key === fullKey) return direct;

    if (typeof worldStorage.find === "function") {
      const found = worldStorage.find((entry) => entry?.key === fullKey);
      if (found) return found;
    }

    const entries = worldStorage.contents ?? Array.from(worldStorage.values?.() ?? []);
    return entries.find((entry) => entry?.key === fullKey) ?? null;
  }

  static cloneStoredValue(entry) {
    if (!entry) return undefined;
    let value = entry.value;

    // Setting#value is normally already deserialized. Keep a conservative
    // fallback for raw storage representations without altering valid strings.
    if (typeof value === "string") {
      const trimmed = value.trim();
      if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
        try { value = JSON.parse(trimmed); } catch (_error) { /* keep raw value */ }
      } else if (trimmed === "true" || trimmed === "false") {
        value = trimmed === "true";
      } else if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        value = Number(trimmed);
      }
    }
    return foundry.utils.deepClone(value);
  }

  static hasMeaningfulCurrentData() {
    const library = game.settings.get(MODULE_ID, LIBRARY_SETTING);
    const pool = game.settings.get(MODULE_ID, POOL_SETTING);
    const bindings = game.settings.get(MODULE_ID, SCENE_BINDINGS_SETTING);
    return (Array.isArray(library) && library.length > 0)
      || (Array.isArray(pool) && pool.length > 0)
      || (bindings && typeof bindings === "object" && Object.keys(bindings).length > 0);
  }

  static async run() {
    if (!game.user?.isGM) return;

    const legacyEntries = new Map();
    for (const key of this.worldSettingKeys) {
      const fullKey = `${LEGACY_MODULE_ID}.${key}`;
      const entry = this.getStoredWorldSetting(fullKey);
      if (entry) legacyEntries.set(key, entry);
    }

    if (!legacyEntries.size) {
      console.info(`[Cast & Scene] No legacy world settings found under ${LEGACY_MODULE_ID}; namespace migration skipped.`);
      return;
    }

    const previouslyMarked = game.settings.get(MODULE_ID, LEGACY_NAMESPACE_MIGRATED_SETTING);
    // RC.10 could mark migration complete after finding zero legacy entries.
    // If Cast & Scene already contains actual user data, never overwrite it.
    if (previouslyMarked && this.hasMeaningfulCurrentData()) return;

    let copied = 0;
    for (const [key, entry] of legacyEntries) {
      const legacyValue = this.cloneStoredValue(entry);
      if (legacyValue === undefined) continue;
      await game.settings.set(MODULE_ID, key, legacyValue);
      copied += 1;
    }

    // Preserve local Director/Quick Access geometry where possible. These are
    // plain localStorage values rather than Foundry world settings.
    for (const suffix of ["scenePalettePosition", "directorMinimized", "directorSize", "directorPosition"]) {
      const oldKey = `${LEGACY_MODULE_ID}.${suffix}`;
      const newKey = `${MODULE_ID}.${suffix}`;
      if (localStorage.getItem(newKey) === null && localStorage.getItem(oldKey) !== null) {
        localStorage.setItem(newKey, localStorage.getItem(oldKey));
      }
    }

    if (copied > 0) {
      await game.settings.set(MODULE_ID, LEGACY_NAMESPACE_MIGRATED_SETTING, true);
      console.info(`[Cast & Scene] Imported ${copied} world settings from legacy namespace ${LEGACY_MODULE_ID}.`);
    } else {
      console.warn(`[Cast & Scene] Legacy namespace was detected, but no settings were copied. Migration remains incomplete.`);
    }
  }
}

class VisualNovelDataMigrations {
  static getCurrentVersion() {
    const version = Number(game.settings.get(MODULE_ID, DATA_SCHEMA_VERSION_SETTING));
    return Number.isFinite(version) && version >= 0 ? Math.floor(version) : 0;
  }

  static async run() {
    if (!game.user?.isGM) return;

    let version = this.getCurrentVersion();
    if (version > DATA_SCHEMA_VERSION) {
      console.warn(`[FVN] World data schema ${version} is newer than supported schema ${DATA_SCHEMA_VERSION}. No migration was attempted.`);
      return;
    }

    while (version < DATA_SCHEMA_VERSION) {
      const nextVersion = version + 1;
      const migrate = this[`migrateToV${nextVersion}`];
      if (typeof migrate !== "function") throw new Error(`[FVN] Missing data migration for schema v${nextVersion}.`);
      await migrate.call(this);
      await game.settings.set(MODULE_ID, DATA_SCHEMA_VERSION_SETTING, nextVersion);
      version = nextVersion;
      console.info(`[FVN] Data schema migrated to v${version}.`);
    }
  }

  static async migrateToV1() {
    // Schema v1 establishes the migration contract only. Existing RC data is
    // already the canonical v1 shape, so this migration intentionally performs
    // no writes to Character Pool, Scene Presets, bindings, tabs, or Stage state.
    const library = game.settings.get(MODULE_ID, LIBRARY_SETTING);
    const pool = game.settings.get(MODULE_ID, POOL_SETTING);
    const tabs = game.settings.get(MODULE_ID, TABS_SETTING);
    const bindings = game.settings.get(MODULE_ID, SCENE_BINDINGS_SETTING);
    const state = game.settings.get(MODULE_ID, STATE_SETTING);

    if (!Array.isArray(library)) throw new Error("[FVN] Cannot establish schema v1: characterLibrary is not an array.");
    if (!Array.isArray(pool)) throw new Error("[FVN] Cannot establish schema v1: characterPool is not an array.");
    if (!Array.isArray(tabs)) throw new Error("[FVN] Cannot establish schema v1: characterTabs is not an array.");
    if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) throw new Error("[FVN] Cannot establish schema v1: sceneBindings is invalid.");
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("[FVN] Cannot establish schema v1: stageState is invalid.");
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, LIBRARY_SETTING, {
    name: "FVN.LibrarySetting",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, POOL_SETTING, {
    name: "FVN.PoolSetting",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, POOL_MIGRATED_SETTING, {
    name: "FVN.PoolMigratedSetting",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, TABS_SETTING, {
    name: "FVN.TabsSetting",
    scope: "world",
    config: false,
    type: Array,
    default: foundry.utils.deepClone(DEFAULT_TABS)
  });

  game.settings.register(MODULE_ID, SCENE_BINDINGS_SETTING, {
    name: "FVN.SceneBindingsSetting",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, STATE_SETTING, {
    name: "FVN.StageStateSetting",
    scope: "world",
    config: false,
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_STAGE_STATE),
    onChange: (value) => {
      const state = VisualNovelStage.normalizeStageState(value);
      VisualNovelStage.renderState(state);
      if (game.user?.isGM) {
        void VisualNovelDirector.renderCharacters();
        VisualNovelScenePalette.render();
      }
    }
  });

  game.settings.register(MODULE_ID, RELEASE_SEEN_SETTING, { name: "FVN.ReleaseSeenSetting", scope: "client", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, RELEASE_NOTICE_DISABLED_SETTING, { name: "FVN.ReleaseNoticeDisabledSetting", scope: "client", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, TUTORIAL_COMPLETED_SETTING, { name: "FVN.TutorialCompletedSetting", scope: "client", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, FIRST_RUN_WELCOME_SEEN_SETTING, { name: "First-run Welcome seen", scope: "world", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, FIRST_RUN_BOOTSTRAP_SETTING, { name: "First-run onboarding bootstrap", scope: "world", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, COMMUNITY_CARD_SEEN_SETTING, { name: "Community card seen", scope: "world", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, DATA_SCHEMA_VERSION_SETTING, { name: "FVN.DataSchemaVersionSetting", scope: "world", config: false, type: Number, default: 0 });
  game.settings.register(MODULE_ID, LEGACY_NAMESPACE_MIGRATED_SETTING, { name: "Legacy namespace migrated", scope: "world", config: false, type: Boolean, default: false });

  globalThis.CastAndScene = VisualNovelAPI;
  globalThis.CastAndScene.showReleaseNotes = () => VisualNovelOnboarding.showReleaseNotes({ force: true });
  globalThis.CastAndScene.startTutorial = () => VisualNovelOnboarding.startTutorial();
  // Temporary compatibility alias for pre-release macros/tests.
  globalThis.FoundryVisualNovel = globalThis.CastAndScene;
});

Hooks.once("ready", async () => {
  // First-run onboarding is deliberately independent from canvas/Scene lifecycle.
  // A brand-new Foundry World may have no active Scene at all.
  if (game.user.isGM) {
    window.setTimeout(() => void VisualNovelOnboarding.showReleaseNotes(), 150);
  }

  VisualNovelStage.ensure();
  if (game.user.isGM) {
    await CastAndSceneNamespaceMigration.run();
    const library = VisualNovelDirector.getLibrary();
    const pool = VisualNovelDirector.getPool();
    const migrated = game.settings.get(MODULE_ID, POOL_MIGRATED_SETTING);
    if (!migrated && !pool.length && library.length) {
      const migratedPool = library.map((entry) => ({ id: foundry.utils.randomID(), name: entry.name, image: entry.image, x: entry.x, y: entry.y, scale: entry.scale, mirror: entry.mirror }));
      const migratedLibrary = library.map((entry, index) => ({ ...entry, sourceId: migratedPool[index].id }));
      await VisualNovelDirector.setPool(migratedPool);
      await VisualNovelDirector.setLibrary(migratedLibrary);
    }
    if (!migrated) await game.settings.set(MODULE_ID, POOL_MIGRATED_SETTING, true);
    await VisualNovelDataMigrations.run();
  }
  if (game.user.isGM) VisualNovelScenePalette.render();

  if (game.user.isGM) {
    document.addEventListener("click", (event) => {
      const toolButton = event.target.closest('[data-tool="fvn-director"], [data-control="fvn-director"], button[name="fvn-director"]');
      if (!toolButton) return;
      requestOpenDirector(event);
    }, true);
  }


  const rawState = game.settings.get(MODULE_ID, STATE_SETTING);
  const state = VisualNovelStage.normalizeStageState(rawState);
  VisualNovelStage.renderState(state);

  if (game.user.isGM && !Array.isArray(rawState?.portraits)) {
    await game.settings.set(MODULE_ID, STATE_SETTING, state);
  }

});

Hooks.on("getSceneControlButtons", registerSceneControl);
Hooks.on("renderSidebarTab", () => {
  VisualNovelStage.refreshSafeAreaObservers();
  VisualNovelStage.scheduleSafeAreaUpdate();
});
Hooks.on("collapseSidebar", () => VisualNovelStage.scheduleSafeAreaUpdate());
Hooks.on("renderHotbar", () => {
  VisualNovelStage.refreshSafeAreaObservers();
  VisualNovelStage.scheduleSafeAreaUpdate();
});
Hooks.on("renderSceneNavigation", () => VisualNovelStage.scheduleSafeAreaUpdate());
Hooks.on("renderSceneControls", () => {
  VisualNovelStage.refreshSafeAreaObservers();
  VisualNovelStage.scheduleSafeAreaUpdate();
  VisualNovelScenePalette.render();
});
Hooks.on("canvasReady", () => {
  // A GM may view a Scene without activating it. In that case hide FVN only
  // on the GM client while preserving the shared Stage for players.
  VisualNovelStage.syncLocalSceneVisibility();
  VisualNovelScenePalette.render();
});
Hooks.on("updateScene", async (scene, changes, _options, userId) => {
  // V14 does not emit a reliable activateScene hook for this workflow.
  // A real activation updates the target Scene with active=true. Only the GM
  // who initiated that document update clears the shared Stage, avoiding
  // duplicate resets when multiple GMs are connected.
  const becameActive = Object.prototype.hasOwnProperty.call(changes ?? {}, "active") && changes.active === true;
  if (becameActive && game.user?.isGM && userId === game.user.id) {
    await VisualNovelAPI.clearStage();
  }
  VisualNovelStage.syncLocalSceneVisibility();
  VisualNovelScenePalette.render();
});
