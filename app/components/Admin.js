"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { loadSpace, loadItems, setItemHidden, sha256, addItem, updateItem, uploadBookPage, uploadSong, CODE, ORG } from "../../lib/supabase";

// 그림책 파일(PDF 한 개, 또는 쪽 그림 여러 장)을 쪽마다 JPG로 바꿔 보관소에 올린다.
async function toJpeg(canvas) { return new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.86)); }
async function filesToPages(code, files, onProgress) {
  const folder = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const urls = []; let ratio = 0.75;
  const pdf = files.find((f) => /pdf$/i.test(f.type) || /[.]pdf$/i.test(f.name));
  if (pdf) {
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: await pdf.arrayBuffer() }).promise;
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress(`${i} / ${doc.numPages}쪽 올리는 중…`);
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      if (i === 2 || doc.numPages === 1) ratio = base.width / base.height;
      const vp = page.getViewport({ scale: 1400 / Math.max(base.width, base.height) });
      const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp, intent: "print" }).promise; // print: 탭이 가려져도 안 멈춤
      urls.push(await uploadBookPage(code, folder, i - 1, await toJpeg(c)));
    }
  } else {
    const imgs = files.filter((f) => /^image[/]/.test(f.type)).sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
    for (let i = 0; i < imgs.length; i++) {
      onProgress(`${i + 1} / ${imgs.length}장 올리는 중…`);
      const bmp = await createImageBitmap(imgs[i]);
      const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
      if (i === Math.min(1, imgs.length - 1)) ratio = bmp.width / bmp.height;
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
      urls.push(await uploadBookPage(code, folder, i, await toJpeg(c)));
    }
  }
  // 쪽 그림 한 장이 이미 두 쪽 펼침(가로가 훨씬 긴 것)이면 넘겨 볼 때 한 장씩
  return { urls, spread: ratio > 1.3 };
}

const isAudio = (f) => f && (/^audio[/]/.test(f.type) || /[.](mp3|m4a|wav|aac|ogg)$/i.test(f.name));
const songTitle = (f) => f.name.replace(/[.][^.]+$/, "").slice(0, 40);

