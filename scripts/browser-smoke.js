import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].find((candidate) => candidate && existsSync(candidate));
if (!chromePath) throw new Error("Chrome or Chromium was not found. Set CHROME_PATH to run browser tests.");
const port = 9300 + Math.floor(Math.random() * 500);
const profile = await mkdtemp(join(tmpdir(), "pixel-motion-browser-"));
const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});
const server = spawn(process.execPath, ["scripts/server.js"], { stdio: "ignore" });
const serverExit = new Promise((resolve) => {
  server.once("exit", resolve);
});

for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    if ((await fetch("http://127.0.0.1:8080/")).ok) break;
  } catch { /* Local server is still starting. */ }
  await wait(100);
}

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--disable-background-networking",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--window-size=1440,1000",
  "http://127.0.0.1:8080/"
], { stdio: "ignore" });
const chromeExit = new Promise((resolve) => {
  chrome.once("exit", resolve);
});

async function target() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = targets.find((item) => item.type === "page" && item.url.startsWith("http://127.0.0.1:8080/"));
      if (page) return page;
    } catch { /* Chrome is still starting. */ }
    await wait(100);
  }
  throw new Error("Chrome DevTools endpoint did not start");
}

const page = await target();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const runtimeErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    runtimeErrors.push(message.params.exceptionDetails?.text || "Unhandled browser exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    runtimeErrors.push(message.params.args.map((argument) => argument.value || argument.description || "").join(" "));
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitForEvaluation(expression, timeout = 2000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return true;
    await wait(50);
  }
  return false;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await send("Runtime.enable");
  await send("Page.enable");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if (await evaluate("document.readyState === 'complete' && Boolean(document.querySelector('#editorCanvas'))")) break;
    } catch { /* Navigation has not created the page context yet. */ }
    await wait(100);
  }

  const initialPage = await evaluate(`({
    canvasWidth: document.querySelector('#editorCanvas')?.width || 0,
    href: location.href,
    title: document.title,
    body: document.body?.innerText?.slice(0, 160) || '',
    styleSheets: [...document.styleSheets].map((sheet) => ({
      href: sheet.href,
      rules: (() => { try { return sheet.cssRules.length; } catch { return -1; } })(),
      imports: (() => {
        try {
          return [...sheet.cssRules]
            .filter((rule) => rule.type === CSSRule.IMPORT_RULE)
            .map((rule) => ({ href: rule.href, rules: rule.styleSheet?.cssRules?.length || 0 }));
        } catch {
          return [];
        }
      })()
    }))
  })`);
  assert(initialPage.canvasWidth === 32, `Editor did not initialize at ${initialPage.href}: ${initialPage.title} ${initialPage.body}`);
  const importedStyles = initialPage.styleSheets.flatMap((sheet) => sheet.imports);
  assert(importedStyles.length === 6, "CSS modules were not loaded");
  assert(importedStyles.every((sheet) => sheet.rules > 0), "A CSS module is empty or unavailable");
  assert(await evaluate("document.querySelector('.tool-panel').getBoundingClientRect().width >= 145"), "Tool panel was not widened");
  assert(await evaluate(`(() => {
    const height = document.querySelector('.tool').getBoundingClientRect().height;
    return height >= 45 && height <= 47;
  })()`), "Tool buttons do not have the requested size");
  assert(await evaluate("document.querySelector('.tool-icon').getBoundingClientRect().width >= 21"), "Tool icons are too small");
  assert(await evaluate("Boolean(document.querySelector('[data-tool=\"mirror\"]'))"), "Mirror brush is missing");
  assert(await evaluate("Boolean(document.querySelector('[data-tool=\"shade\"]'))"), "Shade tool is missing");
  await evaluate("document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }))");
  assert(await evaluate("document.querySelector('[data-tool=\"mirror\"]').classList.contains('active')"), "Mirror brush shortcut does not work");
  await evaluate("document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }))");
  assert(await evaluate("document.querySelector('[data-tool=\"shade\"]').classList.contains('active')"), "Shade tool shortcut does not work");
  await evaluate("document.querySelector('[data-tool=\"pencil\"]').click()");
  assert(await evaluate("Number.parseFloat(getComputedStyle(document.querySelector('#undoButton'), '::before').fontSize) >= 22"), "Undo icon is too small");
  assert(await evaluate("Number.parseFloat(getComputedStyle(document.querySelector('#clearFrame'), '::before').fontSize) >= 20"), "Clear frame icon is too small");
  assert(await evaluate("Number.parseFloat(getComputedStyle(document.querySelector('.frame-card-actions button')).fontSize) >= 15"), "Frame action icons are too small");
  assert(await evaluate("document.querySelector('.swatch').getBoundingClientRect().width >= 23"), "Color swatches are too small");
  assert(await evaluate("document.querySelector('#colorPickerPreview').getBoundingClientRect().width >= 49"), "Main color picker is too small");
  assert(await evaluate("document.querySelector('#gridOverlay').hidden"), "Grid is enabled by default");
  assert(await evaluate("!document.querySelector('#toggleGrid').classList.contains('active')"), "Grid button is active by default");
  assert(await evaluate("getComputedStyle(document.querySelector('#canvasWrap')).backgroundColor === 'rgb(166, 166, 166)'"), "Canvas workbench does not use the Piskel-like neutral background");
  assert(await evaluate("getComputedStyle(document.querySelector('#editorCanvas')).backgroundColor === 'rgb(71, 71, 71)'"), "Canvas transparency background is not dark enough");
  assert(await evaluate(`(() => {
    const shadow = getComputedStyle(document.querySelector('.canvas-shadow'));
    return shadow.borderTopWidth === '0px' && shadow.boxShadow === 'none';
  })()`), "Canvas still has a decorative border or shadow");
  assert(await evaluate(`(() => {
    const toolbar = getComputedStyle(document.querySelector('.canvas-toolbar'));
    const wrap = getComputedStyle(document.querySelector('#canvasWrap'));
    return Number(toolbar.zIndex) > Number(wrap.zIndex)
      && Number.parseFloat(wrap.borderTopWidth) >= 4;
  })()`), "Canvas workbench overlaps the toolbar");
  assert(await evaluate("getComputedStyle(document.querySelector('#brushCursor')).boxShadow !== 'none'"), "Brush cursor has no soft shadow");
  assert(await evaluate(`(() => {
    const shell = document.querySelector('.app-shell').getBoundingClientRect();
    return shell.left >= 7 && window.innerWidth - shell.right >= 7;
  })()`), "Desktop page side spacing is missing");
  assert(await evaluate(`(() => {
    const shell = document.querySelector('.app-shell').getBoundingClientRect();
    const mark = document.querySelector('.brand-mark').getBoundingClientRect();
    return mark.left >= shell.left + 8;
  })()`), "Brand mark crosses the left edge");
  assert(await evaluate(`(() => {
    const panel = document.querySelector('.tool-panel');
    const brush = panel.querySelector('.brush-control');
    const tools = panel.querySelector('#toolGrid');
    return Boolean(brush && tools && (brush.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING));
  })()`), "Brush size is not the first control above the tools");
  assert(await evaluate("!document.querySelector('.selection-hint')"), "Bottom selection help text is still present");

  for (const viewport of [{ width: 1024, height: 760 }, { width: 760, height: 720 }]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(100);
    const responsiveLayout = await evaluate(`(() => {
      const toolGrid = document.querySelector('#toolGrid');
      const toolPanel = document.querySelector('.tool-panel');
      const firstTool = document.querySelector('.tool');
      return {
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
        toolOverflow: toolGrid.scrollWidth > toolPanel.clientWidth,
        toolSize: firstTool.getBoundingClientRect().width
      };
    })()`);
    assert(!responsiveLayout.pageOverflow, `Page overflows at ${viewport.width}px`);
    assert(!responsiveLayout.toolOverflow, `Tool grid overflows at ${viewport.width}px`);
    assert(responsiveLayout.toolSize <= 41, `Tool buttons are too large at ${viewport.width}px`);
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  await wait(100);
  assert(await evaluate(`(() => [...document.querySelectorAll('button')].every((button) =>
    Boolean(button.textContent.trim() || button.getAttribute('aria-label') || button.getAttribute('title'))
  ))()`), "A button is missing an accessible name");
  assert(await evaluate(`(() => {
    const parse = (value) => value.match(/[\\d.]+/g).slice(0, 3).map(Number);
    const luminance = (rgb) => {
      const values = rgb.map((channel) => {
        const value = channel / 255;
        return value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
    };
    const element = document.querySelector('.layer-name');
    const style = getComputedStyle(element);
    const foreground = luminance(parse(style.color));
    const background = luminance(parse(getComputedStyle(element.closest('.layer-item')).backgroundColor));
    const ratio = (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    return ratio >= 4.5;
  })()`), "Layer text contrast is below WCAG AA");
  await evaluate("document.querySelector('#languageSelect').focus()");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab" });
  assert(await evaluate(`(() => {
    const active = document.activeElement;
    const style = getComputedStyle(active);
    return active !== document.body && style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
  })()`), "Keyboard focus is not visible");

  await evaluate(`(() => {
    const picker = document.querySelector('#colorPicker');
    picker.value = '#123456';
    picker.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  assert(await evaluate("document.querySelector('#colorPicker').value") === "#123456", "Native color picker did not update");
  assert(await evaluate("getComputedStyle(document.querySelector('#colorPickerPreview')).backgroundColor") === "rgb(18, 52, 86)", "Color preview did not follow the native picker");
  assert(await evaluate("!document.querySelector('#colorHex')"), "Old cramped color code is still present in the tool panel");
  await evaluate(`(() => {
    const select = document.querySelector('#languageSelect');
    select.value = 'pl';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert(await evaluate("document.querySelector('[data-size=\"3\"]').title") === "Pędzel 3 piksele", "Polish brush tooltip was not translated");
  assert(await evaluate("document.querySelector('.layer-name').textContent") === "Warstwa 1", "Existing default layer name was not translated to Polish");
  await evaluate("document.querySelector('#addLayer').click()");
  assert(await evaluate("[...document.querySelectorAll('.layer-name')].some((layer) => layer.textContent === 'Warstwa 2')"), "New layer did not use the active language");
  await evaluate(`(() => {
    const select = document.querySelector('#languageSelect');
    select.value = 'en';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert(await evaluate("[...document.querySelectorAll('.layer-name')].every((layer) => /^Layer \\d+$/.test(layer.textContent))"), "Default layer names did not follow the second language switch");

  await evaluate(`new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.id = 'embedSmoke';
    frame.style.width = '1000px';
    frame.style.height = '700px';
    frame.src = location.href;
    frame.onload = resolve;
    document.body.append(frame);
  })`);
  assert(await evaluate(`(() => {
    const frame = document.querySelector('#embedSmoke');
    const frameDocument = frame.contentDocument;
    const badge = frameDocument.querySelector('.creator-badge');
    const shell = frameDocument.querySelector('.app-shell').getBoundingClientRect();
    const mark = frameDocument.querySelector('.brand-mark').getBoundingClientRect();
    const brand = frameDocument.querySelector('.brand-zone').getBoundingClientRect();
    const actions = frameDocument.querySelector('.top-actions').getBoundingClientRect();
    return frameDocument.documentElement.classList.contains('embedded')
      && frameDocument.querySelector('#projectName').type === 'hidden'
      && getComputedStyle(badge).display !== 'none'
      && badge.textContent.includes('Andrei Pabiarzhyn')
      && badge.scrollWidth <= badge.clientWidth
      && mark.left >= shell.left + 8
      && brand.right <= actions.left
      && frameDocument.documentElement.scrollWidth <= frameDocument.documentElement.clientWidth;
  })()`), "Iframe header is clipped or overlapping");
  await evaluate("document.querySelector('#embedSmoke').remove()");

  await evaluate("document.querySelector('#openShortcuts').click()");
  assert(await evaluate("document.querySelector('#shortcutsDialog').open"), "Shortcut dialog did not open");
  await evaluate("document.querySelector('#closeShortcuts').click()");

  await evaluate("document.querySelector('#openBackups').click()");
  assert(await evaluate("document.querySelector('#backupsDialog').open"), "Backup dialog did not open");
  assert(await evaluate("document.querySelectorAll('#backupList .backup-item').length >= 1"), "Backup was not created");
  await evaluate("document.querySelector('#closeBackups').click()");

  await evaluate(`(() => {
    const frame = Array(32 * 32 * 4).fill(0);
    const projects = Array.from({ length: 3 }, (_, index) => ({
      id: 'browser-project-' + index,
      name: 'Browser project ' + (index + 1),
      width: 32,
      height: 32,
      fps: 8,
      updatedAt: Date.now() - index,
      layers: [{ name: 'Layer 1', visible: true, frames: [frame] }]
    }));
    localStorage.setItem('pixel-motion-projects-v3', JSON.stringify(projects));
    window.confirm = () => true;
    document.querySelector('#openProjects').click();
  })()`);
  assert(await evaluate("document.querySelectorAll('#recentProjects .project-card').length") === 3, "Projects dialog did not render seeded projects");
  await evaluate("document.querySelector('#selectAllProjects').click()");
  assert(await evaluate("document.querySelectorAll('.project-selector input:checked').length") === 3, "Select all did not select every visible project");
  await evaluate("document.querySelector('#selectAllProjects').click()");
  await evaluate(`(() => {
    const card = document.querySelector('.project-card');
    window.__deletedProjectId = card.dataset.projectId;
    const checkbox = card.querySelector('.project-selector input');
    checkbox.click();
    document.querySelector('#deleteSelectedProjects').click();
  })()`);
  assert(await waitForEvaluation(`!JSON.parse(localStorage.getItem('pixel-motion-projects-v3') || '[]')
    .some((project) => project.id === window.__deletedProjectId)`), "Selected project was not deleted");
  await evaluate("document.querySelector('#deleteAllProjects').click()");
  assert(await waitForEvaluation("document.querySelectorAll('#recentProjects .project-card').length === 0"), "Delete all did not remove every project");
  await evaluate("document.querySelector('#closeProjects').click()");

  assert(await evaluate("document.querySelectorAll('#frames .frame').length") === 1, "Editor did not start with one frame");
  await evaluate("document.querySelector('#addFrame').click()");
  assert(await waitForEvaluation("document.querySelectorAll('#frames .frame').length === 2"), "New frame button did not add a frame");
  await evaluate("document.querySelector('#frames .frame:first-child .frame-preview').click()");

  const rect = await evaluate(`(() => {
    const rect = document.querySelector('#editorCanvas').getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })()`);
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + 20, y: y + 20, button: "left", buttons: 1 });
  await wait(100);
  assert(await evaluate(`(() => {
    const thumb = document.querySelector('.frame.active .frame-preview canvas');
    const data = thumb.getContext('2d').getImageData(0, 0, thumb.width, thumb.height).data;
    return data.some((value, index) => index % 4 === 3 && value > 0);
  })()`), "Active frame thumbnail did not update while drawing");
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await wait(100);
  assert(await evaluate(`(() => {
    const thumb = document.querySelector('.frame.active .frame-preview canvas');
    const data = thumb.getContext('2d').getImageData(0, 0, thumb.width, thumb.height).data;
    return data.some((value, index) => index % 4 === 3 && value > 0);
  })()`), "Active frame thumbnail disappeared after drawing ended");
  assert(await evaluate(`(() => {
    const canvas = document.querySelector('#editorCanvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((value, index) => index % 4 === 3 && value > 0);
  })()`), "Drawing did not change the canvas");
  await evaluate(`(() => {
    const picker = document.querySelector('#colorPicker');
    picker.value = '#ffffff';
    picker.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-tool="picker"]').click();
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  assert(await evaluate("document.querySelector('#colorPicker').value") === "#123456", "Eyedropper did not sample the drawn pixel");
  await evaluate("document.querySelector('[data-tool=\"pencil\"]').click()");
  await evaluate("document.querySelector('.frame.active .frame-duplicate').click()");
  assert(await waitForEvaluation("document.querySelectorAll('#frames .frame').length === 3"), "Duplicate frame button did not add a copied frame");
  assert(await evaluate(`(() => {
    const canvas = document.querySelector('#editorCanvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((value, index) => index % 4 === 3 && value > 0);
  })()`), "Duplicated frame did not preserve its pixels");
  await evaluate("document.querySelector('#clearFrame').click()");
  assert(await evaluate(`(() => {
    const canvas = document.querySelector('#editorCanvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return !data.some((value, index) => index % 4 === 3 && value > 0);
  })()`), "Clear frame button did not remove frame pixels");

  await evaluate(`(() => {
    window.__capturedDownloads = [];
    window.__originalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function captureDownload() {
      const entry = { name: this.download, bytes: null };
      window.__capturedDownloads.push(entry);
      fetch(this.href)
        .then((response) => response.arrayBuffer())
        .then((buffer) => { entry.bytes = [...new Uint8Array(buffer)]; });
    };
  })()`);
  await evaluate("document.querySelector('#exportMenuButton').click(); document.querySelector('#exportGif').click()");
  assert(await waitForEvaluation("window.__capturedDownloads[0]?.bytes?.length > 10"), "GIF export did not produce a download");
  assert(await evaluate(`(() => {
    const download = window.__capturedDownloads[0];
    const header = String.fromCharCode(...download.bytes.slice(0, 6));
    return download.name.endsWith('.gif') && header === 'GIF89a' && download.bytes.at(-1) === 0x3b;
  })()`), "GIF export is not a valid GIF89a file");
  await evaluate("document.querySelector('#exportMenuButton').click(); document.querySelector('#exportPng').click()");
  assert(await waitForEvaluation("window.__capturedDownloads[1]?.bytes?.length > 8"), "PNG export did not produce a download");
  assert(await evaluate(`(() => {
    const download = window.__capturedDownloads[1];
    return download.name.endsWith('.png')
      && download.bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  })()`), "PNG export has an invalid signature");
  await evaluate("HTMLAnchorElement.prototype.click = window.__originalAnchorClick");

  const projectBeforeBrokenImport = await evaluate("document.querySelector('#editorCanvas').width + 'x' + document.querySelector('#editorCanvas').height");
  await evaluate(`(() => {
    const input = document.querySelector('#fileInput');
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([1, 2, 3, 4])], 'broken.pxm', { type: 'application/octet-stream' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert(await waitForEvaluation("document.querySelector('#toast').classList.contains('show')"), "Corrupted project import did not show an error");
  assert(await evaluate("document.querySelector('#toast').textContent.trim().length > 0"), "Corrupted project error is empty");
  assert(await evaluate("document.querySelector('#editorCanvas').width + 'x' + document.querySelector('#editorCanvas').height") === projectBeforeBrokenImport,
    "Corrupted project import changed the current project");

  const zoomBefore = await evaluate("document.querySelector('#zoomValue').value");
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: -120 });
  await wait(100);
  const zoomAfter = await evaluate("document.querySelector('#zoomValue').value");
  assert(zoomBefore !== zoomAfter, "Wheel zoom did not change");

  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  const largeCursor = await evaluate("document.querySelector('[data-cursor-tool=\"pencil\"]').getBoundingClientRect().width");
  for (let index = 0; index < 12; index += 1) {
    await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: 120 });
  }
  await wait(100);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  const smallCursor = await evaluate("document.querySelector('[data-cursor-tool=\"pencil\"]').getBoundingClientRect().width");
  assert(smallCursor < largeCursor, "Tool cursor did not shrink with canvas zoom");

  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const pinchBefore = await evaluate("document.querySelector('#zoomValue').value");
  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x - 30, y }, { x: x + 30, y }]
  });
  await send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x - 55, y }, { x: x + 55, y }]
  });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(100);
  const pinchAfter = await evaluate("document.querySelector('#zoomValue').value");
  assert(pinchBefore !== pinchAfter, "Pinch zoom did not change");

  await evaluate("document.querySelector('#openChallenges').click()");
  assert(await evaluate("Boolean(document.querySelector('#dailyChallenge canvas'))"), "Daily challenge was not rendered");
  assert(await evaluate("document.querySelector('#dailyChallenge button').textContent.trim().length > 0"), "Daily challenge has no start action");
  assert(await evaluate("document.querySelectorAll('#challengeList .challenge-card').length") === 6, "Six-step challenge course was not rendered");
  assert(await evaluate("[...document.querySelectorAll('#challengeList .challenge-rules')].every((rules) => rules.children.length <= 2)"), "Challenge cards still contain too many rules");
  assert(await evaluate("[...document.querySelectorAll('#challengeList .challenge-preview')].every((preview) => preview.querySelectorAll('canvas').length === 1)"), "Challenge preview still renders a strip of thumbnails");
  const animatedChallengeBefore = await evaluate(`(() => {
    const canvas = document.querySelector('#challengeList .challenge-preview.animated canvas');
    return [...canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data];
  })()`);
  await wait(600);
  const animatedChallengeAfter = await evaluate(`(() => {
    const canvas = document.querySelector('#challengeList .challenge-preview.animated canvas');
    return [...canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data];
  })()`);
  assert(animatedChallengeBefore.some((value, index) => value !== animatedChallengeAfter[index]), "Animated challenge preview does not play its frames");
  assert(await evaluate("document.querySelector('#challengeCourseProgress').value") === "0 / 6", "Challenge course progress is incorrect");
  assert(await evaluate("document.querySelectorAll('#challengeList .challenge-card.recommended').length") === 1, "Recommended challenge is not highlighted");
  await evaluate("document.querySelector('#closeChallenges').click()");

  await evaluate(`(() => {
    document.querySelector('#newProject').click();
    document.querySelector('#projectWidth').value = 128;
    document.querySelector('#projectHeight').value = 128;
    document.querySelector('#createProject').click();
  })()`);
  assert(await evaluate("document.querySelector('#editorCanvas').width === 128 && document.querySelector('#editorCanvas').height === 128"), "Maximum-size project did not initialize");
  assert(await evaluate("Boolean(document.querySelector('#deleteSelection'))"), "Selection actions are incomplete");
  assert(await evaluate("document.querySelector('#selectionActions').hidden"), "Selection actions are visible before an area is selected");

  await evaluate(`(() => {
    document.querySelector('#newProject').click();
    document.querySelector('#projectWidth').value = 16;
    document.querySelector('#projectHeight').value = 16;
    document.querySelector('#createProject').click();
    document.querySelector('[data-tool="select"]').click();
  })()`);
  const selectionCanvas = await evaluate(`(() => {
    const canvas = document.querySelector('#editorCanvas');
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, zoom: rect.width / 16 };
  })()`);
  const selectStartX = selectionCanvas.left + selectionCanvas.zoom * 2.3;
  const selectStartY = selectionCanvas.top + selectionCanvas.zoom * 2.3;
  const selectEndX = selectionCanvas.left + selectionCanvas.zoom * 5.3;
  const selectEndY = selectionCanvas.top + selectionCanvas.zoom * 5.3;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: selectStartX, y: selectStartY, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: selectEndX, y: selectEndY, button: "left", buttons: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: selectEndX, y: selectEndY, button: "left", clickCount: 1 });
  assert((await evaluate("document.querySelector('#selectionSize').value")).startsWith("4 × 4"), "Selection size was not reported");
  assert(await evaluate("!document.querySelector('#selectionActions').hidden"), "Selection actions did not appear contextually");
  assert(await evaluate("document.querySelectorAll('#selectionActions .mini-actions button').length") === 5, "Selection actions are still overloaded");
  const resizeStartX = selectionCanvas.left + selectionCanvas.zoom * 6;
  const resizeStartY = selectionCanvas.top + selectionCanvas.zoom * 6;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: resizeStartX, y: resizeStartY, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: resizeStartX + selectionCanvas.zoom * 3, y: resizeStartY + selectionCanvas.zoom * 2, button: "left", buttons: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: resizeStartX + selectionCanvas.zoom * 3, y: resizeStartY + selectionCanvas.zoom * 2, button: "left", clickCount: 1 });
  assert((await evaluate("document.querySelector('#selectionSize').value")).startsWith("7 × 6"), "Canvas selection handles did not resize the selection");
  const rotateCenterX = selectionCanvas.left + selectionCanvas.zoom * 5.5;
  const rotateCenterY = selectionCanvas.top + selectionCanvas.zoom * 5;
  const rotateHandleY = selectionCanvas.top + selectionCanvas.zoom * 2 - 20;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: rotateCenterX, y: rotateHandleY, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rotateCenterX + selectionCanvas.zoom * 4, y: rotateCenterY, button: "left", buttons: 1, modifiers: 8 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rotateCenterX + selectionCanvas.zoom * 4, y: rotateCenterY, button: "left", clickCount: 1 });
  assert((await evaluate("document.querySelector('#selectionSize').value")).startsWith("6 × 7"), "Rotation handle did not rotate the selection");

  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const frame = Array(16 * 16 * 4).fill(0);
      frame[0] = 247; frame[1] = 209; frame[2] = 84; frame[3] = 255;
      localStorage.setItem('pixel-motion-recovery-v3', JSON.stringify({
        id: 'automatic-recovery-test',
        name: 'Recovered automatically',
        width: 16,
        height: 16,
        fps: 6,
        updatedAt: Date.now(),
        layers: [{ name: 'Layer 1', visible: true, frames: [frame] }]
      }));
    })();`
  });
  await send("Page.reload");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if (await evaluate("document.readyState === 'complete' && document.querySelector('#projectName')?.value === 'Recovered automatically'")) break;
    } catch { /* Reload is still replacing the execution context. */ }
    await wait(100);
  }
  assert(await evaluate("document.querySelector('#projectName').value") === "Recovered automatically", "Last project was not restored automatically");
  assert(await evaluate("document.querySelector('#editorCanvas').width") === 16, "Recovered canvas dimensions were not applied");
  assert(await evaluate("!document.querySelector('#recoveryDialog')"), "Recovery dialog still exists");
  assert(runtimeErrors.length === 0, `Browser console errors: ${runtimeErrors.join(" | ")}`);

  console.log("Browser smoke passed: frame actions, drawing, large canvas, selection transforms, daily challenge and recovery");
} finally {
  socket.close();
  chrome.kill();
  server.kill();
  await Promise.race([chromeExit, wait(2000)]);
  await Promise.race([serverExit, wait(1000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }).catch(() => {});
}
