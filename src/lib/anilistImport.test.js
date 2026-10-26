import { describe, it, expect } from "vitest";
import { toAppRating, fuzzyDateToMs, mapAniListEntry, mapAniListLists } from "./anilistImport";

const media = (id, type = "ANIME") => ({ id, type, title: { romaji: "Romaji " + id, english: null, native: "ネイティブ" }, coverImage: { large: "c.jpg" }, startDate: { year: 2020 }, genres: ["A", "B", "C", "D", "E"], episodes: 12, description: "<b>Olá</b> mundo", averageScore: 84 });

describe("toAppRating", () => {
  it("arredonda para meias estrelas", () => {
    expect(toAppRating(8.3)).toBe(8.5);
    expect(toAppRating(7.2)).toBe(7);
    expect(toAppRating(10)).toBe(10);
  });
  it("sem nota (0 / null) → 0", () => {
    expect(toAppRating(0)).toBe(0);
    expect(toAppRating(null)).toBe(0);
    expect(toAppRating(undefined)).toBe(0);
  });
});

describe("fuzzyDateToMs", () => {
  it("data completa → timestamp", () => {
    const d = new Date(fuzzyDateToMs({ year: 2024, month: 3, day: 12 }));
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 2, 12]);
  });
  it("data parcial ou vazia → null (conta como sem data)", () => {
    expect(fuzzyDateToMs({ year: 2024, month: null, day: null })).toBeNull();
    expect(fuzzyDateToMs({})).toBeNull();
    expect(fuzzyDateToMs(null)).toBeNull();
  });
});

describe("mapAniListEntry", () => {
  const e = { status: "COMPLETED", score: 8.5, completedAt: { year: 2024, month: 3, day: 12 }, media: media(5) };
  it("usa o mesmo id da pesquisa (al-anime-N)", () => {
    expect(mapAniListEntry(e).id).toBe("al-anime-5");
    expect(mapAniListEntry({ ...e, media: media(7, "MANGA") }).id).toBe("al-manga-7");
  });
  it("estado, nota, tipo e data de conclusão", () => {
    const it = mapAniListEntry(e);
    expect(it).toMatchObject({ userStatus: "completo", userRating: 8.5, type: "anime" });
    expect(typeof it.addedAt).toBe("number");
  });
  it("sem data de conclusão → sem addedAt (fica fora do Diário)", () => {
    const it = mapAniListEntry({ ...e, completedAt: { year: null, month: null, day: null } });
    expect("addedAt" in it).toBe(false);
  });
  it("a data só conta nos completos", () => {
    expect("addedAt" in mapAniListEntry({ ...e, status: "CURRENT" })).toBe(false);
  });
  it("mapeia todos os estados", () => {
    const st = (s) => mapAniListEntry({ ...e, status: s }).userStatus;
    expect([st("CURRENT"), st("REPEATING"), st("PAUSED"), st("DROPPED"), st("PLANNING")]).toEqual(["assistindo", "assistindo", "pausado", "dropado", "planejado"]);
  });
  it("limpa a sinopse, limita géneros e prefere o título inglês", () => {
    const it = mapAniListEntry({ ...e, media: { ...media(1), title: { english: "English", romaji: "R" } } });
    expect(it.title).toBe("English");
    expect(it.synopsis).toBe("Olá mundo");
    expect(it.genres).toHaveLength(4);
  });
  it("entrada sem media → null", () => {
    expect(mapAniListEntry({ status: "COMPLETED" })).toBeNull();
    expect(mapAniListEntry(null)).toBeNull();
  });
});

describe("mapAniListLists", () => {
  it("ignora listas personalizadas e não repete itens", () => {
    const a = { status: "COMPLETED", score: 9, media: media(1) };
    const lists = [{ isCustomList: false, entries: [a, a] }, { isCustomList: true, entries: [a, { ...a, media: media(2) }] }, { isCustomList: false, entries: [{ ...a, media: media(3) }] }];
    expect(mapAniListLists(lists).map(i => i.id)).toEqual(["al-anime-1", "al-anime-3"]);
  });
  it("aceita vazio / indefinido", () => {
    expect(mapAniListLists(undefined)).toEqual([]);
  });
});
