// 이 탭에서 목록을 거쳐 왔는지 기억한다. 모듈 변수라 사이트 안에서 이동하는 동안만 남고,
// 새로 열거나 새로고침하면(= 공유 링크로 바로 들어온 경우) 비어 있다.
let cameFromList = false;

export function markListVisited() {
  cameFromList = true;
}

export function hasVisitedList() {
  return cameFromList;
}
