const CONFIG = {
  DEFAULT_SIZE: 8,
  DEFAULT_FPS: 8,

  MIN_FPS: 1,
  MAX_FPS: 30,

  MIN_SCALE: 2,
  MAX_SCALE: 16,

  STORAGE_KEY: "niche-pixel-art-project-v2",

  PALETTE: [
    "#302A35",
    "#FFFFFF",
    "#FF6B6B",
    "#FF9F68",
    "#FFD166",
    "#95D5B2",
    "#52B788",
    "#4D96FF",
    "#A78BFA",
    "#F7C8DF",
    "#F4A6C1",
    "#6C63FF",
    "#2D4059",
    "#7A5C61",
    "#B8B8A8",
  ],
};

/*STATE*/

const state = {
  width: CONFIG.DEFAULT_SIZE,
  height: CONFIG.DEFAULT_SIZE,

  fps: CONFIG.DEFAULT_FPS,

  frames: [createBlankFrame(CONFIG.DEFAULT_SIZE, CONFIG.DEFAULT_SIZE)],

  activeFrame: 0,

  color: "#302A35",

  tool: "paint",

  onionSkin: false,

  symmetry: "off",

  previewScale: 6,

  playing: true,

  projectName: "my-pixel-sprite",

  recentColors: [],

  history: [],
  historyIndex: -1,

  isDrawing: false,
  lastPaintedIndex: null,
};

/*DOM*/

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [...document.querySelectorAll(selector)];

const pixelGrid = $("#pixelGrid");
const timeline = $("#timeline");

const colorPicker = $("#colorPicker");
const currentColor = $("#currentColor");

const fpsRange = $("#fpsRange");
const fpsValue = $("#fpsValue");

const previewSprite = $("#previewSprite");

const cssOutput = $("#cssOutput");

const toast = $("#toast");

const frameInfo = $("#frameInfo");

const metaFrames = $("#metaFrames");
const metaCanvas = $("#metaCanvas");
const metaFPS = $("#metaFPS");

const projectNameInput = $("#projectName");

/*FRAME HELPERS*/

function createBlankFrame(width, height) {
  return Array(width * height).fill(null);
}

function cloneFrame(frame) {
  return [...frame];
}

function cloneFrames(frames) {
  return frames.map((frame) => [...frame]);
}

function getCurrentFrame() {
  return state.frames[state.activeFrame];
}

function getIndex(x, y) {
  return y * state.width + x;
}

function getCoordinates(index) {
  return {
    x: index % state.width,
    y: Math.floor(index / state.width),
  };
}

/*HISTORY*/

function snapshot() {
  return {
    width: state.width,
    height: state.height,
    frames: cloneFrames(state.frames),
    activeFrame: state.activeFrame,
  };
}

function restoreSnapshot(snapshotData) {
  state.width = snapshotData.width;
  state.height = snapshotData.height;

  state.frames = cloneFrames(snapshotData.frames);

  state.activeFrame = Math.min(
    snapshotData.activeFrame,
    state.frames.length - 1,
  );
}

function pushHistory() {
  const current = snapshot();

  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }

  state.history.push(current);

  /*
   * Keep the history useful without allowing
   * an accidental long drawing session to consume
   * unlimited memory.
   */
  if (state.history.length > 80) {
    state.history.shift();
  }

  state.historyIndex = state.history.length - 1;

  updateHistoryButtons();
}

function undo() {
  if (state.historyIndex <= 0) {
    return;
  }

  state.historyIndex--;

  restoreSnapshot(state.history[state.historyIndex]);

  renderEverything();

  showToast("Undid last change");
}

function redo() {
  if (state.historyIndex >= state.history.length - 1) {
    return;
  }

  state.historyIndex++;

  restoreSnapshot(state.history[state.historyIndex]);

  renderEverything();

  showToast("Redid change");
}

function updateHistoryButtons() {
  $("#undoBtn").disabled = state.historyIndex <= 0;

  $("#redoBtn").disabled = state.historyIndex >= state.history.length - 1;
}

/*DRAWING*/

