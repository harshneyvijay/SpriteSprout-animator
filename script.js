/* =========================================================
   SPRITE SPROUT
   Spritesheet Animator
   ========================================================= */

"use strict";

/* =========================================================
   HELPERS
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [...document.querySelectorAll(selector)];

const clone = (value) => JSON.parse(JSON.stringify(value));

/* =========================================================
   CONSTANTS
   ========================================================= */

const STORAGE_KEY = "sprite-sprout-project-v1";

const PALETTE = [
  "#302A35",
  "#5C4B51",
  "#9B5963",
  "#D67A72",
  "#F3A678",
  "#F7D774",
  "#F9E9A9",
  "#A9D9C2",
  "#5E9E8A",
  "#78B6D0",
  "#4C6A92",
  "#F1EFE7",
  "#FFFFFF",
];

/* =========================================================
   STATE
   ========================================================= */

const state = {
  width: 8,
  height: 8,

  fps: 8,

  frames: [createEmptyFrame(8, 8)],

  activeFrameIndex: 0,

  tool: "paint",

  color: "#302A35",

  symmetry: "off",

  onionSkin: false,

  isPlaying: true,

  scale: 6,

  isDrawing: false,

  history: [],

  redoStack: [],

  recentColors: [],

  projectName: "my-pixel-sprite",
};

/* =========================================================
   FRAME CREATION
   ========================================================= */

function createEmptyFrame(width, height) {
  return Array(width * height).fill(null);
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", init);

function init() {
  buildPalette();

  bindToolbar();

  bindEditorControls();

  bindSymmetryControls();

  bindTimelineControls();

  bindPreviewControls();

  bindExportControls();

  bindProjectControls();

  bindKeyboardShortcuts();

  restoreAutosave();

  renderAll();
}

/* =========================================================
   PALETTE
   ========================================================= */

function buildPalette() {
  const palette = $("#palette");

  palette.innerHTML = "";

  PALETTE.forEach((color) => {
    const button = document.createElement("button");

    button.type = "button";

    button.style.background = color;

    button.title = color;

    button.addEventListener("click", () => {
      setColor(color);
    });

    palette.appendChild(button);
  });
}

function buildRecentPalette() {
  const container = $("#palette");

  if (!state.recentColors.length) {
    return;
  }

  /*
   * Keep the main palette intact and mark recent colors
   * through title / ordering rather than creating another
   * large control.
   */
}

function setColor(color) {
  state.color = color.toUpperCase();

  $("#colorPicker").value = color;

  $("#currentColor").textContent = state.color;

  if (!state.recentColors.includes(state.color)) {
    state.recentColors.unshift(state.color);

    state.recentColors = state.recentColors.slice(0, 8);
  }
}

/* =========================================================
   TOOLBAR
   ========================================================= */

function bindToolbar() {
  $("#paintBtn").addEventListener("click", () => {
    state.tool = "paint";

    syncToolbar();
  });

  $("#eraseBtn").addEventListener("click", () => {
    state.tool = "erase";

    syncToolbar();
  });

  $("#onionBtn").addEventListener("click", () => {
    state.onionSkin = !state.onionSkin;

    syncToolbar();

    renderGrid();
  });

  $("#symmetryBtn").addEventListener("click", () => {
    cycleSymmetry();
  });

  $("#clearFrameBtn").addEventListener("click", () => {
    confirmAction(
      "Clear current frame?",
      "Every pixel in the selected frame will be removed.",
      clearCurrentFrame,
    );
  });

  $("#clearAllBtn").addEventListener("click", () => {
    confirmAction(
      "Clear all frames?",
      "Every frame in the animation will be cleared.",
      clearAllFrames,
    );
  });

  $("#undoBtn").addEventListener("click", undo);

  $("#redoBtn").addEventListener("click", redo);
}

function syncToolbar() {
  $("#paintBtn").classList.toggle("active", state.tool === "paint");

  $("#eraseBtn").classList.toggle("active", state.tool === "erase");

  $("#onionBtn").classList.toggle("active", state.onionSkin);

  const labels = {
    off: "Symmetry: Off",
    horizontal: "Symmetry: Horizontal",
    vertical: "Symmetry: Vertical",
    both: "Symmetry: Both",
  };

  $("#symmetryToolbarText").textContent = labels[state.symmetry];
}

/* =========================================================
   SYMMETRY
   ========================================================= */

function bindSymmetryControls() {
  const buttons = {
    off: $("#symOffBtn"),
    horizontal: $("#symHorizontalBtn"),
    vertical: $("#symVerticalBtn"),
    both: $("#symBothBtn"),
  };

  Object.entries(buttons).forEach(([mode, button]) => {
    button.addEventListener("click", () => {
      state.symmetry = mode;

      syncSymmetry();

      renderGrid();
    });
  });
}

function syncSymmetry() {
  const modes = ["off", "horizontal", "vertical", "both"];

  modes.forEach((mode) => {
    const id = mode === "off" ? "#symOffBtn" : `#sym${capitalize(mode)}Btn`;

    const button = $(id);

    if (button) {
      button.classList.toggle("active", state.symmetry === mode);
    }
  });

  syncToolbar();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function cycleSymmetry() {
  const modes = ["off", "horizontal", "vertical", "both"];

  const current = modes.indexOf(state.symmetry);

  state.symmetry = modes[(current + 1) % modes.length];

  syncSymmetry();

  renderGrid();
}

/* =========================================================
   EDITOR CONTROLS
   ========================================================= */

function bindEditorControls() {
  $$(".size-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const size = Number(button.dataset.size);

      if (size === state.width && size === state.height) {
        return;
      }

      resizeCanvas(size, size);
    });
  });

  $("#colorPicker").addEventListener("input", (event) => {
    setColor(event.target.value);
  });
}