export default function Admin() {
  const code = CODE;
  const [space, setSpace] = useState(undefined);
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [books, setBooks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [bTitle, setBTitle] = useState("");
  const [bBy, setBBy] = useState("");
  const [bFiles, setBFiles] = useState([]);
  const [bSong, setBSong] = useState(null);
  const [bMsg, setBMsg] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [playing, setPlaying] = useState(null); // 미리 듣는 책 id
  const player = useRef(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    loadSpace(code).then((s) => {
      setSpace(s);
      if (s) { try { if (sessionStorage.getItem("ca-admin") === s.pinHash) setOk(true); } catch {} }
    }).catch(() => setSpace(null));
    return () => player.current?.pause();
  }, [code]);
  useEffect(() => {
    if (!ok || !origin) return;
    QRCode.toDataURL(`${origin}/`, { width: 400, margin: 1, color: { dark: "#2c4a2f" } }).then(setQr).catch(() => {});
    refresh();
  }, [ok, origin]);

  const refresh = async () => {
    try {
      const [b, r] = await Promise.all([loadItems("b", code), loadItems("r", code)]).then((l) => l.map((x) => x.filter((i) => !i.test))); // 제작 때 시험으로 올린 것은 빼고

      setBooks(b.sort((x, y) => (x.order ?? 0) - (y.order ?? 0) || (x.id < y.id ? -1 : 1)));
      setReviews(r.sort((x, y) => (x.id < y.id ? 1 : -1)));
    } catch (e) { setMsg("목록을 못 불러왔어요: " + (e.message || e)); }
  };
  const login = async () => {
    setErr("");
    const h = await sha256(pin);
    if (h !== space.pinHash) return setErr("비밀번호가 달라요.");
    try { sessionStorage.setItem("ca-admin", h); } catch {}
    setOk(true);
  };
  const toggle = async (kind, it) => {
    try {
      await setItemHidden(it, !it.hidden);
      const upd = (list) => list.map((x) => (x.id === it.id ? { ...x, hidden: !it.hidden } : x));
      if (kind === "b") setBooks(upd); else setReviews(upd);
    } catch (e) { setMsg("바꾸지 못했어요: " + (e.message || e)); }
  };
  const addBook = async () => {
    if (!bTitle.trim()) return setBMsg("책 제목을 적어 주세요.");
    if (!bFiles.length) return setBMsg("그림책 PDF 파일(또는 쪽 그림)을 골라 주세요.");
    if (bSong && !isAudio(bSong)) return setBMsg("동요 파일은 mp3·m4a·wav 같은 소리 파일이어야 해요.");
    setBusy(true); setBMsg("파일을 읽는 중…");
    try {
      const { urls, spread } = await filesToPages(code, bFiles, setBMsg);
      if (!urls.length) throw new Error("쪽을 하나도 못 읽었어요. PDF나 JPG·PNG 그림인지 확인해 주세요.");
      let song = "", songName = "";
      if (bSong) { setBMsg("동요를 올리는 중…"); song = await uploadSong(code, bSong); songName = songTitle(bSong); }
      const order = books.length ? Math.max(...books.map((b) => b.order ?? 0)) + 1 : 0;
      const b = await addItem("b", code, { title: bTitle.trim().slice(0, 40), by: bBy.trim().slice(0, 40), pages: urls, cover: urls[0], spread, order, song, songName });
      setBooks((prev) => [...prev, b]);
      setBTitle(""); setBBy(""); setBFiles([]); setBSong(null); setFileKey((k) => k + 1);
      setBMsg(`『${b.title}』 ${urls.length}쪽${song ? " + 동요" : ""}를 전시했어요 ✅ 전시장에 바로 떠다녀요.`);
    } catch (e) { setBMsg("올리지 못했어요: " + (e.message || e)); } finally { setBusy(false); }
  };
  const editBook = async (b, patch, done = "바꿨어요.") => {
    try { const nb = await updateItem(b, patch); setBooks((prev) => prev.map((x) => (x.id === b.id ? nb : x))); setMsg(done); }
    catch (e) { setMsg("바꾸지 못했어요: " + (e.message || e)); }
  };
  const changeSong = async (b, file) => {
    if (!file) return;
    if (!isAudio(file)) return setMsg("동요 파일은 mp3·m4a·wav 같은 소리 파일이어야 해요.");
    setBusy(true); setMsg(`『${b.title}』 동요를 올리는 중…`);
    try { const song = await uploadSong(code, file); await editBook(b, { song, songName: songTitle(file) }, `『${b.title}』 동요를 바꿨어요 🎵`); }
    catch (e) { setMsg("동요를 올리지 못했어요: " + (e.message || e)); } finally { setBusy(false); }
  };
  const listen = (b) => {
    player.current?.pause();
    if (playing === b.id) return setPlaying(null);
    const a = new Audio(b.song); player.current = a;
    a.onended = () => setPlaying(null);
    a.play().then(() => setPlaying(b.id)).catch(() => setMsg("소리를 틀지 못했어요."));
  };
  const moveBook = async (i, d) => {
    const j = i + d; if (j < 0 || j >= books.length) return;
    const next = [...books]; [next[i], next[j]] = [next[j], next[i]];
    setBooks(next.map((b, k) => ({ ...b, order: k })));
    try { await Promise.all(next.map((b, k) => (b.order === k ? null : updateItem(b, { order: k })))); } catch (e) { setMsg("순서를 저장하지 못했어요: " + (e.message || e)); }
  };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); setMsg("주소를 복사했어요."); } catch { prompt("복사하세요", t); } };

  if (space === undefined) return <main className="page"><div className="card">여는 중…</div></main>;
  if (!space) return <main className="page"><div className="card"><h2>전시회 정보를 읽지 못했어요</h2><p className="sub">잠시 뒤 새로고침해 주세요.</p></div></main>;
  if (!ok)
    return (
      <main className="page">
        <div className="card">
          <h2>🔐 {ORG} 그림책 전시회 관리</h2>
          <p className="sub">관리 비밀번호를 넣어 주세요.</p>
          <input className="inp" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="비밀번호" />
          {err && <div className="err">{err}</div>}
          <div style={{ height: 12 }} />
          <button className="btn" onClick={login}>들어가기</button>
        </div>
      </main>
    );

  const links = [
    ["학부모 링크 (전시회 입구)", `${origin}/`],
    ["전시장 바로가기", `${origin}/hall`],
    ["관리 화면 (이 화면, 학부모님께 공유하지 마세요)", `${origin}/admin`],
  ];
  return (
    <main className="page">
      <div className="hero"><h1>{ORG} 그림책 전시회 관리</h1><p>그림책과 동요를 올리고, 소감을 살펴봐요.</p></div>
      {msg && <div className="toast" onClick={() => setMsg("")}>{msg}</div>}

      <div className="card">
        <h2>1. 그림책 + 동요 올리기 ({books.filter((b) => !b.hidden).length}권 전시 중)</h2>
        <p className="sub">그림책 PDF를 올리면 쪽마다 그림으로 바뀌어 전시장에 떠다녀요. <b>동요 파일(mp3 등)을 함께 고르면, 학부모님이 그 책을 열 때 동요가 자동으로 흘러나와요.</b> (PDF가 없으면 쪽 사진 JPG·PNG 여러 장을 한꺼번에 골라도 돼요 — 파일 이름 순서대로 넘어가요)</p>
        <label className="f">책 제목</label>
        <input className="inp" value={bTitle} onChange={(e) => setBTitle(e.target.value)} maxLength={40} placeholder="예) 우리 가족 이야기" />
        <label className="f">지은이 · 반 (선택)</label>
        <input className="inp" value={bBy} onChange={(e) => setBBy(e.target.value)} maxLength={40} placeholder="예) 햇님반 김하늘" />
        <label className="f">📖 그림책 파일 (PDF 또는 쪽 그림)</label>
        <input key={`f${fileKey}`} className="inp" type="file" accept="application/pdf,.pdf,image/*" multiple onChange={(e) => setBFiles([...e.target.files])} />
        {bFiles.length > 0 && <p className="sub" style={{ marginTop: 4 }}>고른 파일: {bFiles.length === 1 ? bFiles[0].name : `${bFiles.length}개`}</p>}
        <label className="f">🎵 동요 파일 (선택 · mp3, m4a, wav)</label>
        <input key={`s${fileKey}`} className="inp" type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" onChange={(e) => setBSong(e.target.files[0] || null)} />
        {bSong && <p className="sub" style={{ marginTop: 4 }}>고른 동요: {bSong.name}</p>}
        {bMsg && <div className="sub" style={{ color: "#2f7a45", fontWeight: 700 }}>{bMsg}</div>}
        <button className="btn" onClick={addBook} disabled={busy} style={{ marginTop: 8 }}>{busy ? "올리는 중… (창을 닫지 마세요)" : "📚 그림책 전시하기"}</button>
      </div>

      <div className="card">
        <h2>2. 전시 중인 그림책</h2>
        <p className="sub">◀ ▶로 순서를 바꾸고, 「동요 넣기·바꾸기」로 노래를 넣거나 바꿀 수 있어요.</p>
        <div className="thumbs" style={{ marginTop: 10 }}>
          {books.map((b, i) => (
            <div key={b.id} className={`thumb${b.hidden ? " hidden-row" : ""}`}>
              {b.cover && <img src={b.cover} alt="" loading="lazy" style={{ objectFit: "contain", background: "#f4efe6" }} />}
              <div className="thumb-cap"><b>{b.title}</b><small>{(b.pages || []).length}쪽 · 소감 {reviews.filter((r) => r.bookId === b.id && !r.hidden).length}</small>
                <small className="song-cap">{b.song ? `🎵 ${b.songName || "동요"}` : "🔇 동요 없음"}</small></div>
              <div className="row">
                <button className="btn sm ghost" onClick={() => moveBook(i, -1)} disabled={i === 0}>◀</button>
                <button className="btn sm ghost" onClick={() => moveBook(i, 1)} disabled={i === books.length - 1}>▶</button>
              </div>
              {b.song && <button className="btn sm ghost" onClick={() => listen(b)}>{playing === b.id ? "■ 멈추기" : "▶ 동요 듣기"}</button>}
              <label className={`btn sm ghost filebtn${busy ? " off" : ""}`}>
                {b.song ? "동요 바꾸기" : "🎵 동요 넣기"}
                <input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" disabled={busy} onChange={(e) => { changeSong(b, e.target.files[0]); e.target.value = ""; }} />
              </label>
              {b.song && <button className="btn sm ghost" onClick={() => confirm(`『${b.title}』에서 동요를 뺄까요?`) && editBook(b, { song: "", songName: "" }, "동요를 뺐어요.")}>동요 빼기</button>}
              <button className="btn sm ghost" onClick={() => { const t = prompt("책 제목", b.title); if (t && t.trim()) editBook(b, { title: t.trim().slice(0, 40) }); }}>제목 고치기</button>
              <button className="btn sm ghost" onClick={() => toggle("b", b)}>{b.hidden ? "되살리기" : "숨기기"}</button>
            </div>
          ))}
          {!books.length && <p className="sub">아직 그림책이 없어요.</p>}
        </div>
      </div>

      <div className="card">
        <h2>3. 그림책 소감 ({reviews.filter((r) => !r.hidden).length}개 표시 중 / 전체 {reviews.length}개)</h2>
        <p className="sub">잘못 올라온 소감은 「숨기기」로 전시장에서 빼요.</p>
        <div className="row" style={{ marginBottom: 8 }}><button className="btn sm ghost" onClick={refresh}>새로고침</button></div>
        <table className="list">
          <thead><tr><th>소감</th><th>책</th><th>날짜</th><th></th></tr></thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className={r.hidden ? "hidden-row" : ""}>
                <td><b>{r.text}</b></td>
                <td>{books.find((b) => b.id === r.bookId)?.title || "-"}</td>
                <td>{new Date(r.at).toLocaleDateString("ko-KR")}</td>
                <td><button className="btn sm ghost" onClick={() => toggle("r", r)}>{r.hidden ? "되살리기" : "숨기기"}</button></td>
              </tr>
            ))}
            {!reviews.length && <tr><td colSpan={4} className="sub">아직 소감이 없어요.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>4. 주소와 QR</h2>
        {qr && <img className="qrbig" src={qr} alt="학부모 입장 QR" />}
        <p className="sub" style={{ textAlign: "center" }}>QR을 길게 눌러(또는 오른쪽 클릭) 저장해 안내문에 넣으세요.</p>
        {links.map(([label, url]) => (
          <div className="linkbox" key={url}>
            <b>{label}</b><code>{url}</code>
            <div className="row">
              <button className="btn sm" onClick={() => copy(url)}>주소 복사</button>
              <a className="btn sm ghost" href={url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>열어 보기</a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