function paintPixel(index) {
  const frame = getCurrentFrame();

  const { x, y } = getCoordinates(index);

  if (state.tool === "erase") {
    setPixel(x, y, null);
  } else {
    setPixel(x, y, state.color);
  }
}

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) {
    return;
  }

  getCurrentFrame()[getIndex(x, y)] = color;
}

function applySymmetry(x, y, color) {
  const points = new Set();

  points.add(`${x},${y}`);

  if (state.symmetry === "horizontal" || state.symmetry === "both") {
    points.add(`${state.width - 1 - x},${y}`);
  }

  if (state.symmetry === "vertical" || state.symmetry === "both") {
    points.add(`${x},${state.height - 1 - y}`);
  }

  if (state.symmetry === "both") {
    points.add(`${state.width - 1 - x},${state.height - 1 - y}`);
  }

  for (const point of points) {
    const [px, py] = point.split(",").map(Number);

    setPixel(px, py, color);
  }
}

function drawAt(index) {
  const { x, y } = getCoordinates(index);

  const color = state.tool === "erase" ? null : state.color;

  applySymmetry(x, y, color);

  renderGrid();
  renderPreview();
  renderTimeline();

  saveToLocalStorage();
}

function handlePointerDown(event) {
  const cell = event.target.closest(".pixel");

  if (!cell) {
    return;
  }

  event.preventDefault();

  state.isDrawing = true;

  /*
   * Save only once for the entire drag operation.
   */
  pushHistory();

  const index = Number(cell.dataset.index);

  state.lastPaintedIndex = index;

  drawAt(index);
}

function handlePointerMove(event) {
  if (!state.isDrawing) {
    return;
  }

  const element = document.elementFromPoint(event.clientX, event.clientY);

  if (!element) {
    return;
  }

  const cell = element.closest(".pixel");

  if (!cell) {
    return;
  }

  const index = Number(cell.dataset.index);

  if (index === state.lastPaintedIndex) {
    return;
  }

  state.lastPaintedIndex = index;

  drawAt(index);
}

function endDrawing() {
  state.isDrawing = false;
  state.lastPaintedIndex = null;

  saveToLocalStorage();
}

/*GRID*/

function renderGrid() {
  pixelGrid.innerHTML = "";

  pixelGrid.style.gridTemplateColumns = `repeat(${state.width}, var(--pixel-size))`;

  pixelGrid.style.gridTemplateRows = `repeat(${state.height}, var(--pixel-size))`;

  const previousFrame =
    state.activeFrame > 0 ? state.frames[state.activeFrame - 1] : null;

  const frame = getCurrentFrame();

  const fragment = document.createDocumentFragment();

  frame.forEach((color, index) => {
    const cell = document.createElement("div");

    cell.className = "pixel";

    cell.dataset.index = index;

    if (color) {
      cell.style.background = color;
      cell.classList.add("filled");
    }

    /*
     * Onion skin uses the previous frame.
     */
    if (state.onionSkin && previousFrame && !color && previousFrame[index]) {
      cell.classList.add("onion");
      cell.style.setProperty("--onion-color", previousFrame[index]);
    }

    fragment.appendChild(cell);
  });

  pixelGrid.appendChild(fragment);

  updateFrameInfo();
}

function updateFrameInfo() {
  frameInfo.textContent = `Frame ${state.activeFrame + 1} / ${
    state.frames.length
  } · ${state.width} × ${state.height}`;

  metaFrames.textContent = state.frames.length;

  metaCanvas.textContent = `${state.width}×${state.height}`;

  metaFPS.textContent = state.fps;
}

/*TIMELINE*/

function renderTimeline() {
  timeline.innerHTML = "";

  state.frames.forEach((frame, index) => {
    const card = document.createElement("div");

    card.className =
      "frame-card" + (index === state.activeFrame ? " active" : "");

    card.dataset.frame = index;

    const thumbnail = document.createElement("div");

    thumbnail.className = "frame-thumbnail";

    thumbnail.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;

    thumbnail.style.gridTemplateRows = `repeat(${state.height}, 1fr)`;

    frame.forEach((color) => {
      const pixel = document.createElement("div");

      pixel.className = "thumbnail-pixel";

      if (color) {
        pixel.style.background = color;
      }

      thumbnail.appendChild(pixel);
    });

    const label = document.createElement("div");

    label.className = "frame-number";

    label.textContent = `Frame ${index + 1}`;

    card.appendChild(thumbnail);
    card.appendChild(label);

    card.addEventListener("click", () => selectFrame(index));

    timeline.appendChild(card);
  });
}

