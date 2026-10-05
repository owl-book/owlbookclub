"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { uploadBookCover, type CoverUploadState } from "@/lib/cover-actions";

// 책 표지 사진 고르기 → 화면에서 미리 줄이기 → 올리기.
// 휴대폰 사진(수 MB)을 그대로 보내지 않고 가로 480px JPG(보통 100KB 안팎)로 줄여 보낸다. 카드 표지는 72px 라 충분하다.
const MAX_W = 480;
const MAX_H = 720;

async function shrink(file: File): Promise<Blob> {
  // 사진 방향(세로로 찍은 사진)을 반영해서 연다
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff"; // 투명한 PNG 는 흰 바탕으로
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85));
}

export function CoverUploadForm({ title, hasCover }: { title: string; hasCover: boolean }) {
  const inputId = useId();
  const blobRef = useRef<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(async (prev: CoverUploadState, fd: FormData) => {
    if (!blobRef.current) return { error: "올릴 사진을 골라 주세요." };
    fd.set("image", blobRef.current, "cover.jpg");
    return uploadBookCover(prev, fd);
  }, undefined);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 사진을 다시 골라도 다시 읽히게
    if (!file) return;
    setPickError(null);
    try {
      const blob = await shrink(file);
      blobRef.current = blob;
      setPreview(URL.createObjectURL(blob));
    } catch {
      blobRef.current = null;
      setPreview(null);
      setPickError("이 사진은 열 수 없어요. JPG나 PNG 사진으로 다시 골라 주세요.");
    }
  }

  const error = pickError ?? state?.error;

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="title" value={title} />
      {preview && (
        <div className="mb-3 flex items-end gap-3">
          {/* 카드와 같은 2:3 칸에 맞춰 미리 보여 준다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="올릴 사진 미리 보기" className="h-[108px] w-[72px] rounded-xs object-cover ring-1 ring-border" />
          <p className="text-b2 text-ink-2">카드에는 이렇게 보여요. 가운데를 기준으로 잘려요.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* 진짜 파일 칸은 숨기고 버튼 모양 label 로 연다. 키보드 초점은 label 에 보여 준다(peer) */}
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={onPick} className="peer sr-only" />
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-sm border border-border-control bg-card px-4 text-l1 font-semibold text-ink hover:border-border-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy"
        >
          {preview ? "다른 사진 고르기" : hasCover ? "사진 바꾸기" : "사진 고르기"}
        </label>
        {preview && (
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className="inline-flex min-h-11 items-center rounded-sm bg-navy px-4 text-l1 font-semibold text-page hover:bg-navy-hover disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "올리는 중…" : "이 사진 올리기"}
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
