"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { removeMeetingPhoto, uploadMeetingPhoto, type PhotoUploadState } from "@/lib/meeting-photo-actions";
import { shrinkImage } from "@/lib/image-shrink";
import { SubmitButton } from "@/components/SubmitButton";

// 모임 대표 사진(예: 영화 포스터) 고르기 → 화면에서 미리 줄이기 → 올리기. 승인 대기 화면에서만 쓴다.
// 카드 표지는 72×108px(2:3)이라 가로 480px JPG 로 줄여 보낸다. 모양이 다르면 카드에서 가운데만 잘라 채운다.
const MAX_W = 480;
const MAX_H = 720;

const thumb = "h-[72px] w-[48px] shrink-0 rounded-xs object-cover ring-1 ring-border";
const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-sm border border-border-control bg-card px-3 text-l1 font-semibold text-ink hover:border-border-strong";

// cardId: 사진을 올린 뒤 돌아갈 카드(묶음 모임이면 묶음 대표 카드)
export function MeetingPhotoForm({ meetingId, cardId, label, photoUrl }: { meetingId: number; cardId: number; label: string; photoUrl: string | null }) {
  const inputId = useId();
  const blobRef = useRef<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(async (prev: PhotoUploadState, fd: FormData) => {
    if (!blobRef.current) return { error: "올릴 사진을 골라 주세요." };
    fd.set("image", blobRef.current, "photo.jpg");
    return uploadMeetingPhoto(prev, fd);
  }, undefined);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 사진을 다시 골라도 다시 읽히게
    if (!file) return;
    setPickError(null);
    try {
      const { blob } = await shrinkImage(file, MAX_W, MAX_H);
      blobRef.current = blob;
      setPreview(URL.createObjectURL(blob));
    } catch {
      blobRef.current = null;
      setPreview(null);
      setPickError("이 사진은 열 수 없어요. JPG나 PNG 사진으로 다시 골라 주세요.");
    }
  }

  const error = pickError ?? state?.error;
  const shown = preview ?? photoUrl;

  return (
    <div className="mt-2">
      <p className="text-l2 font-semibold text-ink">{label}</p>
      <div className="mt-1 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown ? <img src={shown} alt={preview ? "올릴 사진 미리 보기" : "지금 대표 사진"} className={thumb} /> : <span aria-hidden className={`${thumb} bg-card`} />}
        <div className="flex flex-wrap gap-2">
          <form action={formAction} className="contents">
            <input type="hidden" name="meetingId" value={meetingId} />
            <input type="hidden" name="cardId" value={cardId} />
            {/* 진짜 파일 칸은 숨기고 버튼 모양 label 로 연다. 키보드 초점은 label 에 보여 준다(peer) */}
            <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={onPick} className="peer sr-only" />
            <label htmlFor={inputId} className={`${buttonClass} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy`}>
              {preview ? "다른 사진" : photoUrl ? "사진 바꾸기" : "사진 고르기"}
            </label>
            {preview && (
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending || undefined}
                className="inline-flex min-h-11 items-center rounded-sm bg-navy px-3 text-l1 font-semibold text-page hover:bg-navy-hover disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "올리는 중…" : "이 사진 올리기"}
              </button>
            )}
          </form>
          {photoUrl && !preview && (
            <form action={removeMeetingPhoto}>
              <input type="hidden" name="meetingId" value={meetingId} />
              <input type="hidden" name="cardId" value={cardId} />
              <SubmitButton pendingText="빼는 중…" confirm="대표 사진을 뺄까요? 카드에는 다시 그림이나 책 표지가 보여요." className={`${buttonClass} text-ink-2`}>
                빼기
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
      {preview && <p className="mt-1 text-l2 font-normal text-ink-3">카드에는 왼쪽처럼 가운데가 보여요. [이 사진 올리기]를 눌러야 저장돼요.</p>}
      {error && (
        <p role="alert" className="mt-1 text-b2 text-error">
          {error}
        </p>
      )}
    </div>
  );
}