function selectFrame(index) {
  if (index < 0 || index >= state.frames.length) {
    return;
  }

  state.activeFrame = index;

  renderEverything();

  saveToLocalStorage();
}

function addFrame() {
  pushHistory();

  state.frames.splice(
    state.activeFrame + 1,
    0,
    createBlankFrame(state.width, state.height),
  );

  state.activeFrame++;

  renderEverything();

  saveToLocalStorage();

  showToast("Blank frame added");
}

function duplicateFrame() {
  pushHistory();

  state.frames.splice(state.activeFrame + 1, 0, cloneFrame(getCurrentFrame()));

  state.activeFrame++;

  renderEverything();

  saveToLocalStorage();

  showToast("Frame duplicated");
}

function deleteFrame() {
  if (state.frames.length === 1) {
    showToast("You need at least one frame");
    return;
  }

  pushHistory();

  state.frames.splice(state.activeFrame, 1);

  state.activeFrame = Math.min(state.activeFrame, state.frames.length - 1);

  renderEverything();

  saveToLocalStorage();

  showToast("Frame deleted");
}

function moveFrame(direction) {
  const target = state.activeFrame + direction;

  if (target < 0 || target >= state.frames.length) {
    return;
  }

  pushHistory();

  const temp = state.frames[state.activeFrame];

  state.frames[state.activeFrame] = state.frames[target];

  state.frames[target] = temp;

  state.activeFrame = target;

  renderEverything();

  saveToLocalStorage();
}

/*RESIZE CANVAS*/

function resizeCanvas(newSize) {
  const oldWidth = state.width;
  const oldHeight = state.height;

  if (newSize === oldWidth && newSize === oldHeight) {
    return;
  }

  pushHistory();

  state.frames = state.frames.map((oldFrame) => {
    const newFrame = createBlankFrame(newSize, newSize);

    const overlapWidth = Math.min(oldWidth, newSize);

    const overlapHeight = Math.min(oldHeight, newSize);

    for (let y = 0; y < overlapHeight; y++) {
      for (let x = 0; x < overlapWidth; x++) {
        const oldIndex = y * oldWidth + x;

        const newIndex = y * newSize + x;

        newFrame[newIndex] = oldFrame[oldIndex];
      }
    }

    return newFrame;
  });

  state.width = newSize;
  state.height = newSize;

  renderEverything();

  saveToLocalStorage();

  showToast(`Canvas resized to ${newSize}×${newSize}`);
}

/*CLEAR*/

function clearCurrentFrame() {
  pushHistory();

  state.frames[state.activeFrame] = createBlankFrame(state.width, state.height);

  renderEverything();

  saveToLocalStorage();

  showToast("Frame cleared");
}

function clearAllFrames() {
  pushHistory();

  state.frames = state.frames.map(() =>
    createBlankFrame(state.width, state.height),
  );

  renderEverything();

  saveToLocalStorage();

  showToast("All frames cleared");
}

/*COLOR*/

function setColor(color) {
  state.color = color.toUpperCase();

  colorPicker.value = normalizeColorForInput(state.color);

  currentColor.textContent = state.color;

  addRecentColor(state.color);

  renderPalette();
}

function normalizeColorForInput(color) {
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color;
  }

  return "#302A35";
}

function addRecentColor(color) {
  state.recentColors = state.recentColors.filter((item) => item !== color);

  state.recentColors.unshift(color);

  state.recentColors = state.recentColors.slice(0, 12);

  saveToLocalStorage();
}

function createSwatch(color) {
  const button = document.createElement("button");

  button.className = "swatch";

  if (color === state.color) {
    button.classList.add("selected");
  }

  button.style.background = color;
  button.title = color;

  button.addEventListener("click", () => {
    state.tool = "paint";

    updateToolButtons();

    setColor(color);
  });

  return button;
}

