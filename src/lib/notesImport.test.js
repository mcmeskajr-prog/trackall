import { describe, it, expect } from "vitest";
import { parseNotes, parseRating, similarity, pickMatch, resolveNotes, toLibraryItem, norm } from "./notesImport";

describe("parseRating", () => {
  it("formatos comuns", () => {
    expect(parseRating("9")).toBe(9);
    expect(parseRating("8,5")).toBe(8.5);
    expect(parseRating("9/10")).toBe(9);
    expect(parseRating("4/5")).toBe(8);
    expect(parseRating("★9")).toBe(9);
    expect(parseRating("85/100")).toBe(8.5);
  });
  it("não é nota", () => {
    expect(parseRating("completo")).toBeNull();
    expect(parseRating("15")).toBeNull();
    expect(parseRating("")).toBeNull();
  });
});

describe("parseNotes", () => {
  it("um título por linha, sem nota nem estado → planeado", () => {
    expect(parseNotes("Frieren\nDune")).toMatchObject([{ title: "Frieren", status: "planejado", rating: 0 }, { title: 'Dune' }]);
  });
  it("título - nota - estado", () => {
    const [e] = parseNotes("Sousou no Frieren - 9 - completo");
    expect(e).toMatchObject({ title: "Sousou no Frieren", rating: 9, status: "completo" });
  });
  it("ordem livre e inglês", () => {
    const [e] = parseNotes("Breaking Bad - watching - 10");
    expect(e).toMatchObject({ rating: 10, status: "assistindo" });
  });
  it("hífen dentro do título não parte (só ' - ' com espaços)", () => {
    expect(parseNotes("Spider-Man: Homecoming - 8")[0]).toMatchObject({ title: "Spider-Man: Homecoming", rating: 8 });
  });
  it("tipo e ano entre parênteses", () => {
    expect(parseNotes("Berserk (manga)")[0]).toMatchObject({ title: "Berserk", type: "manga" });
    expect(parseNotes("Dune (2021) - 9")[0]).toMatchObject({ title: "Dune", year: "2021", rating: 9 });
  });
  it("nota colada ao fim: 9/10 e ★", () => {
    expect(parseNotes("Elden Ring 10/10")[0]).toMatchObject({ title: "Elden Ring", rating: 10 });
    expect(parseNotes("Dune ★8")[0]).toMatchObject({ title: "Dune", rating: 8 });
  });
  it("tira marcadores e numeração", () => {
    const r = parseNotes("- Frieren\n* Dune\n1. Berserk\n2) Monster\n• Akira");
    expect(r.map(x => x.title)).toEqual(["Frieren", "Dune", "Berserk", "Monster", "Akira"]);
  });
  it("títulos que começam por número não são cortados", () => {
    expect(parseNotes("1917")[0].title).toBe("1917");
    expect(parseNotes("3 Idiots - 9")[0]).toMatchObject({ title: "3 Idiots", rating: 9 });
  });
  it("caixas [x] e [ ]", () => {
    const r = parseNotes("[x] Frieren\n[ ] Dune");
    expect([r[0].status, r[1].status]).toEqual(["completo", "planejado"]);
  });
  it("cabeçalhos de secção definem tipo e estado", () => {
    const r = parseNotes("Animes:\nFrieren\n# Manga\nBerserk\nCompletos:\nMonster");
    expect(r.map(x => [x.title, x.type, x.status])).toEqual([["Frieren", "anime", "planejado"], ["Berserk", "manga", "planejado"], ["Monster", "manga", "completo"]]);
  });
  it("ignora linhas vazias e dá o número da linha", () => {
    const r = parseNotes("\nFrieren\n\nDune");
    expect(r.map(x => x.line)).toEqual([2, 4]);
  });
  it("texto vazio → []", () => {
    expect(parseNotes("")).toEqual([]);
    expect(parseNotes(null)).toEqual([]);
  });
});

describe("similarity", () => {
  it("igual ignorando maiúsculas, acentos e pontuação", () => {
    expect(similarity("Amélie", "amelie")).toBe(1);
    expect(similarity("Steins;Gate", "Steins Gate")).toBe(1);
    expect(norm("The Dark Knight")).toBe("dark knight");
  });
  it("prefixo vale menos que igual, e bastante mais que nada", () => {
    expect(similarity("Frieren", "Frieren: Beyond Journey's End")).toBeGreaterThan(0.7);
    expect(similarity("Frieren", "Frieren: Beyond Journey's End")).toBeLessThan(1);
    expect(similarity("Frieren", "One Piece")).toBeLessThan(0.4);
  });
  it("tolera uma gralha", () => {
    expect(similarity("Jujutsu Kaisen", "Jujutsu Kaisen")).toBe(1);
    expect(similarity("Jujustu Kaisen", "Jujutsu Kaisen")).toBeGreaterThan(0.5);
  });
  it("vazio → 0", () => {
    expect(similarity("", "x")).toBe(0);
  });
});

