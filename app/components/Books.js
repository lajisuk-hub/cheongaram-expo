"use client";

import { useEffect, useRef, useState } from "react";
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
  const ratio = book.spread ? 1.4 : Math.min(1.4, Math.max(0.5, book.coverRatio || 0.72)); // 한 쪽의 가로/세로
  const host = useRef(null);
  const stage = useRef(null);
  const flip = useRef(null);
  const [idx, setIdx] = useState(0);
  const [two, setTwo] = useState(false); // 두 쪽 펼침인지
  const [box, setBox] = useState(null); // 무대 크기
  const seen = useRef(0);
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

  // 무대 크기를 재고(화면을 돌리거나 창 크기가 바뀌면 다시)
  useEffect(() => {
    const on = () => { const r = stage.current?.getBoundingClientRect(); if (r) setBox((b) => (b && Math.abs(b.w - r.width) < 8 && Math.abs(b.h - r.height) < 8 ? b : { w: r.width, h: r.height })); };
    on(); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on);
  }, []);

  // 전자책처럼 종이가 말려 넘어가는 책 (page-flip). 넓은 화면은 두 쪽 펼침, 휴대폰 세로는 한 쪽씩.
  useEffect(() => {
    if (!box || !pages.length || !host.current) return;
    let pf = null, dead = false;
    const W = box.w - 16, H = box.h - 8;
    const spreadW = Math.min(H * ratio, W / 2);
    const wide = !book.spread && pages.length > 2 && box.w / box.h > 1.1 && spreadW >= 160;
    const pw = Math.floor(wide ? spreadW : Math.min(W, H * ratio));
    const ph = Math.floor(pw / ratio);
    setTwo(wide);
    import("page-flip").then(({ PageFlip }) => {
      if (dead) return;
      const el = document.createElement("div");
      host.current.innerHTML = ""; host.current.appendChild(el);
      const nodes = pages.map((src, i) => {
        const d = document.createElement("div");
        d.className = "pf-page" + (i === 0 || i === pages.length - 1 ? " hard" : "");
        if (i === 0 || i === pages.length - 1) d.dataset.density = "hard"; // 표지는 두꺼운 종이처럼
        const img = document.createElement("img"); img.src = src; img.alt = `${i + 1}쪽`; img.draggable = false;
        d.appendChild(img); return d;
      });
      pf = new PageFlip(el, {
        width: pw, height: ph, size: "fixed", autoSize: false, usePortrait: !wide, showCover: wide,
        startPage: Math.min(seen.current ? idx : 0, pages.length - 1), flippingTime: 800, maxShadowOpacity: 0.45, mobileScrollSupport: false,
      });
      pf.loadFromHTML(nodes);
      pf.on("flip", (e) => { setIdx(e.data); seen.current = Math.max(seen.current, e.data); });
      flip.current = pf;
    });
    return () => { dead = true; flip.current = null; try { pf?.destroy(); } catch {} if (host.current) host.current.innerHTML = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, pages, ratio, book.spread]);

  // 펼침 화면에서 마지막 장(오른쪽에 마지막 쪽이 보이는 때)인지
  const last = idx >= pages.length - (two ? 2 : 1);
  const next = () => { if (last) return onClose(true); flip.current?.flipNext("bottom"); };
  const prev = () => flip.current?.flipPrev("bottom");
  // 몇 쪽이라도 읽은 사람에게만 소감을 권한다
  const close = () => onClose(seen.current >= Math.min(3, pages.length - 1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!pages.length)
    return (
      <div className="bv">
        <button className="bv-close solo" onClick={() => onClose(false)} aria-label="닫기">✕</button>
        <p style={{ margin: "auto" }}>이 책에는 아직 쪽 그림이 없어요.</p>
      </div>
    );

  const shown = two && idx > 0 && idx < pages.length - 1 ? `${idx + 1}–${Math.min(idx + 2, pages.length)}` : `${idx + 1}`;
  return (
    <div className="bv">
      <div className="bv-head">
        <div><strong>{book.title}</strong>{book.by && <span>{book.by}</span>}</div>
        {music !== "none" && (
          <button className={`bv-music ${music}`} onClick={toggleMusic}>
            {music === "on" ? <>🎵 <span>{book.songName || "동요"}</span> · 🔇 노래 끄기</> : "▶ 🎵 노래 켜기"}
          </button>
        )}
        <button className="bv-close" onClick={close} aria-label="닫기">✕</button>
      </div>
      <div className="bv-stage pf-stage" ref={stage}>
        <div className="pf-host" ref={host} />
        <button className="bv-arrow left" onClick={prev} aria-label="이전 쪽" disabled={idx === 0}>‹</button>
        <button className="bv-arrow right" onClick={next} aria-label="다음 쪽">›</button>
      </div>
      <div className="bv-foot">
        <div className="bv-bar"><b style={{ width: `${((Math.min(idx + (two && idx > 0 ? 2 : 1), pages.length)) / pages.length) * 100}%` }} /></div>
        <span>{shown} / {pages.length}</span>
        {idx === 0 && <em className="bv-hint">👆 책장 모서리를 잡아 넘기거나, 옆으로 밀어 보세요</em>}
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
