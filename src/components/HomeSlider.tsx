"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isInstalled } from "@/lib/app-mode";
import type { Slide, SlideTone } from "@/lib/slides";

// 홈 맨 위 광고 슬라이더. 손가락으로 옆으로 넘기거나(브라우저 기본 스크롤 + 자석처럼 멈추기) ‹ › 버튼으로 넘긴다.
// 4초마다 저절로 넘어가지만, 마우스를 올리거나·누르고 있거나·키보드로 들어오거나·화면 밖에 있으면 멈춘다.
// '동작 줄이기'를 켠 기기는 처음부터 저절로 넘기지 않는다. 멈춤 버튼은 접근성 기준(저절로 움직이는 화면은 멈출 수 있어야 함) 때문에 꼭 둔다.
// 누르면 GA 에 banner_click(slide = 장 id, position = 몇 번째) 으로 남는다.

const AUTO_MS = 4000;

// 그림 밝기마다 글자색과 '글 받침'. 받침은 글이 올라가는 왼쪽만 그림과 같은 톤으로 얇게 덮어 글씨를 또렷하게 하고,
// 오른쪽으로 갈수록 투명해져 주인공은 그대로 보인다. box 의 바탕색은 그림을 불러오기 전 잠깐만 보인다
const TONE: Record<SlideTone, { box: string; scrim: string; body: string; cta: string }> = {
  navy: { box: "bg-navy text-page", scrim: "from-navy-900/80 via-navy-900/45 via-45% to-transparent to-75%", body: "text-dk-ink", cta: "text-page" },
  cream: { box: "bg-[var(--illustration-cream)] text-ink", scrim: "from-page/80 via-page/45 via-45% to-transparent to-75%", body: "text-ink-2", cta: "text-navy" },
  sky: { box: "bg-info-surface text-ink", scrim: "from-(--illustration-leaf)/95 via-(--illustration-leaf)/75 via-50% to-transparent to-85%", body: "text-ink-2", cta: "text-navy" },
};

