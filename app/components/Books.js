"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_LEN, cleanText, hasBadWord } from "../../lib/words";

// 그림책 전시: 전시장에 떠다니는 책 표지 · 크게 넘겨 보는 창(동요 자동 재생) · 소감 한마디 · 책장
export const QUICK_WORDS = ["감동이에요", "따뜻해요", "사랑스러워요", "최고예요", "뭉클해요", "또 보고 싶어요", "재미있어요", "우리 아이가 좋아해요"];
export const BOOK_COLOR = "#845ec2";

// ── 로비에 떠다니는 모양 ─────────────────────────
export function renderBook(b) {
  return (
    <span className="bk-float">
      {b.cover ? <img src={b.cover} alt={`${b.title} 표지`} loading="lazy" draggable={false} /> : <span className="bk-nocover">📖</span>}
      <span className="bk-name">{b.title}</span>
      {b.song && <span className="bk-note" aria-label="동요 있음">♪</span>}
    </span>
  );
}
export function renderReview(g) {
  const fs = Math.min(30, 14 + (g.count - 1) * 3);
  return (
    <span className="rv-float" style={{ fontSize: fs }}>
      💬 {g.text}{g.count > 1 && <em>×{g.count}</em>}
    </span>
  );
}

// ── 크게 넘겨 보는 창 ────────────────────────────
export function BookViewer({ book, onClose }) {
  const pages = book.pages || [];
  const [wide, setWide] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState("next");
  const seen = useRef(1);
  const touch = useRef(null);
  const audio = useRef(null);
  const [music, setMusic] = useState(book.song ? "on" : "none"); // on | off | blocked | none

  // 책을 연 순간(누른 동작 안에서) 그 책의 동요를 틀고, 끝나면 처음부터 다시. 창을 닫으면 멈춘다.
  useEffect(() => {
    if (!book.song) return;
    const a = new Audio(book.song);
    a.loop = true; a.volume = 0.8;
    audio.current = a;
    // 휴대폰이 자동 재생을 막으면 「노래 켜기」 단추로 (창을 닫아 멈춘 것은 막힌 게 아니니 무시)
    a.play().then(() => audio.current === a && setMusic("on")).catch(() => audio.current === a && setMusic("blocked"));
    return () => { audio.current = null; a.pause(); a.removeAttribute("src"); a.load(); };
  }, [book.song]);
  const toggleMusic = () => {
    const a = audio.current; if (!a) return;
    if (music === "on") { a.pause(); setMusic("off"); }
    else a.play().then(() => setMusic("on")).catch(() => setMusic("blocked"));
  };

  useEffect(() => {
    const on = () => setWide(window.innerWidth / window.innerHeight > 1.15);
    on(); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on);
  }, []);

  // 넓은 화면은 두 쪽씩 펼쳐 보기(표지는 한 쪽). 쪽 그림이 이미 두 쪽 펼침인 책(spread)은 늘 한 장씩
  const views = useMemo(() => {
    if (!wide || pages.length < 3 || book.spread) return pages.map((_, i) => [i]);
    const v = [[0]];
    for (let i = 1; i < pages.length; i += 2) v.push(i + 1 < pages.length ? [i, i + 1] : [i]);
    return v;
  }, [wide, pages, book.spread]);
  const cur = Math.min(idx, Math.max(0, views.length - 1));
  const last = cur === views.length - 1;

  const go = (d) => {
    const next = cur + d;
    if (next < 0) return;
    if (next >= views.length) return onClose(true);
    setDir(d > 0 ? "next" : "prev"); setIdx(next);
    seen.current = Math.max(seen.current, next + 1);
  };
  // 몇 쪽이라도 읽은 사람에게만 소감을 권한다
  const close = () => onClose(seen.current >= Math.min(3, views.length));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    for (const v of [views[cur + 1], views[cur + 2]]) (v || []).forEach((i) => { new Image().src = pages[i]; });
  }, [cur, views, pages]);

  if (!pages.length)
    return (
      <div className="bv">
        <button className="bv-close solo" onClick={() => onClose(false)} aria-label="닫기">✕</button>
        <p style={{ margin: "auto" }}>이 책에는 아직 쪽 그림이 없어요.</p>
      </div>
    );

  return (
    <div
      className="bv"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current; touch.current = null;
        if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="bv-head">
        <div><strong>{book.title}</strong>{book.by && <span>{book.by}</span>}</div>
        {music !== "none" && (
          <button className={`bv-music ${music}`} onClick={toggleMusic}>
            {music === "on" ? <>🎵 <span>{book.songName || "동요"}</span> · 🔇 노래 끄기</> : "▶ 🎵 노래 켜기"}
          </button>
        )}
        <button className="bv-close" onClick={close} aria-label="닫기">✕</button>
      </div>
      <div className="bv-stage">
        <button className="bv-zone left" onClick={() => go(-1)} aria-label="이전 쪽" disabled={cur === 0}><i>‹</i></button>
        <div key={`${cur}-${wide}`} className={`bv-pages ${dir}${views[cur].length === 2 ? " spread" : ""}`}>
          {views[cur].map((i) => <img key={i} src={pages[i]} alt={`${i + 1}쪽`} draggable={false} />)}
        </div>
        <button className="bv-zone right" onClick={() => go(1)} aria-label="다음 쪽"><i>›</i></button>
      </div>
      <div className="bv-foot">
        <div className="bv-bar"><b style={{ width: `${((cur + 1) / views.length) * 100}%` }} /></div>
        <span>{views[cur].map((i) => i + 1).join("–")} / {pages.length}</span>
        {book.spread && !wide && <em className="bv-hint">📱 휴대폰을 가로로 돌리면 더 크게 보여요</em>}
        {last && <button className="bv-done" onClick={() => onClose(true)}>다 봤어요! 소감 남기기 ✍</button>}
      </div>
    </div>
  );
}

