import { createClient } from "@supabase/supabase-js";

// 수성구·한글날 전시관과 같은 Supabase 프로젝트·같은 표·같은 버킷을 씁니다. (publishable key는 공개용)
const SUPABASE_URL = "https://pgywpdodatjfpivxmymn.supabase.co";
const SUPABASE_KEY = "sb_publishable_FeO3LdfFBB6KEwblcZPa2w_sW9dVuUg";

// 청아람어린이집 한 곳만 쓰는 전시회 — 줄 이름이 ca- 로 시작해 다른 전시회(ex-, eb-)와 섞이지 않는다.
//  - ca-space-main            : 전시회(관리 비밀번호)
//  - ca-b-main-<시각>-<난수>  : 그림책 한 권 (title, by, pages[], cover, spread, order, song, songName, hidden)
//  - ca-r-main-<시각>-<난수>  : 그림책 소감 한 마디 (text, bookId, hidden)
export const TABLE = "suseong_hub_content";
export const BUCKET = "suseong-hub";
export const CODE = "main";
export const ORG = "청아람어린이집";
export const SLOGAN = "놀면서 배우고 사랑으로 자라는";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const spaceId = (code) => `ca-space-${code}`;
const prefix = (kind, code) => `ca-${kind}-${code}-`;

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── 전시회 ───────────────────────────────────────
export async function loadSpace(code = CODE) {
  const { data, error } = await supabase.from(TABLE).select("data,updated_at").eq("id", spaceId(code)).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { code, ...data.data } : null;
}
export async function saveSpace(code, data) {
  const { error } = await supabase.from(TABLE).update({ data, updated_at: new Date().toISOString() }).eq("id", spaceId(code));
  if (error) throw new Error(error.message);
}

// ── 그림책 b / 소감 r ─────────────────────────────
const toItem = (row) => ({ id: row.id, ...(row.data || {}), hidden: !!row.data?.hidden, at: row.updated_at });

// since 이후에 생기거나 바뀐 것만. PostgREST는 1000줄씩만 주므로 끝까지 나눠 읽는다.
export async function loadItems(kind, code, since) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(TABLE).select("id,data,updated_at").like("id", `${prefix(kind, code)}%`).order("updated_at", { ascending: true }).range(from, from + 999);
    if (since) q = q.gt("updated_at", since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all.map(toItem);
}
export async function addItem(kind, code, data) {
  const id = `${prefix(kind, code)}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from(TABLE).insert({ id, data: { ...data, hidden: false } });
  if (error) throw new Error(error.message);
  return { id, ...data, hidden: false, at: new Date().toISOString() };
}
export async function setItemHidden(item, hidden) {
  const { id, at, ...data } = item;
  const { error } = await supabase.from(TABLE).update({ data: { ...data, hidden }, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

// 책 제목·동요 바꾸기 등 내용 바꾸기
export async function updateItem(item, patch) {
  const { id, at, ...data } = item;
  const next = { ...data, ...patch };
  const { error } = await supabase.from(TABLE).update({ data: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ...item, ...patch };
}

// ── 그림책 쪽 그림 올리기 (같은 이름 덮어쓰기가 안 되므로 올릴 때마다 새 폴더) ──
export async function uploadBookPage(code, folder, index, blob) {
  const name = `expo-cheongaram/${code}/book/${folder}/p${String(index + 1).padStart(3, "0")}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(name, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
}

// ── 동요 음원 올리기 (mp3·m4a·wav 등) ──────────────
export async function uploadSong(code, file) {
  const ext = (file.name.match(/[.]([a-z0-9]{2,4})$/i)?.[1] || "mp3").toLowerCase();
  const type = file.type || (ext === "m4a" ? "audio/mp4" : ext === "wav" ? "audio/wav" : "audio/mpeg");
  const name = `expo-cheongaram/${code}/song/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(name, file, { contentType: type, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
}
