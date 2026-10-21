"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useReducer, forwardRef } from "react";

// 청아람어린이집 교실 파노라마 사진을 이어 붙인 전시장. 천천히 흐르고 손으로 밀 수 있다.
// items: [{id, anchor?:{img, fx, fy}, ...}] — anchor가 있으면 그 그림의 (fx,fy) 자리에, 없으면 파노라마 전체에 고르게 펼친다.
// render(item) → 작품 내용. onPick(item). 한 개의 rAF 루프가 배경과 작품을 직접 움직인다(React 재렌더 없음).
export const IMAGES = [
  { src: "/classroom.webp", ratio: 1944 / 809 },
];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const Pano = forwardRef(function Pano({ items, render, size, onPick, mineId, speed = 24, paused = false, startImg = 0, bob = 1, className = "" }, ref) {
  const els = useRef(new Map());
  const stripRef = useRef(null);
  const stageRef = useRef(null);
  const cam = useRef({ x: null, drag: null, moved: false, idleUntil: 0, target: null });
  const sizeRef = useRef({ w: 1200, h: 800 });
  const live = useRef({});

  // 화면 크기 (state 없이 ref로 — 리사이즈 때만 world 다시 계산하려고 아래 effect에서 강제 갱신)
  const [, force] = useReducerLike();
  useEffect(() => {
    const on = () => { sizeRef.current = { w: window.innerWidth, h: window.innerHeight }; force(); };
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const { w: SW, h: SH } = sizeRef.current;
  const world = useMemo(() => {
    const H = SH;
    const ov = Math.round(H * 0.16);
    let x = 0;
    const imgs = IMAGES.map((im) => { const w = Math.round(im.ratio * H); const it = { ...im, w, x }; x += w - ov; return it; });
    return { H, ov, W: x, imgs };
  }, [SH]);

  const small = SW < 700;
  const placed = useMemo(() => {
    const fixed = items.filter((i) => i.anchor);
    const free = items.filter((i) => !i.anchor).sort((a, b) => (a.id < b.id ? -1 : 1));
    const rowsMax = small ? 5 : 4;
    const rows = Math.max(1, Math.min(rowsMax, Math.ceil(free.length / IMAGES.length)));
    const top = 0.17, bottom = small ? 0.78 : 0.82;
    const cellH = ((bottom - top) * world.H) / rows;
    const out = fixed.map((e) => {
      const im = world.imgs[Math.min(IMAGES.length - 1, e.anchor.img || 0)];
      return { ...e, wx: im.x + e.anchor.fx * im.w, wy: e.anchor.fy * world.H, ph: (hash(e.id) % 628) / 100, sp: 0.6 };
    });
    // zone(그림 번호)이 있으면 그 그림 폭 안에서만, 없으면 파노라마 전체에 고르게 펼친다
    const groups = new Map();
    for (const e of free) { const z = e.zone == null ? "all" : e.zone; if (!groups.has(z)) groups.set(z, []); groups.get(z).push(e); }
    for (const [z, list] of groups) {
      const x0 = z === "all" ? 0 : world.imgs[z].x + world.ov * 0.5;
      const span = z === "all" ? world.W : world.imgs[z].w - world.ov;
      // 작품이 적어도 그림마다 하나씩은 보이게 열 수를 최소 그림 수로
      const k = Math.max(z === "all" ? IMAGES.length : 1, Math.ceil(list.length / rows));
      const cellW = span / k;
      list.forEach((e, i) => {
        const h = hash(e.id);
        const col = i % k, row = Math.floor(i / k) % rows; // 그림 1→2→3 번갈아 채워 어디서 봐도 작품이 보이게
        const jx = ((h % 1000) / 1000 - 0.5) * Math.min(cellW * 0.8, 700);
        const jy = (((h >> 10) % 1000) / 1000 - 0.5) * cellH * 0.5;
        const stagger = row % 2 ? Math.min(cellW / 2, 160) : 0;
        let wx = x0 + (col + 0.5) * cellW + stagger + jx;
        if (z !== "all") wx = Math.min(x0 + span - 40, Math.max(x0 + 40, wx));
        // 키 큰 것(동화책)도 제목·아래 단추를 가리지 않게 위아래 안쪽으로
        const half = (e.h || size || 100) / 2 + 8;
        const wy = Math.min(bottom * world.H - half, Math.max(top * world.H + half, top * world.H + (row + 0.5) * cellH + jy));
        out.push({ ...e, wx: ((wx % world.W) + world.W) % world.W, wy, ph: (h % 628) / 100, sp: 0.5 + ((h >> 5) % 50) / 100 });
      });
    }
    return out;
  }, [items, world, small, size]);

  live.current = { placed, world, size: sizeRef.current, paused, speed, bob };

  // 카메라 시작 위치: startImg 그림 가운데가 화면 가운데 오게
  useEffect(() => {
    const c = cam.current;
    if (c.x != null) return;
    const im = world.imgs[startImg] || world.imgs[0];
    c.x = Math.max(world.ov, im.x + im.w / 2 - sizeRef.current.w / 2);
  }, [world, startImg]);

  useEffect(() => {
    let raf = 0, last = performance.now();
    const c = cam.current;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { placed, world, size, paused, speed, bob } = live.current;
      const { W, ov } = world;
      if (c.x == null) c.x = ov;
      if (c.target != null) {
        const d = c.target - c.x; c.x += d * Math.min(1, dt * 4);
        if (Math.abs(d) < 1) c.target = null;
      } else if (!c.drag && now > c.idleUntil && !paused) c.x += speed * dt;
      if (c.x >= W + ov) c.x -= W;
      if (c.x < ov) c.x += W;
      if (stripRef.current) stripRef.current.style.transform = `translate3d(${-c.x}px,0,0)`;
      const t = now / 1000;
      for (const p of placed) {
        const el = els.current.get(p.id);
        if (!el) continue;
        let sx = p.wx - c.x;
        if (sx < -500) sx += W;
        if (sx > size.w + 500) sx -= W;
        const dx = Math.sin(t * p.sp + p.ph) * 12 * bob;
        const dy = Math.cos(t * p.sp * 0.8 + p.ph) * 10 * bob;
        const rot = p.anchor ? 0 : Math.sin(t * p.sp * 0.5 + p.ph) * 4;
        el.style.transform = `translate3d(${sx + dx}px,${p.wy + dy}px,0) translate(-50%,-50%) rotate(${rot}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 밖에서 쓰는 기능: 특정 작품/그림으로 카메라 옮기기
  useImperativeHandle(ref, () => ({
    goTo(id) {
      const p = live.current.placed.find((x) => x.id === id);
      if (!p) return false;
      panTo(p.wx);
      return true;
    },
    goImg(i) {
      const im = live.current.world.imgs[i];
      if (im) panTo(im.x + im.w / 2);
    },
  }));
  const panTo = (wx) => {
    const c = cam.current; const { W, ov } = live.current.world;
    let target = wx - live.current.size.w / 2;
    while (target - c.x > W / 2) target -= W;
    while (c.x - target > W / 2) target += W;
    c.target = Math.max(ov, target);
    c.idleUntil = performance.now() + 9000;
  };

  const onDown = (e) => { const c = cam.current; c.drag = { sx: e.clientX, cx: c.x }; c.moved = false; c.target = null; stageRef.current?.classList.add("grabbing"); };
  const onMove = (e) => { const c = cam.current; if (!c.drag) return; const dx = e.clientX - c.drag.sx; if (Math.abs(dx) > 6) c.moved = true; c.x = c.drag.cx - dx; };
  const onUp = () => { const c = cam.current; if (!c.drag) return; c.drag = null; c.idleUntil = performance.now() + 5000; stageRef.current?.classList.remove("grabbing"); };
  const onWheel = (e) => { const c = cam.current; c.x += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.8; c.idleUntil = performance.now() + 4000; };
  const pick = (p) => { if (cam.current.moved) return; onPick && onPick(p); };

  return (
    <div ref={stageRef} className={`stage grab ${className}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp} onWheel={onWheel}>
      <div className="strip" ref={stripRef} style={{ width: world.W * 2 + world.imgs[0].w }}>
        {[0, 1].map((copy) => world.imgs.map((im, i) => (
          <img key={`${copy}-${i}`} src={im.src} alt="" draggable={false} className={copy === 0 && i === 0 ? "" : "fade"} style={{ left: copy * world.W + im.x, width: im.w, "--ov": `${world.ov}px` }} />
        )))}
      </div>
      <div className="items">
        {placed.map((p) => (
          <button
            key={p.id}
            ref={(el) => (el ? els.current.set(p.id, el) : els.current.delete(p.id))}
            className={`it${p.id === mineId ? " mine launch" : ""}${p.anchor ? " anchor" : ""}`}
            style={p.anchor || p.auto ? undefined : { width: p.w || size, height: p.h || size }}
            onClick={() => pick(p)}
          >
            {render(p)}
          </button>
        ))}
      </div>
    </div>
  );
});
export default Pano;

// 아주 작은 강제 재렌더 훅
function useReducerLike() { return useReducer((x) => x + 1, 0); }