/* =========================================================
   CANVAS RESIZE
   ========================================================= */

function resizeCanvas(newWidth, newHeight) {
  pushHistory();

  state.frames = state.frames.map((oldFrame) => {
    const newFrame = createEmptyFrame(newWidth, newHeight);

    const copyWidth = Math.min(state.width, newWidth);

    const copyHeight = Math.min(state.height, newHeight);

    for (let y = 0; y < copyHeight; y++) {
      for (let x = 0; x < copyWidth; x++) {
        const oldIndex = y * state.width + x;

        const newIndex = y * newWidth + x;

        newFrame[newIndex] = oldFrame[oldIndex];
      }
    }

    return newFrame;
  });

  state.width = newWidth;
  state.height = newHeight;

  showToast(`Canvas changed to ${newWidth}×${newHeight}`);

  renderAll();

  autosave();
}

/* =========================================================
   PIXEL GRID
   ========================================================= */

function renderGrid() {
  const grid = $("#pixelGrid");

  grid.innerHTML = "";

  grid.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;

  grid.style.gridTemplateRows = `repeat(${state.height}, 1fr)`;

  const frame = state.frames[state.activeFrameIndex];

  frame.forEach((color, index) => {
    const pixel = document.createElement("div");

    pixel.className = "pixel";

    if (color) {
      pixel.style.background = color;
    }

    pixel.dataset.index = index;

    pixel.addEventListener("pointerdown", handlePixelPointerDown);

    pixel.addEventListener("pointerenter", handlePixelPointerEnter);

    pixel.addEventListener("contextmenu", (event) => {
      event.preventDefault();

      paintIndex(index, "erase");
    });

    grid.appendChild(pixel);
  });

  renderOnionSkin();
}

function renderOnionSkin() {
  if (!state.onionSkin) {
    return;
  }

  if (state.activeFrameIndex === 0) {
    return;
  }

  const previousFrame = state.frames[state.activeFrameIndex - 1];

  const pixels = $$(".pixel");

  previousFrame.forEach((color, index) => {
    if (!color) {
      return;
    }

    const pixel = pixels[index];

    if (!pixel) {
      return;
    }

    pixel.classList.add("onion");

    pixel.style.background = `${color}55`;
  });
}

/* =========================================================
   PAINTING
   ========================================================= */

function handlePixelPointerDown(event) {
  event.preventDefault();

  state.isDrawing = true;

  pushHistory();

  const index = Number(event.currentTarget.dataset.index);

  const tool = event.button === 2 ? "erase" : state.tool;

  paintIndex(index, tool);
}

function handlePixelPointerEnter(event) {
  if (!state.isDrawing) {
    return;
  }

  const index = Number(event.currentTarget.dataset.index);

  paintIndex(index, state.tool);
}

window.addEventListener("pointerup", () => {
  if (!state.isDrawing) {
    return;
  }

  state.isDrawing = false;

  renderPreview();

  autosave();
});

function paintIndex(index, tool = state.tool) {
  const x = index % state.width;

  const y = Math.floor(index / state.width);

  const targets = getSymmetryTargets(x, y);

  targets.forEach(({ x, y }) => {
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) {
      return;
    }

    const targetIndex = y * state.width + x;

    state.frames[state.activeFrameIndex][targetIndex] =
      tool === "erase" ? null : state.color;
  });

  renderGrid();
}

