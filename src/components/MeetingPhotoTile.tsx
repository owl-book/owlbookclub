"use client";

import { useEffect, useId, useRef, useState } from "react";
import { shrinkImage } from "@/lib/image-shrink";

// 표지 그림 고르기의 맨 왼쪽 칸: 모임 대표 사진(예: 영화 포스터). 승인 화면의 [내용 고치기] 안에서만 쓴다.
// 사진이 없으면 '+' 칸 → 누르면 사진 고르기. 고른 사진은 화면에서 가로 480px JPG 로 줄여 파일 칸(photo)에 다시 넣어 두고,
// [고친 내용 저장]을 누를 때 다른 칸과 함께 보낸다. 다른 그림을 고르고 저장하면 사진은 빠진다.
// 카드 표지는 72×108px(2:3)이라 모양이 다르면 카드에서 가운데만 잘라 채운다(이 칸도 똑같이 보여 준다)
const MAX_W = 480;
const MAX_H = 720;

const tile =
  "relative block aspect-[2/3] overflow-hidden rounded-xs bg-cream ring-1 ring-border peer-checked:ring-2 peer-checked:ring-navy peer-focus-visible:outline-2 peer-focus-visible:outline-navy";

export function MeetingPhotoTile({ photoUrl, checked }: { photoUrl: string | null; checked: boolean }) {
  const fileId = useId();
  const radioRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const { blob } = await shrinkImage(file, MAX_W, MAX_H);
      // 줄인 사진으로 파일 칸을 바꿔 둔다: 저장할 때 원본 대신 이 사진이 간다
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      input.files = dt.files;
      setPreview(URL.createObjectURL(blob));
      // 이미 사진이 있던 칸은 바로 선택하고, '+' 칸은 사진 칸으로 바뀌며 선택된 채로 나온다(defaultChecked)
      if (radioRef.current) radioRef.current.checked = true;
    } catch {
      input.value = "";
      setPreview(null);
      setError("이 사진은 열 수 없어요. JPG나 PNG 사진으로 다시 골라 주세요.");
    }
  }

  const shown = preview ?? photoUrl;

  return (
    <div className="text-center">
      <input ref={fileRef} id={fileId} name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={onPick} className="sr-only" tabIndex={-1} />
      {shown ? (
        // 사진이 있으면 다른 그림처럼 눌러서 고르는 칸
        <label className="block cursor-pointer">
          <input ref={radioRef} type="radio" name="coverArt" value="photo" defaultChecked={checked || Boolean(preview)} className="peer sr-only" />
          <span className={tile}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="대표 사진" className="size-full object-cover" />
          </span>
          <span className="mt-1 block text-l2 font-normal leading-tight text-ink-2 peer-checked:font-semibold peer-checked:text-navy">사진</span>
        </label>
      ) : (
        // 사진이 없으면 '+' 칸: 누르면 사진 고르기 창이 열린다(고르기 전에는 이 칸이 선택되지 않는다)
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="block w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <span className="flex aspect-[2/3] items-center justify-center rounded-xs border-2 border-dashed border-border-control bg-card text-[28px] leading-none font-normal text-ink-3 hover:border-navy hover:text-navy">
              +
            </span>
            <span className="mt-1 block text-l2 font-normal leading-tight text-ink-2">사진 추가</span>
          </button>
        </>
      )}
      {shown && (
        <button type="button" onClick={() => fileRef.current?.click()} className="mt-0.5 min-h-8 text-l2 font-semibold text-navy underline underline-offset-2">
          바꾸기
        </button>
      )}
      {error && (
        <p role="alert" className="mt-1 text-left text-l2 font-normal text-error">
          {error}
        </p>
      )}
    </div>
  );
}
