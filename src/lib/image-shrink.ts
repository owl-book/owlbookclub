// 사진 고르기 → 화면(브라우저)에서 미리 줄이기. 휴대폰 사진(수 MB)을 그대로 보내지 않고 JPG 로 줄여 보낸다.
// 책 표지(CoverUploadForm)·전시 포스터(PosterUploadForm)가 함께 쓴다.
export async function shrinkImage(file: File, maxW: number, maxH: number): Promise<{ blob: Blob; width: number; height: number }> {
  // 사진 방향(세로로 찍은 사진)을 반영해서 연다
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff"; // 투명한 PNG 는 흰 바탕으로
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85));
  return { blob, width: canvas.width, height: canvas.height };
}

// 파일 앞부분으로 실제 그림 종류를 확인한다(이름·브라우저가 알려 준 종류만 믿지 않는다). 서버에서 올리기 전에 쓴다
export function imageType(b: Uint8Array): { ext: string; mime: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}
