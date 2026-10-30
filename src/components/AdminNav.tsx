import { AdminTabs, type AdminTabKey } from "@/components/AdminTabs";
import { logoutAdmin } from "@/lib/admin-actions";

// 운영자 화면 맨 위 탭. 승인 대기·신고함·책 표지·알림을 오가고, 탭마다 남은 할 일 수를 보여 준다(알림 탭은 할 일이 없어 숫자 없음). 탭과 숫자 갱신은 AdminTabs.
// 나가기는 탭과 떨어진 오른쪽 위에 둬서 탭을 누르려다 잘못 누르지 않게 한다.
type Props = {
  current: AdminTabKey;
  counts: Partial<Record<AdminTabKey, number>>;
};

export function AdminNav({ current, counts }: Props) {
  return (
    <div className="pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-l1 font-semibold text-ink-2">운영자 화면</p>
        <form action={logoutAdmin}>
          <button type="submit" className="inline-flex min-h-11 items-center px-2 text-l2 text-ink-3 underline underline-offset-2 hover:text-navy">
            나가기
          </button>
        </form>
      </div>
      <AdminTabs current={current} counts={counts} />
    </div>
  );
}
