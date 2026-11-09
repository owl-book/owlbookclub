import "server-only";
import { revalidateTag } from "next/cache";

// 공개 화면(모임·책방)에 영향을 주는 변경 뒤 부른다. 사이트 전체 캐시를 비우던
// revalidatePath("/", "layout") 대신, 바뀐 종류의 태그만 오래된 것으로 표시한다.
// "max": 다음 방문이 바로 새 데이터를 기다리지 않고, 뒤에서 새로 읽는 동안 이전 것을 보여 준다
export const PUBLIC_TAGS = { meetings: "meetings", stores: "stores" } as const;

export function revalidatePublic(...tags: (keyof typeof PUBLIC_TAGS)[]) {
  for (const t of tags) revalidateTag(PUBLIC_TAGS[t], "max");
}