/* =========================================================
   SYMMETRY TARGETS
   ========================================================= */

function getSymmetryTargets(x, y) {
  const targets = [{ x, y }];

  if (state.symmetry === "horizontal" || state.symmetry === "both") {
    targets.push({
      x: state.width - 1 - x,
      y,
    });
  }

  if (state.symmetry === "vertical" || state.symmetry === "both") {
    targets.push({
      x,
      y: state.height - 1 - y,
    });
  }

  if (state.symmetry === "both") {
    targets.push({
      x: state.width - 1 - x,
      y: state.height - 1 - y,
    });
  }

  const unique = new Map();

  targets.forEach((target) => {
    unique.set(`${target.x}:${target.y}`, target);
  });

  return [...unique.values()];
}

/* =========================================================
   TIMELINE
   ========================================================= */

function bindTimelineControls() {
  $("#addFrameBtn").addEventListener("click", addFrame);

  $("#duplicateFrameBtn").addEventListener("click", duplicateFrame);

  $("#deleteFrameBtn").addEventListener("click", deleteFrame);

  $("#moveLeftBtn").addEventListener("click", () => moveFrame(-1));

  $("#moveRightBtn").addEventListener("click", () => moveFrame(1));
}

function renderTimeline() {
  const timeline = $("#timeline");

  timeline.innerHTML = "";

  state.frames.forEach((frame, index) => {
    const item = document.createElement("div");

    item.className = "frame-thumb";

    if (index === state.activeFrameIndex) {
      item.classList.add("active");
    }

    item.addEventListener("click", () => selectFrame(index));

    const number = document.createElement("span");

    number.className = "frame-number";

    number.textContent = String(index + 1);

    item.appendChild(number);

    const preview = document.createElement("div");

    preview.className = "frame-preview";

    preview.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;

    preview.style.gridTemplateRows = `repeat(${state.height}, 1fr)`;

    frame.forEach((color) => {
      const pixel = document.createElement("div");

      if (color) {
        pixel.style.background = color;
      }

      preview.appendChild(pixel);
    });

    item.appendChild(preview);

    timeline.appendChild(item);
  });

  $("#timelineFrameCount").textContent = `${state.frames.length} ${
    state.frames.length === 1 ? "frame" : "frames"
  }`;
}

function selectFrame(index) {
  if (index < 0 || index >= state.frames.length) {
    return;
  }

  state.activeFrameIndex = index;

  renderAll();
}

function addFrame() {
  pushHistory();

  state.frames.splice(
    state.activeFrameIndex + 1,
    0,
    createEmptyFrame(state.width, state.height),
  );

  state.activeFrameIndex++;

  state.isPlaying = false;

  syncPlayButton();

  showToast("Blank frame added");

  renderAll();

  autosave();
}

function duplicateFrame() {
  pushHistory();

  const current = state.frames[state.activeFrameIndex];

  state.frames.splice(state.activeFrameIndex + 1, 0, clone(current));

  state.activeFrameIndex++;

  state.isPlaying = false;

  syncPlayButton();

  showToast("Frame duplicated");

  renderAll();

  autosave();
}

function deleteFrame() {
  if (state.frames.length === 1) {
    clearCurrentFrame();

    return;
  }

  confirmAction(
    "Delete this frame?",
    "The selected frame will be permanently removed.",
    () => {
      pushHistory();

      state.frames.splice(state.activeFrameIndex, 1);

      state.activeFrameIndex = Math.min(
        state.activeFrameIndex,
        state.frames.length - 1,
      );

      showToast("Frame deleted");

      renderAll();

      autosave();
    },
  );
}

function moveFrame(direction) {
  const from = state.activeFrameIndex;

  const to = from + direction;

  if (to < 0 || to >= state.frames.length) {
    return;
  }

  pushHistory();

  [state.frames[from], state.frames[to]] = [
    state.frames[to],
    state.frames[from],
  ];

  state.activeFrameIndex = to;

  renderAll();

  autosave();
}

/* =========================================================
   CLEAR
   ========================================================= */

function clearCurrentFrame() {
  pushHistory();

  state.frames[state.activeFrameIndex] = createEmptyFrame(
    state.width,
    state.height,
  );

  showToast("Current frame cleared");

  renderAll();

  autosave();
}

