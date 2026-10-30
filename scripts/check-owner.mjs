// 남의 데이터 보호 점검: 회원 B가 회원 A의 찜·기록·신청 표시·알림·별명을 바꾸려 하면 실패하는지 확인한다.
// 사용: npm run check:owner   (시험용 DB 전용. .env.local 이 실제 DB(.env.real)와 같으면 바로 멈춘다)
//
// 하는 일
// 1) 코드 검사: 회원 저장 동작은 맨 앞에서 본인 확인(requireUser), 관리자 동작은 관리자 확인(requireAdmin)을 하는지
// 2) 점검용 서버를 따로 켜고(포트 3019), 시험 회원 A·B를 만든 뒤 A의 데이터를 넣어 둔다
// 3) B가 화면 버튼 없이 저장 동작을 직접 불러(공격자가 하는 방식) A의 데이터를 바꾸려 한다 → A의 데이터가 그대로인지 DB에서 확인
//    서명이 위조된 쿠키·로그인 없는 요청도 같은 방식으로 확인한다
// 4) A가 자기 데이터를 바꾸는 것은 되는지 확인한다(점검 도구가 제대로 동작하는지의 기준)
// 5) 시험 회원 A·B를 지운다(찜·기록 등은 함께 지워진다)

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = 3019;
const BASE = `http://localhost:${PORT}`;
const DIST = ".next/check-owner";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