function renderPalette() {
  const palette = $("#palette");

  const recent = $("#recentPalette");

  palette.innerHTML = "";
  recent.innerHTML = "";

  CONFIG.PALETTE.forEach((color) => {
    palette.appendChild(createSwatch(color));
  });

  state.recentColors.forEach((color) => {
    recent.appendChild(createSwatch(color));
  });
}

/*TOOLS*/

function setTool(tool) {
  state.tool = tool;

  updateToolButtons();
}

function updateToolButtons() {
  $("#paintBtn").classList.toggle("active", state.tool === "paint");

  $("#eraseBtn").classList.toggle("active", state.tool === "erase");
}

function setSymmetry(mode) {
  state.symmetry = mode;

  $("#symOffBtn").classList.toggle("active", mode === "off");

  $("#symHorizontalBtn").classList.toggle("active", mode === "horizontal");

  $("#symVerticalBtn").classList.toggle("active", mode === "vertical");

  $("#symBothBtn").classList.toggle("active", mode === "both");

  const labelMap = {
    off: "Symmetry: Off",
    horizontal: "Symmetry: Horizontal",
    vertical: "Symmetry: Vertical",
    both: "Symmetry: Both",
  };

  $("#symmetryBtn").querySelector("span").textContent = labelMap[mode];
}

function cycleSymmetry() {
  const modes = ["off", "horizontal", "vertical", "both"];

  const current = modes.indexOf(state.symmetry);

  setSymmetry(modes[(current + 1) % modes.length]);
}

/*ONION SKIN*/

function toggleOnionSkin() {
  state.onionSkin = !state.onionSkin;

  $("#onionBtn").classList.toggle("active", state.onionSkin);

  renderGrid();

  saveToLocalStorage();
}

/*PREVIEW*/

function compileFrameToShadows(frame, includeEmpty = false) {
  const shadows = [];

  frame.forEach((color, index) => {
    if (!color && !includeEmpty) {
      return;
    }

    const { x, y } = getCoordinates(index);

    if (color) {
      shadows.push(`${x}px ${y}px 0 ${color}`);
    }
  });

  return shadows.join(",\n        ");
}

function compileCSS() {
  const frameCount = state.frames.length;

  const duration = frameCount / state.fps;

  let keyframes = "";

  state.frames.forEach((frame, index) => {
    const percentage = frameCount === 1 ? 0 : (index / frameCount) * 100;

    const shadows = compileFrameToShadows(frame);

    keyframes += `
    ${percentage.toFixed(4)}% {
        box-shadow: ${shadows || "0 0 0 transparent"};
    }`;
  });

  /*
   * Duplicate first frame at 100%.
   * This gives the animation a clean loop.
   */
  const firstShadows = compileFrameToShadows(state.frames[0]);

  keyframes += `
    100% {
        box-shadow: ${firstShadows || "0 0 0 transparent"};
    }`;

  return `/* Niche Sprite Sprout: generated CSS */

@keyframes nichePixelSprite {
${keyframes}
}

.pixel-sprite {
    width: 1px;
    height: 1px;

    background: transparent;

    animation:
        nichePixelSprite ${duration.toFixed(3)}s
        steps(1)
        infinite;

    image-rendering: pixelated;
}
`;
}

function injectAnimationCSS() {
  let style = document.getElementById("runtimePixelAnimation");

  if (!style) {
    style = document.createElement("style");

    style.id = "runtimePixelAnimation";

    document.head.appendChild(style);
  }

  style.textContent = compileCSS();
}

function renderPreview() {
  injectAnimationCSS();

  const duration = state.frames.length / state.fps;

  previewSprite.style.transform = `scale(${state.previewScale})`;

  previewSprite.style.animationDuration = `${duration}s`;

  previewSprite.classList.toggle("playing", state.playing);

  /*
   * Force animation restart when
   * the compiled CSS changes.
   */
  if (state.playing) {
    previewSprite.style.animationName = "none";

    requestAnimationFrame(() => {
      previewSprite.style.animationName = "nichePixelSprite";
    });
  }
}

function togglePlayback() {
  state.playing = !state.playing;

  $("#playBtn").textContent = state.playing ? "Pause" : "Play";

  renderPreview();
}

/*FPS*/