describe("pickMatch", () => {
  const c = (id, title, type, year) => ({ id, title, type, year });
  it("um resultado exato e único → ok", () => {
    const r = pickMatch({ title: "Elden Ring" }, [c("g1", "Elden Ring", "jogos", "2022"), c("g2", "Elden Ring: Nightreign", "jogos", "2025")]);
    expect(r.state).toBe("ok");
    expect(r.chosen.id).toBe("g1");
  });
  it("vários exatos (ex: Berserk) → ask", () => {
    const r = pickMatch({ title: "Berserk" }, [c("m", "Berserk", "manga"), c("a1", "Berserk", "anime", "1997"), c("a2", "Berserk", "anime", "2016")]);
    expect(r.state).toBe("ask");
    expect(r.options).toHaveLength(3);
  });
  it("o ano resolve a ambiguidade", () => {
    const r = pickMatch({ title: "Berserk", year: "1997" }, [c("m", "Berserk", "manga", "1989"), c("a1", "Berserk", "anime", "1997"), c("a2", "Berserk", "anime", "2016")]);
    expect(r.state).toBe("ok");
    expect(r.chosen.id).toBe("a1");
  });
  it("título parcial → ask (não adivinha)", () => {
    expect(pickMatch({ title: "Frieren" }, [c("1", "Frieren: Beyond Journey's End", "anime")]).state).toBe("ask");
  });
  it("nada parecido → none", () => {
    expect(pickMatch({ title: "asdfgh hjkl" }, [c("1", "One Piece", "anime")]).state).toBe("none");
    expect(pickMatch({ title: "x" }, []).state).toBe("none");
    expect(pickMatch({ title: "x" }, null).state).toBe("none");
  });
  it("usa também o título em inglês", () => {
    const r = pickMatch({ title: "Frieren: Beyond Journey's End" }, [{ id: "1", title: "Sousou no Frieren", titleEn: "Frieren: Beyond Journey's End", type: "anime" }]);
    expect(r.state).toBe("ok");
  });
  it("não repete o mesmo id nas opções", () => {
    const r = pickMatch({ title: "Dune" }, [c("1", "Dune", "filmes"), c("1", "Dune", "filmes"), c("2", "Dune", "livros")]);
    expect(r.options.map(o => o.id)).toEqual(["1", "2"]);
  });
});

describe("resolveNotes", () => {
  const db = { anime: [{ id: "al-anime-1", title: "Frieren", type: "anime" }], manga: [], filmes: [{ id: "tmdb-1", title: "Dune", type: "filmes" }] };
  const search = async (q, t) => (db[t] || []).filter(x => x.title.toLowerCase().includes(q.toLowerCase()));
  it("procura só no tipo da linha, ou em todos se for auto", async () => {
    const calls = [];
    const s = async (q, t) => { calls.push(t); return search(q, t); };
    await resolveNotes(parseNotes("Berserk (manga)"), { search: s });
    expect(calls).toEqual(["manga"]);
    calls.length = 0;
    await resolveNotes(parseNotes("Dune"), { search: s });
    expect(calls.sort()).toEqual(["anime", "filmes", "jogos", "livros", "manga", "series"]);
  });
  it("devolve um resultado por linha, na mesma ordem", async () => {
    const out = await resolveNotes(parseNotes("Dune\nFrieren\nzzzz"), { search, concurrency: 3 });
    expect(out.map(r => r.state)).toEqual(["ok", "ok", "none"]);
    expect(out[0].entry.title).toBe("Dune");
  });
  it("uma pesquisa que falha não derruba as outras", async () => {
    const out = await resolveNotes(parseNotes("Dune"), { search: async (q, t) => { if (t === "anime") throw new Error("x"); return search(q, t); } });
    expect(out[0].state).toBe("ok");
  });
  it("reporta o progresso e pára quando pedido", async () => {
    const seen = [];
    await resolveNotes(parseNotes("Dune\nFrieren"), { search, concurrency: 1, onProgress: (d, n) => seen.push([d, n]) });
    expect(seen).toEqual([[1, 2], [2, 2]]);
    const out = await resolveNotes(parseNotes("Dune\nFrieren"), { search, concurrency: 1, shouldStop: () => true });
    expect(out).toEqual([]);
  });
});

describe("toLibraryItem", () => {
  it("junta o candidato com o estado e a nota das notas, sem data", () => {
    const [entry] = parseNotes("Dune - 9 - completo");
    const it = toLibraryItem({ entry, chosen: { id: "TMDB-Filmes 1", title: "Dune", type: "filmes" } });
    expect(it).toMatchObject({ id: "tmdb-filmes-1", userStatus: "completo", userRating: 9 });
    expect("addedAt" in it).toBe(false);
  });
});