// ── 환경 확인 ──────────────────────────────
function readEnv(file) {
  const out = {};
  for (const line of readFileSync(ROOT + file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = readEnv(".env.local");
let realUrl = "";
try {
  realUrl = readEnv(".env.real").SUPABASE_URL ?? "";
} catch {}
const origin = (u) => {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
};
const DB = origin(env.SUPABASE_URL);
if (!DB || !env.SUPABASE_SERVICE_ROLE_KEY || !env.AUTH_SECRET) stop(".env.local 에 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY·AUTH_SECRET 가 있어야 해요.");
if (!realUrl) stop(".env.real 이 없어 시험용 DB인지 확인할 수 없어요. 멈춥니다.");
if (DB === origin(realUrl)) stop(".env.local 이 실제 DB를 가리키고 있어요. 시험용 DB에서만 점검합니다. 멈춥니다.");

process.env.AUTH_SECRET = env.AUTH_SECRET;
const { signValue } = await import("../src/lib/auth-shared.ts");

function stop(msg) {
  console.error(`\n⛔ ${msg}\n`);
  process.exit(2);
}

// ── 결과 기록 ──────────────────────────────
const results = [];
function check(group, name, ok, detail = "") {
  results.push({ group, name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} [${group}] ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// ── 1) 코드 검사 ──────────────────────────────
function firstStatements(file, allow = []) {
  const src = readFileSync(ROOT + file, "utf8");
  const out = [];
  const re = /export async function (\w+)\s*\([^)]*\)[^{]*\{/g;
  let m;
  while ((m = re.exec(src))) {
    if (allow.includes(m[1])) continue;
    // 함수 본문의 첫 줄들(주석·빈 줄 제외) 3줄
    const body = src.slice(m.index + m[0].length).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//")).slice(0, 3).join(" ");
    out.push({ name: m[1], body });
  }
  return out;
}
for (const file of ["src/lib/me-actions.ts", "src/lib/push-actions.ts"]) {
  for (const f of firstStatements(file)) {
    check("코드", `${f.name}: 맨 앞에서 본인 확인`, /requireUser(ForRecord)?\(/.test(f.body), f.body.slice(0, 120));
  }
}
for (const file of ["src/lib/admin-actions.ts", "src/lib/review-actions.ts", "src/lib/exhibition-actions.ts", "src/lib/cover-actions.ts"]) {
  for (const f of firstStatements(file, ["loginAdmin", "logoutAdmin"])) {
    check("코드", `${f.name}: 맨 앞에서 관리자 확인`, /await requireAdmin\(\)/.test(f.body.split(";")[0] + ";"), f.body.slice(0, 120));
  }
}

// ── DB 도우미(시험용 DB를 관리자 열쇠로 직접 읽고 쓴다) ──────────────────────────────
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" };
async function rest(path, init = {}) {
  const res = await fetch(`${DB}/rest/v1/${path}`, { ...init, headers: { ...H, Prefer: "return=representation", ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const insert = (table, row) => rest(table, { method: "POST", body: JSON.stringify(row) });
const select = (table, query) => rest(`${table}?${query}`);

// ── 2) 점검용 서버 켜기 ──────────────────────────────
console.log(`\n점검용 서버를 켜는 중(포트 ${PORT}, 1분쯤 걸려요)…`);
const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  cwd: ROOT,
  env: { ...process.env, NEXT_DIST_DIR: DIST, NODE_ENV: "development" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
const users = [];
async function cleanup() {
  for (const id of users) await rest(`users?id=eq.${id}`, { method: "DELETE" }).catch(() => {});
  try {
    process.kill(-server.pid);
  } catch {}
}
process.on("SIGINT", async () => {
  await cleanup();
  process.exit(130);
});

try {
  for (let i = 0; i < 120 && !/Ready|ready/.test(serverLog); i++) await wait(500);
  if (!/Ready|ready/.test(serverLog)) throw new Error(`서버가 켜지지 않았어요:\n${serverLog.slice(-800)}`);

  // 시험에 쓸 모임·책방: 지난 모임 1개(기록용), 다가오는 모임 1개(찜·신청 표시용)
  const now = new Date().toISOString();
  const [past] = await select("meetings", `select=id,store_id&starts_at=lt.${now}&order=starts_at.desc&limit=1`);
  const [upcoming] = await select("meetings", `select=id,store_id&starts_at=gt.${now}&order=starts_at.asc&limit=1`);
  if (!past || !upcoming) throw new Error("시험용 DB에 지난 모임과 다가오는 모임이 각각 1개 이상 있어야 해요.");

  // 저장 동작들이 서버에 준비되도록 화면을 한 번씩 열어 둔다(개발 서버는 처음 열 때 만든다)
  for (const path of ["/", `/me/records/${past.id}`, "/me/account", "/me/settings"]) {
    await fetch(BASE + path, { headers: { "user-agent": UA } }).catch(() => {});
  }
  const manifest = JSON.parse(readFileSync(`${ROOT}${DIST}/dev/server/server-reference-manifest.json`, "utf8"));
  const actionId = {};
  for (const [id, v] of Object.entries(manifest.node)) if (v.exportedName) actionId[v.exportedName] = id;
  const need = ["setWish", "setApplied", "setAttended", "saveRecord", "deleteRecord", "updateDisplayName", "signOutOtherDevices", "withdraw", "removePushSubscription", "setPushPref"];
  const missing = need.filter((n) => !actionId[n]);
  if (missing.length) throw new Error(`저장 동작을 찾지 못했어요: ${missing.join(", ")}`);

  // ── 시험 회원 A·B와 A의 데이터 ──────────────────────────────
  const tag = Date.now();
  const [A] = await insert("users", { provider: "kakao", provider_user_id: `owl-check-A-${tag}`, nickname: "점검회원A" });
  const [B] = await insert("users", { provider: "kakao", provider_user_id: `owl-check-B-${tag}`, nickname: "점검회원B" });
  users.push(A.id, B.id);
  await rest(`users?id=eq.${A.id}`, { method: "PATCH", body: JSON.stringify({ display_name: "A의별명" }) });
  await insert("meeting_wishes", { user_id: A.id, meeting_id: upcoming.id });
  await insert("store_wishes", { user_id: A.id, store_id: upcoming.store_id });
  await insert("meeting_plans", { user_id: A.id, meeting_id: upcoming.id, applied_at: now });
  await insert("meeting_plans", { user_id: A.id, meeting_id: past.id, attended: "yes" });
  await insert("meeting_records", { user_id: A.id, meeting_id: past.id, memo: "A의 기록" });
  const endpointA = `https://fcm.googleapis.com/fcm/send/owl-check-${tag}`;
  await insert("push_subscriptions", { user_id: A.id, endpoint: endpointA, p256dh: "x", auth: "x" });
  await insert("push_prefs", { user_id: A.id, meeting: true });

  const cookieOf = async (id, v = 1) => `owl_user=${await signValue({ id, name: "점검", provider: "kakao", v }, 3600)}`;
  const cookieA = await cookieOf(A.id);
  const cookieB = await cookieOf(B.id);
  // A의 회원번호를 적었지만 서명은 엉터리인 쿠키(위조)
  const forged = `owl_user=${(await cookieOf(A.id)).split("=")[1].split(".")[0]}.forgedsignature`;

  // 저장 동작 직접 부르기: 값 여러 개를 받는 동작(찜 등)
  const callArgs = (name, args, cookie) =>
    fetch(`${BASE}/`, {
      method: "POST",
      redirect: "manual",
      headers: { "user-agent": UA, "Next-Action": actionId[name], Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8", Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(args),
    }).catch(() => null);
  // 입력 양식으로 받는 동작(기록·별명 등): 화면 없이 양식만 보낸다.
  // 주소는 저장 동작이 모두 준비된 기록 화면 하나로 통일한다(동작은 주소와 상관없이 같은 코드가 실행된다)
  const callForm = (name, fields, cookie) => {
    const page = `/me/records/${past.id}`;
    const fd = new FormData();
    fd.set(`$ACTION_ID_${actionId[name]}`, "");
    for (const [k, v] of Object.entries(fields)) fd.set(k, String(v));
    return fetch(BASE + page, { method: "POST", redirect: "manual", headers: { "user-agent": UA, Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) }, body: fd }).catch(() => null);
  };

  const aState = async () => ({
    meetingWish: (await select("meeting_wishes", `select=meeting_id&user_id=eq.${A.id}&meeting_id=eq.${upcoming.id}`)).length,
    storeWish: (await select("store_wishes", `select=store_id&user_id=eq.${A.id}&store_id=eq.${upcoming.store_id}`)).length,
    applied: (await select("meeting_plans", `select=applied_at&user_id=eq.${A.id}&meeting_id=eq.${upcoming.id}`))[0]?.applied_at ?? null,
    attended: (await select("meeting_plans", `select=attended&user_id=eq.${A.id}&meeting_id=eq.${past.id}`))[0]?.attended ?? null,
    memo: (await select("meeting_records", `select=memo&user_id=eq.${A.id}&meeting_id=eq.${past.id}`))[0]?.memo ?? null,
    push: (await select("push_subscriptions", `select=id&endpoint=eq.${encodeURIComponent(endpointA)}&user_id=eq.${A.id}`)).length,
    pushPref: (await select("push_prefs", `select=meeting&user_id=eq.${A.id}`))[0]?.meeting ?? null,
    user: (await select("users", `select=display_name,session_version&id=eq.${A.id}`))[0] ?? null,
  });
  let before = await aState();
  // 바로 앞 확인 때와 비교한다(한 번 바뀐 뒤 나머지 항목까지 줄줄이 실패로 나오지 않도록, 매번 기준을 새로 잡는다)
  const same = async (label) => {
    const after = await aState();
    const diff = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    before = after;
    return [diff.length === 0, diff.length ? `${label}: A의 ${diff.join(", ")} 이(가) 바뀜` : ""];
  };

  // ── 3) B의 공격: 모두 A의 데이터를 노린다 ──────────────────────────────
  const attacks = [
    ["찜한 모임 지우기", () => callArgs("setWish", ["meeting", upcoming.id, false], cookieB)],
    ["찜한 책방 지우기", () => callArgs("setWish", ["store", upcoming.store_id, false], cookieB)],
    ["신청 표시 지우기", () => callArgs("setApplied", [upcoming.id, false], cookieB)],
    ["다녀옴 표시 되돌리기", () => callForm("setAttended", { meetingId: past.id, attended: "clear" }, cookieB)],
    ["기록 덮어쓰기", () => callForm("saveRecord", { meetingId: past.id, memo: "B가 덮어씀" }, cookieB)],
    ["기록 지우기", () => callForm("deleteRecord", { meetingId: past.id }, cookieB)],
    ["알림 기기 지우기", () => callArgs("removePushSubscription", [endpointA], cookieB)],
    ["알림 끄기", () => callArgs("setPushPref", ["meeting", false], cookieB)],
    ["별명 바꾸기", () => callForm("updateDisplayName", { displayName: "B가 바꿈" }, cookieB)],
    ["다른 기기 모두 로그아웃", () => callForm("signOutOtherDevices", {}, cookieB)],
  ];
  let bMemo = null;
  for (const [name, run] of attacks) {
    await run();
    const [ok, detail] = await same(name);
    check("회원 B", `A의 ${name} 시도 → A 데이터 그대로`, ok, detail);
    // 바로 다음 '기록 지우기'가 B 자신의 기록을 지우므로, 저장 직후에 확인해 둔다
    if (name === "기록 덮어쓰기") bMemo = (await select("meeting_records", `select=memo&user_id=eq.${B.id}&meeting_id=eq.${past.id}`))[0]?.memo ?? null;
  }

  // 위 요청들이 실제로 서버에서 실행됐는지: B 자신의 데이터는 바뀌어야 한다.
  // (요청이 아예 안 들어가도 A 데이터는 그대로라 '통과'로 보일 수 있어서, 이걸로 진짜 시도였는지 확인한다)
  const bUser = (await select("users", `select=display_name,session_version&id=eq.${B.id}`))[0];
  const bPref = (await select("push_prefs", `select=meeting&user_id=eq.${B.id}`))[0]?.meeting;
  check("요청 확인", "B의 기록 저장 요청이 실제로 실행됨(B 자신의 기록이 생김)", bMemo === "B가 덮어씀", `B 기록: ${bMemo ?? "없음"}`);
  check("요청 확인", "B의 별명 바꾸기 요청이 실제로 실행됨", bUser?.display_name === "B가 바꿈", `B 별명: ${bUser?.display_name ?? "없음"}`);
  check("요청 확인", "B의 알림 끄기 요청이 실제로 실행됨", bPref === false, `B 알림: ${bPref ?? "없음"}`);
  check("요청 확인", "B의 다른 기기 로그아웃 요청이 실제로 실행됨(B의 버전만 2)", bUser?.session_version === 2, `B 버전: ${bUser?.session_version ?? "없음"}`);
  // 버전이 올라갔으니 B의 예전 쿠키는 이제 통하지 않아야 한다
  const staleB = cookieB;
  const cookieB2 = await cookieOf(B.id, 2);

  // 위조 쿠키·로그인 없는 요청
  for (const [who, cookie] of [["위조 쿠키(A 회원번호)", forged], ["로그인 없음", null], ["로그아웃된 B의 예전 쿠키", staleB]]) {
    await callForm("deleteRecord", { meetingId: past.id }, cookie);
    await callArgs("setWish", ["meeting", upcoming.id, false], cookie);
    const [ok, detail] = await same(who);
    check(who, "A의 기록 지우기·찜 지우기 시도 → A 데이터 그대로", ok, detail);
  }

  // B의 탈퇴는 B만 지워야 한다(마지막에)
  await callForm("withdraw", { confirm: "yes" }, cookieB2);
  {
    const [ok, detail] = await same("탈퇴");
    const bGone = (await select("users", `select=id&id=eq.${B.id}`)).length === 0;
    check("회원 B", "B가 탈퇴 → A는 그대로, B만 지워짐", ok && bGone, detail || (!bGone ? "B가 지워지지 않음" : ""));
  }

  // ── 4) 기준: A는 자기 데이터를 바꿀 수 있어야 한다(이게 실패하면 점검 도구가 제대로 동작하지 않는 것) ──────────
  await callArgs("setWish", ["meeting", upcoming.id, false], cookieA);
  await callForm("deleteRecord", { meetingId: past.id }, cookieA);
  const afterA = await aState();
  check("기준", "A 본인은 자기 찜을 지울 수 있음", afterA.meetingWish === 0, "점검 도구가 저장 동작을 제대로 부르지 못했어요");
  check("기준", "A 본인은 자기 기록을 지울 수 있음", afterA.memo === null, "점검 도구가 저장 동작을 제대로 부르지 못했어요");
} catch (e) {
  check("점검 도구", "점검을 끝까지 진행", false, e.message);
} finally {
  await cleanup();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? `❌ ${failed.length}건 문제` : "✅ 모두 통과"} (전체 ${results.length}건)`);
process.exit(failed.length ? 1 : 0);