function updateFPS(value) {
  state.fps = Number(value);

  fpsValue.textContent = `${state.fps} FPS`;

  fpsRange.value = state.fps;

  renderPreview();
  updateFrameInfo();

  saveToLocalStorage();
}

/*SCALE*/

function updateScale(scale) {
  state.previewScale = Number(scale);

  $$(".scale-btn").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.scale) === state.previewScale,
    );
  });

  renderPreview();
}

/*PNG EXPORT*/

function frameToCanvas(frame, pixelSize = 1) {
  const canvas = document.createElement("canvas");

  canvas.width = state.width * pixelSize;

  canvas.height = state.height * pixelSize;

  const ctx = canvas.getContext("2d");

  ctx.imageSmoothingEnabled = false;

  frame.forEach((color, index) => {
    if (!color) {
      return;
    }

    const { x, y } = getCoordinates(index);

    ctx.fillStyle = color;

    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
  });

  return canvas;
}

function downloadCanvas(canvas, filename) {
  const link = document.createElement("a");

  link.download = filename;

  link.href = canvas.toDataURL("image/png");

  link.click();
}

function exportCurrentFrame() {
  const canvas = frameToCanvas(getCurrentFrame(), 16);

  downloadCanvas(
    canvas,
    `${state.projectName}-frame-${state.activeFrame + 1}.png`,
  );

  showToast("Frame exported");
}

function exportSpritesheet() {
  const scale = 16;

  const canvas = document.createElement("canvas");

  canvas.width = state.width * scale * state.frames.length;

  canvas.height = state.height * scale;

  const ctx = canvas.getContext("2d");

  ctx.imageSmoothingEnabled = false;

  state.frames.forEach((frame, frameIndex) => {
    frame.forEach((color, index) => {
      if (!color) {
        return;
      }

      const { x, y } = getCoordinates(index);

      ctx.fillStyle = color;

      ctx.fillRect(
        (frameIndex * state.width + x) * scale,

        y * scale,

        scale,
        scale,
      );
    });
  });

  downloadCanvas(canvas, `${state.projectName}-spritesheet.png`);

  showToast("Spritesheet exported");
}

/*PROJECT EXPORT*/

function getProjectData() {
  return {
    format: "niche-pixel-art",
    version: 2,

    name: state.projectName,

    width: state.width,
    height: state.height,

    fps: state.fps,

    frames: cloneFrames(state.frames),
  };
}

function exportProject() {
  const data = JSON.stringify(getProjectData(), null, 2);

  const blob = new Blob([data], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = `${state.projectName || "pixel-project"}.json`;

  link.click();

  URL.revokeObjectURL(url);

  showToast("Project exported");
}

function importProject(file) {
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);

      if (data.format !== "niche-pixel-art") {
        throw new Error("Invalid project format");
      }

      if (
        !Number.isInteger(data.width) ||
        !Number.isInteger(data.height) ||
        !Array.isArray(data.frames)
      ) {
        throw new Error("Incomplete project");
      }

      const expectedLength = data.width * data.height;

      const validFrames = data.frames.every(
        (frame) => Array.isArray(frame) && frame.length === expectedLength,
      );

      if (!validFrames) {
        throw new Error("Invalid frame data");
      }

      pushHistory();

      state.width = data.width;

      state.height = data.height;

      state.frames = data.frames.map((frame) => [...frame]);

      state.fps = Number(data.fps) || CONFIG.DEFAULT_FPS;

      state.activeFrame = 0;

      state.projectName = data.name || "imported-sprite";

      projectNameInput.value = state.projectName;

      fpsRange.value = state.fps;

      renderEverything();

      saveToLocalStorage();

      showToast("Project imported successfully");
    } catch (error) {
      console.error(error);

      showToast("Could not import that project");
    }
  };

  reader.readAsText(file);
}

/*LOCAL STORAGE*/

