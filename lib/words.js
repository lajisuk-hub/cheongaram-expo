// 후기 글자를 다듬고, 같은 말끼리 묶어 세는 도구

export const MAX_LEN = 30;

// 큰 화면에 그대로 뜨기 때문에 험한 말은 받지 않는다.
const BAD = ["시발", "씨발", "ㅅㅂ", "병신", "ㅂㅅ", "좆", "존나", "새끼", "개새", "지랄", "미친놈", "미친년", "fuck", "shit"];

export function cleanText(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
}

export function hasBadWord(text) {
  const t = text.replace(/\s/g, "").toLowerCase();
  return BAD.some((w) => t.includes(w));
}

// 띄어쓰기·문장부호·이모지가 달라도 같은 말로 본다.
export function keyOf(text) {
  return text.toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");
}

// 후기 목록 → [{key, text, count, bookId, last}] (많이 나온 말 먼저)
export function groupReviews(reviews) {
  const map = new Map();
  for (const r of reviews) {
    if (r.hidden) continue;
    const key = keyOf(r.text) || r.text;
    if (!key) continue;
    const g = map.get(key);
    if (g) {
      g.count += 1;
      if (r.at > g.last) g.last = r.at;
    } else {
      map.set(key, { key, text: r.text, count: 1, bookId: r.bookId, last: r.at || "" });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1));
}
