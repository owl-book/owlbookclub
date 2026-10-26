"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { COVER_BUCKET, titleKey } from "@/lib/book-covers";
import { imageType } from "@/lib/image-shrink";

// 관리자 표지 화면(/admin/covers)의 동작. 맨 앞에서 관리자 출입증을 다시 확인한다(requireAdmin).

const COVERS_PATH = "/admin/covers";
const MAX_BYTES = 1024 * 1024; // 화면에서 가로 480px 로 줄여 보내므로 넉넉하다(보관함 제한 0017 과 같은 값)

// 올리기·빼기 뒤에도 보던 검색 결과로 돌아가게 검색어를 이어 붙인다
function backTo(done: string, formData: FormData): string {
  const q = formData.get("q");
  const qs = new URLSearchParams({ done });
  if (typeof q === "string" && q.trim()) qs.set("q", q.trim().slice(0, 100));
  return `${COVERS_PATH}?${qs}`;
}

export type CoverUploadState = { error?: string } | undefined;

export async function uploadBookCover(_prev: CoverUploadState, formData: FormData): Promise<CoverUploadState> {
  await requireAdmin();
  const title = formData.get("title");
  const file = formData.get("image");
  if (typeof title !== "string" || !title.trim() || title.length > 200) return { error: "책 제목이 없어요. 화면을 새로 고친 뒤 다시 해 주세요." };
  if (!(file instanceof File) || file.size === 0) return { error: "올릴 사진을 골라 주세요." };
  if (file.size > MAX_BYTES) return { error: "사진이 너무 커요. 1MB 이하 사진으로 다시 골라 주세요." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) return { error: "JPG, PNG, WEBP 사진만 올릴 수 있어요." };

  const key = titleKey(title.trim());
  const { data: before } = await db().from("book_covers").select("image_path").eq("title_key", key).maybeSingle();

  // 바꿀 때마다 새 이름으로 올린다: 같은 이름이면 휴대폰·CDN 에 남은 예전 사진이 계속 보일 수 있어서
  const path = `${crypto.randomUUID()}.${type.ext}`;
  const uploaded = await db().storage.from(COVER_BUCKET).upload(path, bytes, { contentType: type.mime, cacheControl: "31536000" });
  if (uploaded.error) return { error: `사진을 올리지 못했어요. (${uploaded.error.message})` };

  const saved = await db()
    .from("book_covers")
    .upsert({ title_key: key, title: title.trim(), image_path: path, updated_at: new Date().toISOString() });
  if (saved.error) {
    await db().storage.from(COVER_BUCKET).remove([path]);
    return { error: `사진 정보를 저장하지 못했어요. (${saved.error.message})` };
  }

  // 바꾼 경우 예전 사진 파일은 보관함에서 정리한다(실패해도 화면에는 영향 없음)
  const oldPath = (before as { image_path: string } | null)?.image_path;
  if (oldPath && oldPath !== path) await db().storage.from(COVER_BUCKET).remove([oldPath]);

  revalidatePath("/", "layout");
  redirect(backTo(oldPath ? "replace" : "upload", formData));
}

// 사진 빼기: 그 책은 다시 표지 대신 디자인(또는 책 API 표지)으로 보인다
export async function removeBookCover(formData: FormData) {
  await requireAdmin();
  const key = formData.get("key");
  if (typeof key !== "string" || !key) throw new Error("잘못된 요청입니다.");

  const { data, error } = await db().from("book_covers").delete().eq("title_key", key).select("image_path").maybeSingle();
  if (error) throw new Error(error.message);
  const path = (data as { image_path: string } | null)?.image_path;
  if (path) await db().storage.from(COVER_BUCKET).remove([path]);

  revalidatePath("/", "layout");
  redirect(backTo("remove", formData));
}