function saveToLocalStorage() {
  const data = {
    format: "niche-pixel-art",
    version: 2,

    name: state.projectName,

    width: state.width,
    height: state.height,

    fps: state.fps,

    frames: cloneFrames(state.frames),

    recentColors: state.recentColors,
  };

  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));

    $("#saveBtn").textContent = "Saved ✓";
  } catch (error) {
    console.warn("Could not save project", error);

    $("#saveBtn").textContent = "Save unavailable";
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);

    if (!raw) {
      return false;
    }

    const data = JSON.parse(raw);

    if (data.format !== "niche-pixel-art") {
      return false;
    }

    state.width = Number(data.width) || CONFIG.DEFAULT_SIZE;

    state.height = Number(data.height) || CONFIG.DEFAULT_SIZE;

    state.fps = Number(data.fps) || CONFIG.DEFAULT_FPS;

    state.frames =
      Array.isArray(data.frames) && data.frames.length
        ? data.frames.map((frame) => [...frame])
        : [createBlankFrame(state.width, state.height)];

    state.projectName = data.name || "my-pixel-sprite";

    state.recentColors = Array.isArray(data.recentColors)
      ? data.recentColors
      : [];

    state.activeFrame = 0;

    projectNameInput.value = state.projectName;

    fpsRange.value = state.fps;

    return true;
  } catch (error) {
    console.warn("Could not restore project", error);

    return false;
  }
}

/*COPY CSS*/

async function copyCSS() {
  const css = compileCSS();

  cssOutput.value = css;

  try {
    await navigator.clipboard.writeText(css);

    showToast("CSS copied to clipboard");
  } catch (error) {
    cssOutput.focus();
    cssOutput.select();

    try {
      document.execCommand("copy");

      showToast("CSS copied to clipboard");
    } catch {
      showToast("Select the CSS manually");
    }
  }
}

/*MODAL*/

let modalConfirmAction = null;

function openConfirm(title, text, action) {
  $("#modalTitle").textContent = title;

  $("#modalText").textContent = text;

  modalConfirmAction = action;

  $("#confirmModal").classList.add("open");
}

function closeConfirm() {
  $("#confirmModal").classList.remove("open");

  modalConfirmAction = null;
}

/*TOAST*/

let toastTimer = null;

function showToast(message) {
  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

/*RENDER EVERYTHING*/

function renderEverything() {
  renderGrid();

  renderTimeline();

  renderPalette();

  renderPreview();

  updateToolButtons();

  updateFrameInfo();

  updateHistoryButtons();

  cssOutput.value = compileCSS();

  fpsRange.value = state.fps;

  fpsValue.textContent = `${state.fps} FPS`;

  currentColor.textContent = state.color;

  colorPicker.value = normalizeColorForInput(state.color);

  projectNameInput.value = state.projectName;

  $$(".size-btn").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.size) === state.width,
    );
  });

  updateScale(state.previewScale);

  setSymmetry(state.symmetry);
}

/*EVENT LISTENERS*/

/* Drawing */

pixelGrid.addEventListener("pointerdown", handlePointerDown);

pixelGrid.addEventListener("pointermove", handlePointerMove);

window.addEventListener("pointerup", endDrawing);

/* Right click = erase */

pixelGrid.addEventListener("contextmenu", (event) => {
  event.preventDefault();

  const cell = event.target.closest(".pixel");

  if (!cell) {
    return;
  }

  pushHistory();

  const index = Number(cell.dataset.index);

  const { x, y } = getCoordinates(index);

  applySymmetry(x, y, null);

  renderEverything();

  saveToLocalStorage();
});

/* Tools */

$("#paintBtn").addEventListener("click", () => setTool("paint"));

$("#eraseBtn").addEventListener("click", () => setTool("erase"));

$("#onionBtn").addEventListener("click", toggleOnionSkin);

$("#symmetryBtn").addEventListener("click", cycleSymmetry);

/* Symmetry */

$("#symOffBtn").addEventListener("click", () => setSymmetry("off"));

$("#symHorizontalBtn").addEventListener("click", () =>
  setSymmetry("horizontal"),
);

$("#symVerticalBtn").addEventListener("click", () => setSymmetry("vertical"));

$("#symBothBtn").addEventListener("click", () => setSymmetry("both"));

/* Colors */

colorPicker.addEventListener("input", (event) => {
  setColor(event.target.value);
});

/* Canvas size */

$$(".size-btn").forEach((button) => {
  button.addEventListener("click", () => {
    resizeCanvas(Number(button.dataset.size));
  });
});

/* History */

$("#undoBtn").addEventListener("click", undo);

