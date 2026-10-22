"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { uploadExhibitionPoster, type PosterUploadState } from "@/lib/exhibition-actions";
import { shrinkImage } from "@/lib/image-shrink";

// 전시 포스터 고르기 → 화면에서 미리 줄이기 → 올리기.
// 전시 글에서 포스터를 크게(최대 352px 폭, 휴대폰 화면 2~3배 선명도) 보여 주므로 긴 쪽 1600px JPG 로 줄여 보낸다.
// 원래 비율(가로·세로)도 함께 보내서, 전시 글이 포스터 자리를 미리 잡아 두게 한다
const MAX_SIDE = 1600;

export function PosterUploadForm({ exhibitionId, hasPoster }: { exhibitionId: number; hasPoster: boolean }) {
  const inputId = useId();
  const picked = useRef<{ blob: Blob; width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(async (prev: PosterUploadState, fd: FormData) => {
    if (!picked.current) return { error: "올릴 포스터를 골라 주세요." };
    fd.set("image", picked.current.blob, "poster.jpg");
    fd.set("width", String(picked.current.width));
    fd.set("height", String(picked.current.height));
    return uploadExhibitionPoster(prev, fd);
  }, undefined);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 사진을 다시 골라도 다시 읽히게
    if (!file) return;
    setPickError(null);
    try {
      picked.current = await shrinkImage(file, MAX_SIDE, MAX_SIDE);
      setPreview(URL.createObjectURL(picked.current.blob));
    } catch {
      picked.current = null;
      setPreview(null);
      setPickError("이 사진은 열 수 없어요. JPG나 PNG 사진으로 다시 골라 주세요.");
    }
  }

  const error = pickError ?? state?.error;

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="exhibitionId" value={exhibitionId} />
      {preview && (
        <div className="mb-3 flex items-end gap-3">
          {/* 목록 카드와 같은 3:4 칸에 맞춰 미리 보여 준다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="올릴 포스터 미리 보기" className="h-[128px] w-[96px] rounded-xs object-cover ring-1 ring-border" />
          <p className="text-b2 text-ink-2">목록 카드에는 이렇게 보여요. 전시 글에서는 잘리지 않고 전체가 보여요.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* 진짜 파일 칸은 숨기고 버튼 모양 label 로 연다. 키보드 초점은 label 에 보여 준다(peer) */}
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={onPick} className="peer sr-only" />
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-sm border border-border-control bg-card px-4 text-l1 font-semibold text-ink hover:border-border-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy"
        >
          {preview ? "다른 사진 고르기" : hasPoster ? "포스터 바꾸기" : "포스터 고르기"}
        </label>
        {preview && (
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className="inline-flex min-h-11 items-center rounded-sm bg-navy px-4 text-l1 font-semibold text-page hover:bg-navy-hover disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "올리는 중…" : "이 포스터 올리기"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-b2 text-error">
          {error}
        </p>
      )}
    </form>
  );
}
