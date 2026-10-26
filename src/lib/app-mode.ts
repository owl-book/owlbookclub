// 지금 화면이 홈 화면에 설치한 앱(주소창 없는 화면)으로 열렸는지. 브라우저에서만 부른다
export function isInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
