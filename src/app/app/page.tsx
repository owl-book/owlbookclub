import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { InstallGuide } from "@/components/InstallGuide";
import { NotificationPreview } from "@/components/NotificationPreview";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { PUSH_PREF_ITEMS } from "@/lib/push-shared";

// 앱처럼 설치하고 알림 받기 안내. 홈 화면 광고 슬라이더·인스타·카페 공지에서 이 주소로 보낸다(채널마다 utm 꼬리표를 붙여서)
export const metadata: Metadata = {
  title: "앱처럼 설치하고 알림 받기",
  description: "부엉이들의 서재를 홈 화면에 추가하고, 찜한 모임·책방·전시 소식을 아침 알림으로 받아 보세요.",
};

export default async function AppGuidePage() {
  const ua = (await headers()).get("user-agent") ?? "";
  // 보는 사람의 휴대폰 방법을 먼저 보여 준다(컴퓨터면 아이폰부터)
  const androidFirst = /Android/i.test(ua);
  const user = isAuthEnabled() ? await getCurrentUser() : null;

  const guides = [
    { key: "ios" as const, title: "아이폰", note: "사파리에서 열어 주세요. iOS 16.4 이상은 홈 화면에 추가해야 알림을 받을 수 있어요." },
    { key: "android" as const, title: "안드로이드", note: "크롬에서 열어 주세요. 안드로이드는 추가하지 않아도 알림을 받을 수 있지만, 추가하면 앱처럼 바로 열려요." },
  ];
  if (androidFirst) guides.reverse();

  return (
    <div className="pt-6">
      <h1 className="font-display text-h2 text-ink">찜한 모임, 잊지 않게 알려드려요</h1>
      <p className="mt-2 text-b1 text-ink-2">
        가야지 마음먹은 모임도 날짜가 다가오면 깜빡하기 쉬워요. 홈 화면에 추가하면 앱처럼 열리고, 찜해 둔 소식을 아침에 알림으로 받을 수 있어요.
      </p>

      <div className="mt-6">
        <NotificationPreview />
      </div>

      <section aria-labelledby="what-title" className="mt-8">
        <h2 id="what-title" className="text-t1 text-ink">이럴 때 알려드려요</h2>
        <ul className="mt-3 divide-y divide-border rounded-md border border-border-card bg-card">
          {PUSH_PREF_ITEMS.map((item) => (
            <li key={item.key} className="px-4 py-3">
              <p className="text-l1 text-ink">{item.label}</p>
              <p className="mt-0.5 text-l2 font-normal text-ink-3">{item.hint}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-l2 font-normal leading-normal text-ink-3">여러 소식이 겹치면 하루 한 통으로 모아 보내요. 받을 알림은 환경설정에서 하나씩 끌 수 있어요.</p>
      </section>

      <section aria-labelledby="install-title" className="mt-8">
        <h2 id="install-title" className="text-t1 text-ink">홈 화면에 추가하기</h2>
        {guides.map((g) => (
          <div key={g.key} className="mt-4">
            <h3 className="text-t2 text-ink">{g.title}</h3>
            <p className="mt-0.5 text-l2 font-normal leading-normal text-ink-3">{g.note}</p>
            <div className="mt-2.5">
              <InstallGuide platform={g.key} />
            </div>
          </div>
        ))}
      </section>

      {isAuthEnabled() && (
        <section aria-labelledby="start-title" className="mt-8 rounded-md bg-sub p-4">
          <h2 id="start-title" className="text-t2 text-ink">알림 켜기</h2>
          <p className="mt-0.5 text-b2 text-ink-2">
            알림은 로그인한 분께만 보내요. 무엇을 찜했는지 알아야 알려드릴 수 있어서예요.
          </p>
          <Link
            href={user ? "/me/settings" : "/login?next=/me/settings"}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-sm bg-navy py-3 text-t2 text-page hover:bg-navy-hover active:bg-navy-active"
          >
            {user ? "알림 켜러 가기" : "로그인하고 알림 켜기"}
          </Link>
        </section>
      )}
    </div>
  );
}
