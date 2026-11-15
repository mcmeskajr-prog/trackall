import { describe, it, expect } from "vitest";
import { pickMatch, mergeBookExtras } from "./books";

describe("pickMatch", () => {
  const rs = [
    { title: "Dune Messiah", authors: ["Frank Herbert"] },
    { title: "Dune", authors: ["Frank Herbert"] },
    { title: "Dune", authors: ["Outro Autor"] },
  ];
  it("escolhe o título igual e o autor certo", () => {
    expect(pickMatch(rs, "Dune", "Frank Herbert")).toBe(rs[1]);
  });
  it("não aceita autor diferente", () => {
    expect(pickMatch([rs[2]], "Dune", "Frank Herbert")).toBeNull();
  });
  it("não confunde títulos curtos parecidos", () => {
    expect(pickMatch([{ title: "It Ends With Us", authors: [] }], "It", "")).toBeNull();
  });
  it("sem resultados dá null", () => {
    expect(pickMatch(null, "Dune", "")).toBeNull();
    expect(pickMatch([], "Dune", "")).toBeNull();
  });
});

describe("mergeBookExtras", () => {
  it("usa a sinopse mais longa e a nota do Hardcover (0-10)", () => {
    const g = { synopsis: "curta", genres: ["Fiction"], score: 4 };
    const m = mergeBookExtras(g, { description: "uma sinopse bem mais comprida", subjects: ["fiction", "Desert"] }, { rating: 8.6, series: ["Dune"], description: "média sinopse" });
    expect(m.synopsis).toBe("uma sinopse bem mais comprida");
    expect(m.score).toBe(8.6);
    expect(m.series).toBe("Dune");
    expect(m.genres).toEqual(["Fiction", "Desert"]);
  });
  it("converte a nota do Google de 0-5 para 0-10 quando é a única", () => {
    expect(mergeBookExtras({ score: 4 }, null, null).score).toBe(8);
  });
  it("sem nenhuma fonte extra mantém o que o Google deu", () => {
    const m = mergeBookExtras({ synopsis: "x", genres: ["A"], pages: 300 }, null, null);
    expect(m.synopsis).toBe("x");
    expect(m.pages).toBe(300);
    expect(m.score).toBeNull();
  });
});
