// 내 모임(신청 표시) 화면 부품이 함께 쓰는 브라우저 저장 도우미. 저장이 막힌 인앱 브라우저에서도 화면은 그대로 동작해야 하므로 모든 읽기·쓰기를 감싼다.

const RETURN_KEY = "owl_apply_return"; // 책방 사이트로 나간 모임(돌아오면 '신청하셨나요?'를 한 번 묻는다)
const DISMISS_KEY = "owl_pending_dismissed"; // '신청하셨나요?' 후보에서 '아니요'를 누른 모임
const RETURN_TTL_MS = 3 * 60 * 60 * 1000;

// 신청 버튼을 눌러 책방 사이트로 나가기 직전에 부른다(같은 탭 세션에만 남는다)
export function rememberApplyLeave(meetingId: number) {
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ id: meetingId, at: Date.now() }));
  } catch {}
}

// 이 모임 화면으로 돌아왔는지 확인하고, 한 번만 묻도록 바로 지운다
export function takeApplyReturn(meetingId: number): boolean {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return false;
    const v = JSON.parse(raw) as { id?: unknown; at?: unknown };
    if (v.id !== meetingId) return false;
    sessionStorage.removeItem(RETURN_KEY);
    return typeof v.at === "number" && Date.now() - v.at < RETURN_TTL_MS;
  } catch {
    return false;
  }
}

export function readDismissed(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function addDismissed(meetingId: number) {
  try {
    const next = [meetingId, ...readDismissed().filter((n) => n !== meetingId)].slice(0, 50);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  } catch {}
}

// 로그인 전에 신청 표시를 누른 경우: 로그인 → 표시 완료 → 원래 화면
export function planLoginHref(meetingId: number, next: string): string {
  return `/plan?id=${meetingId}&next=${encodeURIComponent(next)}`;
}