// ── 소감 한마디 ──────────────────────────────────
export function ReviewForm({ book, popular = [], onCancel, onSubmit }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const chips = [...new Set([...popular, ...QUICK_WORDS])].slice(0, 9);
  const send = async () => {
    const t = cleanText(text);
    if (!t) return setErr("한마디를 적어 주세요");
    if (hasBadWord(t)) return setErr("모두가 함께 보는 전시회예요. 고운 말로 적어 주세요 🙏");
    setBusy(true);
    try { await onSubmit(t); } catch (e) { setErr("저장하지 못했어요. 잠시 뒤 다시 눌러 주세요."); setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal rv-form" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onCancel} aria-label="닫기">✕</button>
        <div className="rv-emoji">📚</div>
        <h2>소감 한마디를 남겨 주세요</h2>
        {book && <p className="rv-book">『{book.title}』 잘 보셨나요?</p>}
        <div className="rv-input">
          <input
            autoFocus value={text} maxLength={MAX_LEN} placeholder="예) 아이 마음이 느껴져 뭉클했어요"
            onChange={(e) => { setText(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
          />
          <span>{text.length}/{MAX_LEN}</span>
        </div>
        <p className="rv-hint">눌러서 고를 수도 있어요 · 같은 말이 모이면 글자가 커져요</p>
        <div className="rv-chips">
          {chips.map((c) => <button key={c} className={text === c ? "on" : ""} onClick={() => { setText(c); setErr(""); }}>{c}</button>)}
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn rv-send" onClick={send} disabled={busy}>{busy ? "띄우는 중…" : "전시장에 띄우기 ✨"}</button>
        <button className="rv-skip" onClick={onCancel}>다음에 할게요</button>
      </div>
    </div>
  );
}

// ── 떠 있는 소감을 눌렀을 때 ──────────────────────
export function ReviewBubble({ group, book, onSame, onOpenBook, onClose }) {
  const [done, setDone] = useState(false);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal rv-form" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="닫기">✕</button>
        <div className="rv-emoji">💬</div>
        <h2 className="rv-big">“{group.text}”</h2>
        <p className="rv-book">{book ? `『${book.title}』을 보고 남긴 소감` : "그림책 소감"} · {group.count + (done ? 1 : 0)}명이 같은 마음</p>
        <button className="btn rv-send" disabled={done} onClick={async () => { try { await onSame(); setDone(true); } catch {} }}>
          {done ? "♥ 마음을 보탰어요" : "♥ 나도 같은 마음"}
        </button>
        {book && <button className="rv-skip" onClick={onOpenBook}>📖 이 그림책 보기</button>}
      </div>
    </div>
  );
}

// ── 책장 (📚 탭) ─────────────────────────────────
export function BookShelf({ books, counts, onOpen, onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal shelf" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="닫기">✕</button>
        <h2>📚 그림책 모아 보기</h2>
        <p className="sub">{books.length ? "보고 싶은 책을 누르면 크게 열리고 동요가 흘러나와요. 다 보고 나면 소감 한마디를 남겨 주세요!" : "아직 전시된 그림책이 없어요. 어린이집에서 곧 올려 줄 거예요."}</p>
        <div className="shelf-grid">
          {books.map((b) => (
            <button key={b.id} className="shelf-book" onClick={() => onOpen(b)}>
              {b.cover ? <img src={b.cover} alt="" loading="lazy" /> : <span className="bk-nocover">📖</span>}
              <b>{b.title}</b>
              {b.by && <small>{b.by}</small>}
              <em>{b.song ? "🎵 " : ""}💬 소감 {counts[b.id] || 0}</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
