// 화면 캡처(폰 크기 375px): node scripts/shot.mjs <주소> <저장파일> [높이] [기다릴ms, 기본 4000]
// 로그인 화면을 찍을 땐 SHOT_COOKIE="이름=값" 을 함께 준다(시험용 DB 회원만).
// 이 기기 보관값(localStorage)이 필요한 화면은 SHOT_STORAGE='{"키":"값"}' 도 함께 준다.
// 헤드리스 크롬은 창을 좁게 못 만들어서, 크롬에 폰 화면 흉내 명령을 직접 보내 찍는다. 기존 크롬 프로필은 건드리지 않는다
import { spawn } from "node:child_process";
const [url, out, h = "812", waitMs = "4000"] = process.argv.slice(2);
const C = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const dir = (await import("node:fs")).mkdtempSync((await import("node:path")).join((await import("node:os")).tmpdir(), "owl-shot-"));
const chrome = spawn(C, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9333", `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 120 && !target; i++) { await wait(250); try { target = (await (await fetch("http://127.0.0.1:9333/json")).json()).find((t) => t.type === "page"); } catch {} }
if (!target) { chrome.kill(); throw new Error("크롬이 30초 안에 켜지지 않았어요"); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: Number(h), deviceScaleFactor: 2, mobile: true });
await send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
const cookie = process.env.SHOT_COOKIE;
if (cookie) {
  const i = cookie.indexOf("=");
  await send("Network.setCookie", { name: cookie.slice(0, i), value: cookie.slice(i + 1), url });
}
const storage = process.env.SHOT_STORAGE;
if (storage) {
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{const s=${storage};for(const k in s)localStorage.setItem(k,s[k])}catch{}` });
}
await send("Page.navigate", { url });
await wait(Number(waitMs));
const { data } = await send("Page.captureScreenshot", { format: "png" });
(await import("node:fs")).writeFileSync(out, Buffer.from(data, "base64"));
ws.close(); chrome.kill();
console.log("saved", out);
