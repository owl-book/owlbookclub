// 드롭박스 목록(지역·장르·모임방식)이 앱 파일과 DB 표에서 똑같은지 비교한다. DB는 읽기만 한다.
//   앱 파일: src/lib/regions.ts, src/lib/tags.ts
//   DB 표:   regions, genres, formats
// 쓰는 법(web 폴더에서):
//   npm run check:lists            → 시험용 DB(.env.local)와 비교
//   npm run check:lists -- --real  → 실제 DB(.env.real)와 비교
// 이름이 한쪽에만 있으면 '어긋남'으로 알리고 실패(종료 코드 1)한다. 순서만 다르면 참고로 알린다.
import { readFileSync } from "node:fs";
import { REGIONS } from "../src/lib/regions.ts";
import { FORMATS, GENRES } from "../src/lib/tags.ts";

const real = process.argv.includes("--real");
const envFile = real ? ".env.real" : ".env.local";
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const url = new URL(env.SUPABASE_URL).origin;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key };
if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // 예전 방식 열쇠

async function read(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=name,sort_order&order=sort_order`, { headers });
  if (!res.ok) throw new Error(`${table} 표를 읽지 못했어요: ${res.status} ${await res.text()}`);
  return (await res.json()).map((r) => r.name);
}

const appLists = {
  지역: Object.entries(REGIONS).flatMap(([sido, gus]) => gus.map((gu) => `${sido} ${gu}`)),
  장르: [...GENRES],
  모임방식: [...FORMATS],
};
const dbLists = { 지역: await read("regions"), 장르: await read("genres"), 모임방식: await read("formats") };

console.log(`비교 대상: ${real ? "실제 DB (.env.real)" : "시험용 DB (.env.local)"}\n`);
let broken = false;
for (const name of Object.keys(appLists)) {
  const app = appLists[name];
  const db = dbLists[name];
  const appOnly = app.filter((v) => !db.includes(v));
  const dbOnly = db.filter((v) => !app.includes(v));
  if (appOnly.length || dbOnly.length) {
    broken = true;
    console.log(`✗ ${name}: 어긋남`);
    if (appOnly.length) console.log(`   앱 파일에만 있음(DB에 넣어야 저장돼요): ${appOnly.join(", ")}`);
    if (dbOnly.length) console.log(`   DB에만 있음(앱 드롭박스에 안 보여요): ${dbOnly.join(", ")}`);
  } else if (app.join() !== db.join()) {
    console.log(`△ ${name}: ${app.length}개 이름은 같고 순서만 달라요(화면 순서는 앱 파일 기준이라 문제없음)`);
  } else {
    console.log(`✓ ${name}: ${app.length}개 똑같음`);
  }
}
if (broken) {
  console.log("\n어긋난 목록이 있어요. 앱 파일과 DB 표를 함께 맞춰 주세요.");
  process.exit(1);
}