$("#redoBtn").addEventListener("click", redo);

/* Clear */

$("#clearFrameBtn").addEventListener("click", () => {
  openConfirm(
    "Clear this frame?",
    "Every pixel in the current frame will be removed.",
    clearCurrentFrame,
  );
});

$("#clearAllBtn").addEventListener("click", () => {
  openConfirm(
    "Clear every frame?",
    "Every frame will become blank. Your current project will remain otherwise unchanged.",
    clearAllFrames,
  );
});

/* Timeline */

$("#addFrameBtn").addEventListener("click", addFrame);

$("#duplicateFrameBtn").addEventListener("click", duplicateFrame);

$("#deleteFrameBtn").addEventListener("click", deleteFrame);

$("#moveLeftBtn").addEventListener("click", () => moveFrame(-1));

$("#moveRightBtn").addEventListener("click", () => moveFrame(1));

/* Preview */

$("#playBtn").addEventListener("click", togglePlayback);

fpsRange.addEventListener("input", (event) => {
  updateFPS(event.target.value);
});

$$(".scale-btn").forEach((button) => {
  button.addEventListener("click", () => {
    updateScale(button.dataset.scale);
  });
});

/* Export */

$("#copyCSSBtn").addEventListener("click", copyCSS);

$("#refreshCSSBtn").addEventListener("click", () => {
  cssOutput.value = compileCSS();

  injectAnimationCSS();

  showToast("CSS recompiled");
});

$("#exportFrameBtn").addEventListener("click", exportCurrentFrame);

$("#exportSheetBtn").addEventListener("click", exportSpritesheet);

/* Project */

projectNameInput.addEventListener("input", (event) => {
  state.projectName = event.target.value || "my-pixel-sprite";

  saveToLocalStorage();
});

$("#exportProjectBtn").addEventListener("click", exportProject);

$("#importProjectBtn").addEventListener("click", () => {
  $("#projectFile").click();
});

$("#projectFile").addEventListener("change", (event) => {
  const file = event.target.files[0];

  if (file) {
    importProject(file);
  }

  event.target.value = "";
});

/* Modal */

$("#modalCancel").addEventListener("click", closeConfirm);

$("#modalConfirm").addEventListener("click", () => {
  if (typeof modalConfirmAction === "function") {
    modalConfirmAction();
  }

  closeConfirm();
});

$("#confirmModal").addEventListener("click", (event) => {
  if (event.target === $("#confirmModal")) {
    closeConfirm();
  }
});

/*KEYBOARD SHORTCUTS*/

document.addEventListener("keydown", (event) => {
  /*
   * Don't steal shortcuts while typing.
   */
  const tag = event.target.tagName;

  const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

  if (isTyping) {
    return;
  }

  /* Undo */

  if (event.ctrlKey && event.key.toLowerCase() === "z") {
    event.preventDefault();

    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }

    return;
  }

  /* Redo */

  if (event.ctrlKey && event.key.toLowerCase() === "y") {
    event.preventDefault();

    redo();

    return;
  }

  /* Paint */

  if (event.key.toLowerCase() === "p") {
    setTool("paint");

    return;
  }

  /* Eraser */

  if (event.key.toLowerCase() === "e") {
    setTool("erase");

    return;
  }

  /* Onion */

  if (event.key.toLowerCase() === "o") {
    toggleOnionSkin();

    return;
  }

  /* Duplicate */

  if (event.key.toLowerCase() === "d") {
    duplicateFrame();

    return;
  }

  /* Play */

  if (event.code === "Space") {
    event.preventDefault();

    togglePlayback();

    return;
  }

  /* Previous frame */

  if (event.key === "ArrowLeft") {
    event.preventDefault();

    selectFrame(state.activeFrame - 1);

    return;
  }

  /* Next frame */

  if (event.key === "ArrowRight") {
    event.preventDefault();

    selectFrame(state.activeFrame + 1);

    return;
  }
});

/*INITIALIZATION*/

const restored = loadFromLocalStorage();

if (!restored) {
  state.history = [snapshot()];

  state.historyIndex = 0;
}

renderEverything();

showToast(restored ? "Restored your last project" : "Ready to draw");
