import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9333;
const profile = await mkdtemp(join(tmpdir(), "pixel-motion-browser-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--disable-background-networking",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--window-size=1440,1000",
  "http://127.0.0.1:8080/"
], { stdio: "ignore" });
const chromeExit = new Promise((resolve) => chrome.once("exit", resolve));

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function target() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = targets.find((item) => item.type === "page");
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
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await send("Runtime.enable");
  await send("Page.enable");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await evaluate("document.readyState === 'complete' && Boolean(document.querySelector('#editorCanvas'))")) break;
    await wait(100);
  }

  assert(await evaluate("document.querySelector('#editorCanvas').width === 32"), "Editor did not initialize");

  await evaluate("document.querySelector('#openShortcuts').click()");
  assert(await evaluate("document.querySelector('#shortcutsDialog').open"), "Shortcut dialog did not open");
  await evaluate("document.querySelector('#closeShortcuts').click()");

  await evaluate("document.querySelector('#openBackups').click()");
  assert(await evaluate("document.querySelector('#backupsDialog').open"), "Backup dialog did not open");
  assert(await evaluate("document.querySelectorAll('#backupList .backup-item').length >= 1"), "Backup was not created");
  await evaluate("document.querySelector('#closeBackups').click()");

  const rect = await evaluate(`(() => {
    const rect = document.querySelector('#editorCanvas').getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })()`);
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  assert(await evaluate(`(() => {
    const canvas = document.querySelector('#editorCanvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((value, index) => index % 4 === 3 && value > 0);
  })()`), "Drawing did not change the canvas");

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

  console.log("Browser smoke passed: adaptive cursor, drawing, wheel and pinch zoom");
} finally {
  socket.close();
  chrome.kill();
  await Promise.race([chromeExit, wait(2000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }).catch(() => {});
}
