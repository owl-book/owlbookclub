// 이 탭에서 목록을 거쳐 왔는지 기억한다. 모듈 변수라 사이트 안에서 이동하는 동안만 남고,
// 새로 열거나 새로고침하면(= 공유 링크로 바로 들어온 경우) 비어 있다.
let cameFromList = false;

export function markListVisited() {
  cameFromList = true;
}

export function hasVisitedList() {
  return cameFromList;
}

// 사이트 안에서 지금 보는 주소와 바로 전 주소(ClickTracker 가 화면이 바뀔 때마다 적는다). 새로 열면 둘 다 비어 있다
let currentPath = "";
let previousPath = "";

export function setCurrentPath(path: string) {
  if (path === currentPath) return;
  previousPath = currentPath;
  currentPath = path;
}

// 지금 화면(here)에 오기 직전 주소. 화면이 그려지는 순서에 따라 here 가 이미 적혀 있을 수도, 아직일 수도 있어 둘 다 처리한다
export function getPathBefore(here: string) {
  return currentPath === here ? previousPath : currentPath;
}
