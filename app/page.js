"use client";

import { useState } from "react";
import { ORG, SLOGAN } from "../lib/supabase";

// 첫 화면: 청아람어린이집 건물 사진 → 「전시회 들어가기」를 누르면 현관 쪽으로 다가가며 전시장(교실)으로
export default function Home() {
  const [going, setGoing] = useState(false);
  const enter = () => {
    if (going) return;
    setGoing(true);
    setTimeout(() => { window.location.href = "/hall"; }, 1100);
  };
  return (
    <main className={`entry${going ? " going" : ""}`}>
      <img className="entry-bg" src="/building.webp" alt="청아람어린이집 건물" draggable={false} />
      <div className="entry-shade" />
      <div className="entry-box">
        <span className="entry-slogan">{SLOGAN}</span>
        <h1>{ORG}<br /><em>그림책 전시회</em></h1>
        <p>우리 아이들이 직접 만든 그림책이 전시장에 둥둥 떠 있어요.<br />책을 누르면 그림책이 열리고 동요가 함께 흘러나와요 🎵</p>
        <button className="entry-btn" onClick={enter}>🚪 전시회 들어가기</button>
        <small>🔊 소리를 켜고 보시면 더 좋아요</small>
      </div>
      <div className="entry-flash" />
    </main>
  );
}