function clearAllFrames() {
  pushHistory();

  state.frames = state.frames.map(() =>
    createEmptyFrame(state.width, state.height),
  );

  showToast("All frames cleared");

  renderAll();

  autosave();
}

/* =========================================================
   PREVIEW
   ========================================================= */

function bindPreviewControls() {
  $("#playBtn").addEventListener("click", togglePlayback);

  $("#fpsRange").addEventListener("input", (event) => {
    state.fps = Number(event.target.value);

    updateFPS();

    updateAnimationStyle();

    autosave();
  });

  $$(".scale-controls button").forEach((button) => {
    button.addEventListener("click", () => {
      state.scale = Number(button.dataset.scale);

      syncScaleButtons();

      updatePreviewScale();
    });
  });
}

function togglePlayback() {
  state.isPlaying = !state.isPlaying;

  syncPlayButton();
}

function syncPlayButton() {
  const button = $("#playBtn");

  button.textContent = state.isPlaying ? "Pause" : "Play";

  $("#previewSprite").classList.toggle("playing", state.isPlaying);

  $("#previewSprite").classList.toggle("paused", !state.isPlaying);
}

function updateFPS() {
  $("#fpsRange").value = state.fps;

  $("#fpsValue").textContent = `${state.fps} FPS`;

  $("#metaFPS").textContent = state.fps;
}

function syncScaleButtons() {
  $$(".scale-controls button").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.scale) === state.scale,
    );
  });
}

function updatePreviewScale() {
  const sprite = $("#previewSprite");

  sprite.style.transform = `scale(${state.scale})`;
}

function renderPreview() {
  updateAnimationStyle();

  updatePreviewScale();
}

/* =========================================================
   CSS COMPILER
   ========================================================= */

function compileCSS() {
  const frameCount = state.frames.length;

  const frameDuration = 1 / state.fps;

  const lines = [];

  lines.push(`/* Sprite Sprout export: ${state.projectName} */`);

  lines.push(`.sprite-sprout {`);

  lines.push(`  width: 1px;`);

  lines.push(`  height: 1px;`);

  lines.push(`  image-rendering: pixelated;`);

  lines.push(
    `  animation: ${slugify(state.projectName)} ${(
      frameDuration * frameCount
    ).toFixed(3)}s steps(1) infinite;`,
  );

  lines.push(`}`);

  lines.push("");

  lines.push(`@keyframes ${slugify(state.projectName)} {`);

  state.frames.forEach((frame, frameIndex) => {
    const percent = frameCount === 1 ? 0 : (frameIndex / frameCount) * 100;

    const shadows = compileFrameShadows(frame);

    lines.push(`  ${percent.toFixed(2)}% {`);

    lines.push(`    box-shadow: ${shadows || "none"};`);

    lines.push(`  }`);
  });

  lines.push("}");

  return lines.join("\n");
}

function compileFrameShadows(frame) {
  const shadows = [];

  frame.forEach((color, index) => {
    if (!color) {
      return;
    }

    const x = index % state.width;

    const y = Math.floor(index / state.width);

    shadows.push(`${x}px ${y}px 0 ${color}`);
  });

  return shadows.join(",\n      ");
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sprite-animation"
  );
}

function updateAnimationStyle() {
  const css = compileCSS();

  $("#cssOutput").value = css;

  let style = document.getElementById("sprite-runtime-style");

  if (!style) {
    style = document.createElement("style");

    style.id = "sprite-runtime-style";

    document.head.appendChild(style);
  }

  const animationName = slugify(state.projectName);

  const duration = (state.frames.length / state.fps).toFixed(3);

  const keyframes = state.frames
    .map((frame, index) => {
      const percent =
        state.frames.length === 1 ? 0 : (index / state.frames.length) * 100;

      const shadows = compileFrameShadows(frame);

      return `
          ${percent.toFixed(2)}% {
            box-shadow: ${shadows || "none"};
          }
        `;
    })
    .join("\n");

  style.textContent = `

    @keyframes ${animationName} {
      ${keyframes}
    }

    .preview-sprite {
      animation-name: ${animationName};
      animation-duration: ${duration}s;
      animation-timing-function: steps(1, end);
      animation-iteration-count: infinite;
      animation-play-state: ${state.isPlaying ? "running" : "paused"};
    }

  `;
}

/* =========================================================
   EXPORT CONTROLS
   ========================================================= */

