import { useEffect, useState } from "react";
import { dayNumber, pickDiverse, SIX_MONTHS, THREE_MONTHS } from "./homeUtils";

// Guarda no aparelho o que já foi sugerido, para «Melhor para hoje» e «Esquecido na lista» não rodarem sempre nos mesmos títulos.
// A sugestão fica estável durante o dia; muda no dia seguinte ou quando o utilizador carrega em ↻.
const KEY = "trackall_home_picks";
const KEEP = 12;
const KEYS = ["today", "forgotten"];

function fresh(day) {
  const m = { day, history: { today: [], forgotten: [] } };
  KEYS.forEach((k) => { m[k + "Id"] = null; m[k + "Seen"] = []; m[k + "N"] = 0; });
  return m;
}
function load() {
  const day = dayNumber();
  let m = null;
  try { m = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { m = null; }
  if (!m || typeof m !== "object" || !m.history) return fresh(day);
  if (m.day !== day) {
    const n = fresh(day);
    KEYS.forEach((k) => {
      const past = [...(m[k + "Seen"] || []), m[k + "Id"]].filter((x) => x != null);
      n.history[k] = [...past, ...(m.history[k] || [])].slice(0, KEEP);
    });
    return n;
  }
  return m;
}
function save(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignorar */ } }

const isPlanned = (i) => i && (i.userStatus === "planejado" || i.userStatus === "planeado");

export function useHomePicks(items) {
  const [mem, setMem] = useState(load);
  const update = (fn) => setMem((prev) => { const next = fn(prev); save(next); return next; });

  const now = Date.now();
  const completed = items.filter((i) => i?.userStatus === "completo").sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 30);
  const gc = {};
  completed.forEach((i) => (i.genres || []).forEach((g) => { gc[g] = (gc[g] || 0) + 1; }));
  const planned = items.filter(isPlanned);
  const score = (i) => {
    const r = i.userRating > 0 ? i.userRating : (i.score || 0);
    const aff = (i.genres || []).reduce((s, g) => s + (gc[g] || 0), 0);
    const wait = Math.min(12, (now - (i.addedAt || now)) / (1000 * 60 * 60 * 24 * 30));
    return r + Math.min(aff, 10) * 0.6 + wait * 0.25;
  };
  const todayPool = [...planned].sort((a, b) => score(b) - score(a));
  let forgPool = planned.filter((i) => (now - (i.addedAt || now)) > SIX_MONTHS);
  if (!forgPool.length) forgPool = planned.filter((i) => (now - (i.addedAt || now)) > THREE_MONTHS);
  forgPool = [...forgPool].sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

  const choose = (k, pool, salt) => {
    const stored = mem[k + "Id"];
    const found = stored != null && pool.find((i) => i.id === stored);
    if (found) return found;
    const exclude = new Set([...(mem.history[k] || []), ...(mem[k + "Seen"] || [])]);
    return pickDiverse(pool, { seed: mem.day * 31 + salt + (mem[k + "N"] || 0) * 977, exclude });
  };
  const today = choose("today", todayPool, 1);
  const forgotten = choose("forgotten", forgPool, 2);

  useEffect(() => {
    if (today && mem.todayId !== today.id) update((m) => ({ ...m, todayId: today.id }));
    if (forgotten && mem.forgottenId !== forgotten.id) update((m) => ({ ...m, forgottenId: forgotten.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today?.id, forgotten?.id]);

  const reroll = (k) => update((m) => ({
    ...m,
    [k + "Id"]: null,
    [k + "Seen"]: [...(m[k + "Seen"] || []), m[k + "Id"]].filter((x) => x != null).slice(-KEEP),
    [k + "N"]: (m[k + "N"] || 0) + 1,
  }));

  return { today, forgotten, rerollToday: () => reroll("today"), rerollForgotten: () => reroll("forgotten"), day: mem.day, seed: mem.day };
}
