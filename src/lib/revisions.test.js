import { describe, it, expect } from "vitest";
import { addRevision, revisionsOf, expandDiary, dayStamp, removeRevision } from "./revisions";

describe("revisões («Completar outra vez»)", () => {
  const base = { id: "al-anime-1", title: "Frieren", userStatus: "completo", userRating: 9, addedAt: 1000 };
  it("acrescenta uma revisão sem tocar na entrada original", () => {
    const r = addRevision(base, { at: 5000, rating: 10 });
    expect(r.addedAt).toBe(1000);
    expect(r.userRating).toBe(10);
    expect(revisionsOf(r)).toEqual([{ at: 5000, rating: 10 }]);
  });
  it("sem nota nova mantém a nota atual", () => {
    const r = addRevision(base, { at: 5000 });
    expect(r.userRating).toBe(9);
    expect(revisionsOf(r)).toEqual([{ at: 5000, rating: 0 }]);
  });
  it("ignora revisões inválidas e ordena", () => {
    const it2 = { ...base, revisions: [{ at: 9000 }, { at: "x" }, null, { at: 3000, rating: 8 }] };
    expect(revisionsOf(it2).map(x => x.at)).toEqual([3000, 9000]);
  });
  it("o Diário ganha uma linha por revisão, mais recente primeiro", () => {
    const r = addRevision(base, { at: 5000, rating: 10 });
    const d = expandDiary([r, { id: "x", userStatus: "assistindo", addedAt: 99999 }]);
    expect(d.map(x => x._revision)).toEqual([2, 1]);
    expect(d[0].userRating).toBe(10);
    expect(new Set(d.map(x => x._k)).size).toBe(2);
  });
  it("completo sem data não entra no Diário (e as revisões sim)", () => {
    const r = addRevision({ ...base, addedAt: undefined }, { at: 7000 });
    expect(expandDiary([r]).map(x => x._revision)).toEqual([2]);
  });
  it("dayStamp usa o meio-dia local", () => {
    expect(new Date(dayStamp(2026, 10, 1)).getHours()).toBe(12);
  });
});

describe("removeRevision", () => {
  it("remove só a revisão pedida e mantém o item", () => {
    let it = { id: "a", userStatus: "completo", addedAt: 100 };
    it = addRevision(it, { at: 200 }); it = addRevision(it, { at: 300 });
    const out = removeRevision(it, 0);
    expect(out.userStatus).toBe("completo");
    expect(out.addedAt).toBe(100);
    expect(revisionsOf(out).map(r => r.at)).toEqual([300]);
  });
  it("índice inválido não altera nada", () => {
    const it = addRevision({ id: "a", userStatus: "completo", addedAt: 1 }, { at: 2 });
    expect(removeRevision(it, 5)).toBe(it);
  });
});
