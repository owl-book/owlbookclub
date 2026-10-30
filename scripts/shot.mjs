// 화면 캡처(폰 크기 375px): node scripts/shot.mjs <주소> <저장파일> [높이]
// 헤드리스 크롬은 창을 좁게 못 만들어서, 크롬에 폰 화면 흉내 명령을 직접 보내 찍는다. 기존 크롬 프로필은 건드리지 않는다
import { spawn } from "node:child_process";
const [url, out, h = "812"] = process.argv.slice(2);
const C = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const dir = (await import("node:fs")).mkdtempSync((await import("node:path")).join((await import("node:os")).tmpdir(), "owl-shot-"));
const chrome = spawn(C, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9333", `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) { await wait(250); try { target = (await (await fetch("http://127.0.0.1:9333/json")).json()).find((t) => t.type === "page"); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: Number(h), deviceScaleFactor: 2, mobile: true });
await send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
await send("Page.navigate", { url });
await wait(4000);
const { data } = await send("Page.captureScreenshot", { format: "png" });
(await import("node:fs")).writeFileSync(out, Buffer.from(data, "base64"));
ws.close(); chrome.kill();
console.log("saved", out);
