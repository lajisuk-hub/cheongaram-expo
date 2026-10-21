"use client";

import { ORG } from "../../lib/supabase";

// 학부모용 사용법 팝업
const ITEMS = [
  {
    emoji: "📖", color: "#2f9e57", title: "그림책 보기",
    what: "우리 아이들이 만든 그림책이 전시장에 둥둥 떠다녀요. 책을 누르면 크게 열리고, 그 책의 동요가 함께 흘러나와요.",
    how: ["떠다니는 책 표지(또는 아래 「📚 그림책 모아 보기」) 누르기", "좌우로 밀거나 ‹ › 를 눌러 한 장씩 넘기기 · 노래는 「🔇 노래 끄기」로 끌 수 있어요"],
  },
  {
    emoji: "💬", color: "#f08c00", title: "소감 남기기",
    what: "책을 다 보면 소감 한마디를 남겨 주세요. 남긴 소감도 전시장에 함께 떠다녀요.",
    how: ["「다 봤어요! 소감 남기기」 → 「전시장에 띄우기」", "떠 있는 소감을 누르면 「♥ 나도 같은 마음」 — 같은 말이 모이면 글자가 커져요"],
  },
];

export default function Guide({ onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal guide" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="닫기">✕</button>
        <div className="guide-head">
          <span className="org">{ORG}</span>
          <h2>그림책 전시회에 오신 걸 환영해요 📚</h2>
          <p className="sub">아이들이 한 장 한 장 정성껏 만든 그림책이에요. 동요와 함께 천천히 넘겨 보시고, 따뜻한 한마디를 남겨 주세요.</p>
        </div>
        <ol className="guide-list">
          {ITEMS.map((it) => (
            <li key={it.title} style={{ "--c": it.color }}>
              <div className="g-ic">{it.emoji}</div>
              <div>
                <b>{it.title}</b>
                <p>{it.what}</p>
                <ul>{it.how.map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
            </li>
          ))}
        </ol>
        <div className="guide-tips">
          <span>🔊 휴대폰 무음(진동)을 풀고 소리를 켜 주세요</span>
          <span>👆 화면을 좌우로 밀면 전시장을 둘러볼 수 있어요</span>
          <span>❓ 이 설명은 오른쪽 위 「사용법」 단추로 다시 볼 수 있어요</span>
        </div>
        <button className="btn big" onClick={onClose}>시작할게요!</button>
      </div>
    </div>
  );
}
