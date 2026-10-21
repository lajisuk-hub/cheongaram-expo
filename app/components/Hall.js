"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Pano from "./Pano";
import { loadItems, addItem, CODE, ORG } from "../../lib/supabase";
import { groupReviews } from "../../lib/words";
import { renderBook, renderReview, BookViewer, ReviewForm, ReviewBubble, BookShelf } from "./Books";
import Guide from "./Guide";
import { Ticker } from "./TopBar";

// 전시장: 교실 사진 위에 그림책과 소감이 둥둥. 책을 누르면 넘겨 보며 그 책의 동요가 흘러나온다.
export default function Hall() {
  const code = CODE;
  const pano = useRef(null);
  const [books, setBooks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [shelf, setShelf] = useState(false);
  const [mine, setMine] = useState(null);
  const [picked, setPicked] = useState(null); // {kind, item}
  const [guide, setGuide] = useState(false);
  const [small, setSmall] = useState(false);
  const sinceB = useRef(null), sinceR = useRef(null);

  // 사용법 팝업: 이 브라우저에서 처음 열 때 한 번 (❓ 단추로 다시)
  useEffect(() => {
    try { const k = "ca-guide"; if (!sessionStorage.getItem(k)) { setGuide(true); sessionStorage.setItem(k, "1"); } } catch { setGuide(true); }
  }, []);
  useEffect(() => {
    const on = () => setSmall(window.innerWidth < 700);
    on(); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on);
  }, []);

  // 처음 전부, 그 뒤 새 것만 8초마다
  const merge = useCallback((setter, sinceRef) => (rows) => {
    if (!rows.length) return;
    for (const r of rows) if (!sinceRef.current || r.at > sinceRef.current) sinceRef.current = r.at;
    setter((prev) => { const by = new Map(prev.map((r) => [r.id, r])); for (const r of rows) by.set(r.id, r); return [...by.values()]; });
  }, []);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const [b, r] = await Promise.all([loadItems("b", code, sinceB.current), loadItems("r", code, sinceR.current)]);
        if (stop) return;
        merge(setBooks, sinceB)(b); merge(setReviews, sinceR)(r);
      } catch {}
    };
    tick(); const id = setInterval(tick, 8000);
    return () => { stop = true; clearInterval(id); };
  }, [code, merge]);

  const nWorks = books.length + Math.min(40, reviews.length);
  const size = small ? (nWorks > 30 ? 80 : 96) : nWorks > 40 ? 110 : 135;
  const shownBooks = useMemo(() => books.filter((b) => !b.hidden).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id < b.id ? -1 : 1)), [books]);
  const groups = useMemo(() => groupReviews(reviews.filter((r) => !r.hidden && r.text)), [reviews]);
  const bookOf = (id) => books.find((b) => b.id === id);
  const counts = useMemo(() => { const c = {}; for (const r of reviews) if (!r.hidden && r.bookId) c[r.bookId] = (c[r.bookId] || 0) + 1; return c; }, [reviews]);
  const items = useMemo(() => [
    ...shownBooks.map((b) => {
      // 표지 모양(정사각·세로·가로)대로 띄워 표지가 잘리지 않게 (예전 책은 세로 3:4)
      const r = Math.min(1.4, Math.max(0.6, b.coverRatio || 0.72));
      const w = Math.round(size * (r >= 1 ? 1.3 : 1.05));
      return { ...b, kind: "b", w, h: Math.round(w / r + 22) };
    }),
    ...groups.slice(0, 40).map((g) => ({ ...g, id: `rv-${g.key}`, kind: "r", auto: true })),
  ], [shownBooks, groups, size]);

  const onPick = (p) => setPicked({ kind: p.kind, item: p });
  const openBook = (b) => { setShelf(false); setPicked({ kind: "b", item: b }); };
  // 소감 저장 → 바로 전시장에 떠오르게 (다른 사람 화면엔 8초 안에)
  const addReview = async (text, bookId) => {
    const r = await addItem("r", code, { text, bookId: bookId || "" });
    setReviews((prev) => [...prev, r]);
    const id = `rv-${groupReviews([r])[0]?.key}`;
    setMine(id);
    setTimeout(() => pano.current?.goTo(id), 300); // 내가 남긴 소감 쪽으로 화면을 옮겨 보여 준다
    setTimeout(() => setMine(null), 6000);
  };

  return (
    <main className="lobby-pano">
      <Pano
        ref={pano}
        items={items}
        size={size}
        speed={26}
        paused={!!picked || guide || shelf}
        mineId={mine}
        onPick={onPick}
        render={(p) => (p.kind === "b" ? renderBook(p) : renderReview(p))}
      />
      <header className="top">
        <span className="org">{ORG}</span>
        <h1>그림책 전시회</h1>
        <p>떠다니는 그림책을 누르면 책이 열리고 동요가 흘러나와요 🎵</p>
      </header>
      {shownBooks.length > 0 && <div className="count">그림책 {shownBooks.length}권 · 소감 {groups.reduce((a, g) => a + g.count, 0)}개</div>}
      <nav className="chtabs one">
        <button style={{ "--c": "#2f9e57" }} onClick={() => setShelf(true)}>
          <span className="tab-emoji">📚</span>
          <b>그림책 모아 보기</b>
          <small>보고 싶은 책을 골라 열어요</small>
        </button>
      </nav>
      <a className="backlink" href="/">← 처음으로</a>
      <button className="helplink" onClick={() => setGuide(true)}>❓ 사용법</button>
      <Ticker />
      {guide && <Guide onClose={() => setGuide(false)} />}
      {picked?.kind === "b" && (
        <BookViewer book={picked.item} onClose={(want) => setPicked(want ? { kind: "rf", item: picked.item } : null)} />
      )}
      {picked?.kind === "rf" && (
        <ReviewForm
          book={picked.item}
          popular={groups.slice(0, 4).map((g) => g.text)}
          onCancel={() => setPicked(null)}
          onSubmit={async (t) => { await addReview(t, picked.item.id); setPicked(null); }}
        />
      )}
      {picked?.kind === "r" && (
        <ReviewBubble
          group={picked.item}
          book={bookOf(picked.item.bookId)}
          onSame={() => addReview(picked.item.text, picked.item.bookId)}
          onOpenBook={() => openBook(bookOf(picked.item.bookId))}
          onClose={() => setPicked(null)}
        />
      )}
      {shelf && <BookShelf books={shownBooks} counts={counts} onOpen={openBook} onClose={() => setShelf(false)} />}
    </main>
  );
}
