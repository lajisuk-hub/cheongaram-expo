"use client";

// 전시장 맨 아래 옆으로 흐르는 작은 안내 글
export function Ticker() {
  const t = "놀면서 배우고 사랑으로 자라는 청아람어린이집  ·  우리 아이들이 만든 그림책 전시회  ·  ";
  return (
    <div className="ticker" aria-hidden="true"><div className="ticker-in"><span>{t}{t}{t}{t}</span></div></div>
  );
}
