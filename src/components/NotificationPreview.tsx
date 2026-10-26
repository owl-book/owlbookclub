import { OwlMark } from "@/components/OwlMark";

// "이런 알림이 와요": 휴대폰 잠금화면에 알림이 쌓인 모습을 미리 보여 준다.
// 알림을 켜기 전에 무엇을 받게 되는지 눈으로 보게 하려는 것이라, 실제 알림과 같은 문구 규칙으로 쓴다(push-digest.ts compose).
// 다크 표면은 이 부품 안에서만 쓴다(디자인 시스템: 페이지 전체 다크모드 없음).

const SAMPLES = [
  { title: "오늘 찜한 모임이 있어요", lines: ["그림책 함께 읽는 저녁", "동네책방 · 오늘 오후 7:30"], when: "지금" },
  { title: "찜한 전시가 3일 뒤 끝나요", lines: ["가을 원화전", "동네책방 · 10월 26일까지"], when: "어제" },
];

export function NotificationPreview() {
  return (
    <figure className="overflow-hidden rounded-lg bg-dk-bg px-4 pt-6 pb-4">
      <div aria-hidden className="text-center">
        <p className="text-l1 font-medium text-dk-ink-2">아침 알림</p>
        <p className="mt-0.5 font-display text-h1 leading-none text-dk-ink">8:00</p>
      </div>
      <ul className="mt-5 space-y-2" aria-label="알림 예시">
        {SAMPLES.map((n, i) => (
          <li key={n.title} className={`flex gap-3 rounded-md bg-dk-card p-3 ${i > 0 ? "opacity-70" : ""}`}>
            <OwlMark className="size-9 shrink-0 rounded-sm" />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-2 text-l2 text-dk-ink-2">
                <span>부엉이들의 서재</span>
                <span className="shrink-0 font-normal">{n.when}</span>
              </p>
              <p className="mt-0.5 text-l1 font-semibold text-dk-ink">{n.title}</p>
              {n.lines.map((line) => (
                <p key={line} className="mt-0.5 truncate text-l2 font-normal text-dk-ink-2">
                  {line}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="mt-3 text-center text-l2 font-normal text-dk-ink-2">하루 한 번, 아침에 모아서 보내드려요</figcaption>
    </figure>
  );
}