function bindExportControls() {
  $("#copyCSSBtn").addEventListener("click", async () => {
    const css = compileCSS();

    try {
      await navigator.clipboard.writeText(css);

      showToast("CSS copied to clipboard");
    } catch {
      $("#cssOutput").select();

      document.execCommand("copy");

      showToast("CSS copied");
    }
  });

  $("#refreshCSSBtn").addEventListener("click", () => {
    updateAnimationStyle();

    showToast("CSS recompiled");
  });

  $("#exportFrameBtn").addEventListener("click", exportCurrentFrame);

  $("#exportSheetBtn").addEventListener("click", exportSpritesheet);
}

/* =========================================================
   PNG EXPORT
   ========================================================= */

function createFrameCanvas(frame, scale = 16) {
  const canvas = document.createElement("canvas");

  canvas.width = state.width * scale;

  canvas.height = state.height * scale;

  const context = canvas.getContext("2d");

  context.imageSmoothingEnabled = false;

  frame.forEach((color, index) => {
    if (!color) {
      return;
    }

    const x = index % state.width;

    const y = Math.floor(index / state.width);

    context.fillStyle = color;

    context.fillRect(x * scale, y * scale, scale, scale);
  });

  return canvas;
}

function exportCurrentFrame() {
  const canvas = createFrameCanvas(state.frames[state.activeFrameIndex], 16);

  downloadCanvas(
    canvas,
    `${slugify(state.projectName)}-frame-${state.activeFrameIndex + 1}.png`,
  );

  showToast("Frame exported");
}

function exportSpritesheet() {
  const scale = 16;

  const canvas = document.createElement("canvas");

  canvas.width = state.width * scale * state.frames.length;

  canvas.height = state.height * scale;

  const context = canvas.getContext("2d");

  context.imageSmoothingEnabled = false;

  state.frames.forEach((frame, frameIndex) => {
    frame.forEach((color, index) => {
      if (!color) {
        return;
      }

      const x = index % state.width;

      const y = Math.floor(index / state.width);

      context.fillStyle = color;

      context.fillRect(
        (frameIndex * state.width + x) * scale,

        y * scale,

        scale,
        scale,
      );
    });
  });

  downloadCanvas(canvas, `${slugify(state.projectName)}-spritesheet.png`);

  showToast("Spritesheet exported");
}

function downloadCanvas(canvas, filename) {
  const link = document.createElement("a");

  link.download = filename;

  link.href = canvas.toDataURL("image/png");

  link.click();
}

/* =========================================================
   PROJECT EXPORT
   ========================================================= */

function bindProjectControls() {
  $("#projectName").addEventListener("input", (event) => {
    state.projectName = event.target.value || "my-pixel-sprite";

    updateAnimationStyle();

    autosave();
  });

  $("#exportProjectBtn").addEventListener("click", exportProject);

  $("#importProjectBtn").addEventListener("click", () => {
    $("#projectFile").click();
  });

  $("#projectFile").addEventListener("change", importProject);
}

function exportProject() {
  const project = {
    version: 1,

    name: state.projectName,

    width: state.width,

    height: state.height,

    fps: state.fps,

    frames: state.frames,

    activeFrameIndex: state.activeFrameIndex,
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = `${slugify(state.projectName)}.json`;

  link.click();

  URL.revokeObjectURL(url);

  showToast("Project exported");
}

async function importProject(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();

    const project = JSON.parse(text);

    validateProject(project);

    pushHistory();

    state.projectName = project.name || "my-pixel-sprite";

    state.width = project.width;

    state.height = project.height;

    state.fps = project.fps || 8;

    state.frames = project.frames;

    state.activeFrameIndex = Math.min(
      project.activeFrameIndex || 0,
      state.frames.length - 1,
    );

    state.tool = "paint";

    state.symmetry = "off";

    $("#projectFile").value = "";

    showToast("Project imported");

    renderAll();

    autosave();
  } catch (error) {
    console.error(error);

    showToast("That JSON file is not a valid Sprite Sprout project");
  }
}

function validateProject(project) {
  if (
    !project ||
    !Number.isInteger(project.width) ||
    !Number.isInteger(project.height) ||
    !Array.isArray(project.frames) ||
    project.width < 1 ||
    project.height < 1 ||
    project.frames.length < 1
  ) {
    throw new Error("Invalid project");
  }

  const expected = project.width * project.height;

  project.frames.forEach((frame) => {
    if (!Array.isArray(frame) || frame.length !== expected) {
      throw new Error("Invalid frame");
    }
  });
}

