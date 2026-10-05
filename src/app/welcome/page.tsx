import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { SubmitButton } from "@/components/SubmitButton";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/auth-shared";
import { getMeetingForRecord, getPlan, getProfile, hasWish } from "@/lib/me";
import { updateDisplayName } from "@/lib/me-actions";
import { PROVIDERS, isProviderId } from "@/lib/oauth";
import { getStore } from "@/lib/stores";
import { formatKstDateOnly } from "@/lib/time";

export const metadata: Metadata = { title: "환영해요", robots: { index: false } };

type Saved = { message: string; title: string };

// 찜·신청 표시를 누르다 가입한 경우(?done=wish-meeting&id=3): 실제로 저장됐을 때만 '담았어요'를 보여 준다
async function getSaved(userId: string, done: unknown, rawId: unknown): Promise<Saved | null> {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  try {
    if (done === "wish-store") {
      const [saved, store] = await Promise.all([hasWish(userId, "store", id), getStore(id)]);
      return saved && store ? { message: "찜 목록에 담았어요", title: store.name } : null;
    }
    if (done !== "wish-meeting" && done !== "plan") return null;
    const [saved, meeting] = await Promise.all([
      done === "plan" ? getPlan(userId, id).then((p) => !!p?.appliedAt) : hasWish(userId, "meeting", id),
      getMeetingForRecord(id),
    ]);
    if (!saved || !meeting) return null;
    return {
      message: done === "plan" ? "내 모임에 담았어요" : "찜 목록에 담았어요",
      title: `${formatKstDateOnly(meeting.startsAt)} ${meeting.title}`,
    };
  } catch (e) {
    console.error("[owl] welcome saved check failed", e);
    return null;
  }
}

// 돌아갈 화면 이름(버튼 글자)
function backLabel(next: string): string {
  if (next.startsWith("/m/")) return "모임 화면으로 돌아가기";
  if (next.startsWith("/s/")) return "책방 화면으로 돌아가기";
  return "보던 화면으로 돌아가기";
}

// "2026.10.05" (한국 시간 기준)
function cardDate(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10).replaceAll("-", ".");
}

// 처음 가입한 회원이 로그인 직후 한 번 들르는 화면: 회원증에 별명을 적거나 건너뛰고 원래 보던 페이지로 간다.
// 찜·신청 표시를 누르다 가입했다면 그 저장은 이 화면에 오기 전에 끝나 있다(로그인 콜백 welcomeDest 참고).
export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  await connection();
  if (!isAuthEnabled()) notFound();
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  // 회원 정보를 못 읽으면 별명은 나중에 마이페이지에서 정하도록 그냥 보낸다
  const [profile, saved] = await Promise.all([getProfile(user.id).catch(() => null), getSaved(user.id, sp.done, sp.id)]);
  if (!profile) redirect(next);
  const providerLabel = isProviderId(profile.provider) ? PROVIDERS[profile.provider].label : profile.provider;

  return (
    <div className="pt-8">
      {saved && (
        <p role="status" className="mb-6 flex items-center gap-3 rounded-md border border-success-border bg-success-surface px-3.5 py-3">
          <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          <span className="min-w-0">
            <span className="block text-l1 text-success">{saved.message}</span>
            <span className="mt-0.5 block truncate text-l2 font-normal text-success">{saved.title}</span>
          </span>
        </p>
      )}

      <h1 className="font-display text-h2 text-ink">반가워요!</h1>

      <form action={updateDisplayName}>
        <input type="hidden" name="next" value={next} />

        {/* 회원증: 별명 칸이 카드 위의 이름 쓰는 줄이다 */}
        <section aria-label="부엉이들의 서재 회원증" className="owl-card-in mt-4 rounded-lg bg-navy p-1.5 text-dk-ink">
          <div className="rounded-md border border-dk-border px-4 pt-4 pb-3.5">
            <div className="flex items-start justify-between">
              <p>
                <span className="block font-display text-t2 font-normal">부엉이들의 서재</span>
                <span className="mt-0.5 block text-l2 font-normal text-dk-ink-2">회원증</span>
              </p>
              <svg viewBox="0 0 24 24" aria-hidden className="size-7 text-amber-moon">
                <path fill="currentColor" d="M12 3a7.5 7.5 0 0 0 9 11.6A9 9 0 1 1 12 3Z" />
              </svg>
            </div>

            <label htmlFor="displayName" className="mt-5 block text-l2 font-normal text-dk-ink-2">
              별명
            </label>
            <input
              id="displayName"
              name="displayName"
              maxLength={20}
              autoComplete="nickname"
              defaultValue={profile.displayName ?? profile.nickname ?? ""}
              placeholder={profile.nickname ?? "책 읽는 부엉이"}
              aria-describedby="displayName-help"
              className="mt-1 w-full border-0 border-b-2 border-dk-border bg-transparent pb-1.5 text-t1 text-dk-ink outline-none placeholder:text-dk-ink-2 focus-visible:border-amber-moon"
            />
            <p id="displayName-help" className="mt-1.5 text-l2 font-normal leading-normal text-dk-ink-2">
              나에게만 보여요. 마이페이지에서 언제든 바꿀 수 있어요.
            </p>

            <p className="mt-5 flex justify-between text-l2 font-normal text-dk-ink-2">
              <span>{cardDate(profile.createdAt)} 가입</span>
              <span>{providerLabel}로 로그인</span>
            </p>
          </div>
        </section>

        <SubmitButton pendingText="저장하는 중…" className="mt-5 min-h-12 w-full rounded-sm bg-navy py-3 text-t2 text-white hover:bg-navy-hover active:bg-navy-active">
          {saved ? backLabel(next) : "이 별명으로 시작하기"}
        </SubmitButton>
      </form>

      {/* 돌아갈 곳이 찜·신청 저장 주소(/wish, /plan)일 수 있어 미리 불러오지 않도록 <a> 를 쓴다 */}
      <a href={next} className="mt-1 flex min-h-11 w-full items-center justify-center text-l1 text-ink-2 hover:text-navy">
        {saved ? "별명은 그대로 둘게요" : "나중에 정할게요"}
      </a>
    </div>
  );
}