const noop = () => () => {};
const reduceQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduce(cb: () => void) {
  const mq = window.matchMedia(reduceQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function HomeSlider({ slides: all }: { slides: Slide[] }) {
  // 홈 화면 앱으로 연 사람에게 '설치하기' 장은 감춘다(서버에서는 알 수 없어 화면에서 거른다)
  const installed = useSyncExternalStore(noop, isInstalled, () => false);
  const reduce = useSyncExternalStore(subscribeReduce, () => window.matchMedia(reduceQuery).matches, () => false);
  const slides = installed ? all.filter((s) => !s.hideWhenInstalled) : all;
  const count = slides.length;

  const scroller = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const [rawIndex, setIndex] = useState(0);
  const index = Math.min(rawIndex, Math.max(count - 1, 0));
  // 멈춤 버튼을 누르기 전에는 '동작 줄이기' 설정을 따른다
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const playing = userPaused === null ? !reduce : !userPaused;
  const [hover, setHover] = useState(false);
  const [touching, setTouching] = useState(false);
  // 넘기기를 시도할 때마다 올려서, 넘어가다 끊겨 장 번호가 그대로여도 4초를 다시 잰다
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(true);

  // 넘어가는 중인 장. ‹ › 를 빠르게 여러 번 눌러도 도착할 장을 기준으로 한 장씩 더 넘긴다
  const target = useRef<number | null>(null);
  const goTo = useCallback(
    (i: number) => {
      const el = scroller.current?.children[i] as HTMLElement | undefined;
      if (!el || !scroller.current) return;
      target.current = i;
      scroller.current.scrollTo({ left: Math.min(el.offsetLeft, scroller.current.scrollWidth - scroller.current.clientWidth), behavior: reduce ? "auto" : "smooth" });
    },
    [reduce],
  );

  // 넘긴 만큼 지금 몇 번째 장인지 맞춘다(손가락·버튼·자동 넘김 모두 여기로 온다)
  const onScroll = () => {
    const box = scroller.current;
    if (!box) return;
    // 마지막 장은 끝까지 넘겨도 왼쪽 끝에 붙지 않으니, 넘길 수 있는 끝 위치로 맞춰 잰다
    const max = box.scrollWidth - box.clientWidth;
    let nearest = 0;
    let best = Infinity;
    Array.from(box.children).forEach((c, i) => {
      const d = Math.abs(Math.min((c as HTMLElement).offsetLeft, max) - box.scrollLeft);
      if (d < best) [best, nearest] = [d, i];
    });
    setIndex(nearest);
    // 한 장에 딱 멈추면(도착했거나 손가락으로 넘겼으면) 기준을 지금 장으로 되돌린다
    if (best < 2) target.current = null;
  };

  // 화면 밖으로 스크롤하면 멈춘다
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 장이 바뀔 때마다 4초를 새로 잰다(손으로 넘긴 직후 바로 넘어가지 않게).
  // 버튼을 누르거나 키보드로 들어와도 멈추지 않는다. 멈추려면 멈춤 버튼을 눌러야 한다
  useEffect(() => {
    if (!playing || hover || touching || !visible || count < 2) return;
    const t = window.setTimeout(() => {
      goTo((index + 1) % count);
      setAttempt((n) => n + 1);
    }, AUTO_MS);
    return () => window.clearTimeout(t);
  }, [playing, hover, touching, visible, index, count, attempt, goTo]);

  if (count === 0) return null;

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label="부엉이들의 서재 안내"
      className="relative mb-4"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
    >
      <div
        ref={scroller}
        onScroll={onScroll}
        onScrollEnd={() => (target.current = null)}
        onPointerDown={(e) => e.pointerType !== "mouse" && setTouching(true)}
        onPointerUp={() => setTouching(false)}
        onPointerCancel={() => setTouching(false)}
        // 저절로 넘어가는 동안에는 장마다 읽지 않고, 멈췄을 때만 바뀐 장을 읽어 준다
        aria-live={playing ? "off" : "polite"}
        className="owl-slider relative flex snap-x snap-mandatory gap-2 overflow-x-auto"
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${count}장 중 ${i + 1}번째`}
            className="flex w-full shrink-0 snap-start"
          >
            <SlideCard slide={s} position={i + 1} />
          </div>
        ))}
      </div>

      {/* 멈춤 버튼과 점은 따로 한 줄을 차지하지 않고 장 오른쪽 아래(장마다 비워 둔 맨 아래 줄)에 얹는다. 색은 지금 장의 바탕을 따른다.
          눈에 보이는 받침은 높이 24px 로 작게, 누르는 영역은 44px 줄 안에서 넓게 잡는다(점은 24px 높이 × 20px 폭) */}
      {count > 1 && (
        <div className="absolute bottom-1.5 right-1.5 flex h-11 items-center">
          <div
            // 그림 위에서도 보이도록 그림 톤에 맞춘 반투명 받침을 깐다
            className={`flex h-6 items-center rounded-full pl-0.5 pr-1.5 backdrop-blur-sm ${
              slides[index]?.tone === "navy" ? "bg-navy-900/45 text-page" : "bg-page/70 text-ink"
            }`}
          >
            <button
              type="button"
              onClick={() => setUserPaused(playing)}
              aria-label={playing ? "자동 넘김 멈추기" : "자동 넘김 켜기"}
              className="relative inline-flex size-6 items-center justify-center rounded-full opacity-80 before:absolute before:-inset-2.5 before:content-[''] hover:opacity-100"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-3.5" fill="currentColor">
                {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13l10.5-6.5z" />}
              </svg>
            </button>
            {/* 점을 누르면 그 장으로 간다. '이전·다음' 버튼은 두지 않는다: 손가락으로 넘길 수 있다 */}
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`${count}장 중 ${i + 1}번째 장으로 가기`}
                aria-current={i === index ? "true" : undefined}
                className="relative inline-flex h-6 w-5 items-center justify-center before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-['']"
              >
                <span aria-hidden className={`block h-1.5 rounded-full bg-current transition-[width,opacity] duration-200 motion-reduce:transition-none ${i === index ? "w-3.5 opacity-100" : "w-1.5 opacity-55"}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SlideCard({ slide: s, position }: { slide: Slide; position: number }) {
  const tone = TONE[s.tone];
  const Title = s.pageTitle ? "h1" : "p";
  const inner = (
    <>
      {/* 장이 좁아져 글씨가 부엉이에 닿기 시작하는 폭(약 350px)부터는, 그림 칸을 오른쪽 바깥으로 점점 더 내밀어(최대 36px, 맨 오른쪽 부엉이가 보일 만큼만) 부엉이를 글씨에서 떼어 놓는다.
          cqw 는 장(@container) 폭 기준이라 화면이 아니라 장의 실제 폭을 따른다 */}
      <span aria-hidden className="absolute inset-y-0 left-0 right-[calc(-1*clamp(0px,(350px-100cqw)*0.8,36px))]">
        <Image
          src={s.image}
          alt=""
          fill
          // 장 폭: 휴대폰은 화면 폭에서 양옆 여백을 뺀 만큼, 넓은 화면은 본문 폭(최대 544px)
          sizes="(max-width: 576px) 100vw, 544px"
          // 첫 장은 홈에서 가장 먼저 보이는 그림이라 바로 불러온다
          priority={position === 1}
          className="object-cover object-right"
        />
      </span>
      <span aria-hidden className={`absolute inset-0 bg-linear-to-r ${tone.scrim}`} />
      {/* 휴대폰 폭에 맞춰 20~26px 사이로 줄어든다(좁은 폰에서도 두 줄에 들어가게) */}
      <Title
        className={`relative whitespace-pre-line font-display text-[clamp(1.25rem,5.8vw,1.625rem)] leading-[1.3] tracking-[-0.02em]`}
      >
        {s.title}
      </Title>
      {/* 시험 운영 표시는 오른쪽 위 모서리에(멈춤·넘김 버튼처럼 그림 톤의 반투명 받침) */}
      {s.beta && (
        <span
          className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-l2 font-semibold leading-[1.4] backdrop-blur-sm ${
            s.tone === "navy" ? "bg-navy-900/45 text-page" : "bg-page/70 text-ink"
          }`}
        >
          BETA
        </span>
      )}
      <p className={`relative mt-1.5 whitespace-pre-line text-b2 ${tone.body}`}>{s.body}</p>
      {s.note && <p className={`relative mt-1 hidden max-w-[17rem] text-l2 sm:block ${tone.body}`}>{s.note}</p>}
      {/* 맨 아래 줄: 왼쪽에 누르는 곳 글자, 오른쪽은 멈춤·넘김 버튼 자리로 비워 둔다(장 전체가 링크라 버튼 모양 대신 글자로).
          줄 높이·바닥 여백을 버튼 받침(44px, 바닥에서 6px)에 맞춰 글자가 '1 / 3'과 같은 높이에 온다 */}
      <span className="relative mt-auto flex min-h-11 items-center pr-28 pt-2">
        {s.href && s.cta && (
          <span className={`inline-flex items-center gap-0.5 text-l1 font-semibold underline decoration-1 underline-offset-4 ${tone.cta}`}>
            {s.cta}
            <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        )}
      </span>
    </>
  );
  const box = `@container relative flex w-full flex-col overflow-hidden rounded-md px-5 pb-2.5 pt-4 ${tone.box}`;
  if (!s.href) return <div className={box}>{inner}</div>;
  return (
    <Link
      href={s.href}
      onClick={() => window.gtag?.("event", "banner_click", { slide: s.id, position: String(position) })}
      className={`${box} focus-visible:outline-offset-[-4px] ${s.tone === "navy" ? "focus-visible:outline-page" : ""}`}
    >
      {inner}
    </Link>
  );
}