/* =========================================================
   AUTOSAVE
   ========================================================= */

function autosave() {
  try {
    const project = {
      version: 1,

      name: state.projectName,

      width: state.width,

      height: state.height,

      fps: state.fps,

      frames: state.frames,

      activeFrameIndex: state.activeFrameIndex,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));

    updateSaveStatus();
  } catch (error) {
    console.warn("Autosave failed:", error);
  }
}

function restoreAutosave() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    const project = JSON.parse(saved);

    validateProject(project);

    state.projectName = project.name || "my-pixel-sprite";

    state.width = project.width;

    state.height = project.height;

    state.fps = project.fps || 8;

    state.frames = project.frames;

    state.activeFrameIndex = Math.min(
      project.activeFrameIndex || 0,
      state.frames.length - 1,
    );
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function updateSaveStatus() {
  const status = $("#saveStatus");

  status.innerHTML = `
    <span class="save-dot"></span>
    <span>Autosaved</span>
  `;
}

/* =========================================================
   UNDO / REDO
   ========================================================= */

function makeSnapshot() {
  return {
    width: state.width,

    height: state.height,

    fps: state.fps,

    frames: clone(state.frames),

    activeFrameIndex: state.activeFrameIndex,

    projectName: state.projectName,
  };
}

function restoreSnapshot(snapshot) {
  state.width = snapshot.width;

  state.height = snapshot.height;

  state.fps = snapshot.fps;

  state.frames = clone(snapshot.frames);

  state.activeFrameIndex = snapshot.activeFrameIndex;

  state.projectName = snapshot.projectName;

  renderAll();

  autosave();
}

function pushHistory() {
  state.history.push(makeSnapshot());

  if (state.history.length > 50) {
    state.history.shift();
  }

  state.redoStack = [];
}

function undo() {
  if (!state.history.length) {
    showToast("Nothing to undo");

    return;
  }

  state.redoStack.push(makeSnapshot());

  const snapshot = state.history.pop();

  restoreSnapshot(snapshot);

  showToast("Undone");
}

function redo() {
  if (!state.redoStack.length) {
    showToast("Nothing to redo");

    return;
  }

  state.history.push(makeSnapshot());

  const snapshot = state.redoStack.pop();

  restoreSnapshot(snapshot);

  showToast("Redone");
}

/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    const target = event.target;

    const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

    if (typing && !(event.ctrlKey || event.metaKey)) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();

      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }

      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();

      redo();

      return;
    }

    if (typing) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case "p":
        state.tool = "paint";

        syncToolbar();

        break;

      case "e":
        state.tool = "erase";

        syncToolbar();

        break;

      case "o":
        state.onionSkin = !state.onionSkin;

        syncToolbar();

        renderGrid();

        break;

      case " ":
        event.preventDefault();

        togglePlayback();

        break;
    }
  });
}

/* =========================================================
   RENDER ALL
   ========================================================= */

function renderAll() {
  renderGrid();

  renderTimeline();

  renderPreview();

  syncToolbar();

  syncSymmetry();

  syncScaleButtons();

  syncPlayButton();

  updateFPS();

  updateProjectUI();

  updateMeta();
}

function updateProjectUI() {
  $("#projectName").value = state.projectName;

  $$(".size-btn").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.size) === state.width,
    );
  });

  $("#currentColor").textContent = state.color;

  $("#colorPicker").value = state.color;
}

function updateMeta() {
  $("#frameInfo").textContent = `Frame ${state.activeFrameIndex + 1} / ${
    state.frames.length
  } · ${state.width} × ${state.height}`;

  $("#metaFrames").textContent = state.frames.length;

  $("#metaCanvas").textContent = `${state.width}×${state.height}`;
}

/* =========================================================
   CONFIRMATION MODAL
   ========================================================= */

let pendingConfirm = null;

function confirmAction(title, text, callback) {
  $("#modalTitle").textContent = title;

  $("#modalText").textContent = text;

  pendingConfirm = callback;

  $("#confirmModal").classList.add("open");
}

$("#modalCancel").addEventListener("click", closeModal);

$("#modalConfirm").addEventListener("click", () => {
  if (pendingConfirm) {
    pendingConfirm();
  }

  closeModal();
});

$("#confirmModal").addEventListener("click", (event) => {
  if (event.target === $("#confirmModal")) {
    closeModal();
  }
});

function closeModal() {
  $("#confirmModal").classList.remove("open");

  pendingConfirm = null;
}

/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(message) {
  const toast = $("#toast");

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}
