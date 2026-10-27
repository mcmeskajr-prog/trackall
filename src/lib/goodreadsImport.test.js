import { describe, it, expect } from "vitest";
import { parseCSV, cleanIsbn, cleanTitle, parseGoodreadsDate, statusFromShelf, parseGoodreads, resolveGoodreads, toLibraryItem } from "./goodreadsImport";

const HEAD = "Book Id,Title,Author,ISBN,ISBN13,My Rating,Date Read,Exclusive Shelf";
const csv = (...rows) => [HEAD, ...rows].join("\n");

describe("parseCSV", () => {
  it("aspas, vírgulas e quebras de linha dentro de campos", () => {
    const r = parseCSV('a,b\n"x, y","linha1\nlinha2"\n');
    expect(r).toEqual([["a", "b"], ["x, y", "linha1\nlinha2"]]);
  });
  it("aspas duplas escapadas e CRLF", () => {
    expect(parseCSV('a\r\n"diz ""olá"""\r\n')).toEqual([["a"], ['diz "olá"']]);
  });
  it("ignora BOM e linhas vazias", () => {
    expect(parseCSV("﻿a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("cleanIsbn / cleanTitle", () => {
  it("formato com igual e aspas do Goodreads", () => {
    expect(cleanIsbn('="9780441172719"')).toBe("9780441172719");
    expect(cleanIsbn('=""')).toBe("");
    expect(cleanIsbn("043942089X")).toBe("043942089X");
    expect(cleanIsbn("123")).toBe("");
  });
  it("tira a série do título", () => {
    expect(cleanTitle("Dune (Dune, #1)")).toBe("Dune");
    expect(cleanTitle("Harry Potter and the Sorcerer's Stone (Harry Potter, #1)")).toBe("Harry Potter and the Sorcerer's Stone");
    expect(cleanTitle("1984")).toBe("1984");
    expect(cleanTitle("Título (com parêntesis normal)")).toBe("Título (com parêntesis normal)");
  });
});

describe("datas e prateleiras", () => {
  it("data válida / vazia", () => {
    const d = new Date(parseGoodreadsDate("2023/05/14"));
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2023, 4, 14]);
    expect(parseGoodreadsDate("")).toBeNull();
    expect(parseGoodreadsDate("ontem")).toBeNull();
  });
  it("prateleiras", () => {
    expect(statusFromShelf("read")).toBe("completo");
    expect(statusFromShelf("currently-reading")).toBe("assistindo");
    expect(statusFromShelf("to-read")).toBe("planejado");
    expect(statusFromShelf("favoritos", 123)).toBe("completo");
    expect(statusFromShelf("favoritos", null)).toBe("planejado");
  });
});

describe("parseGoodreads", () => {
  it("lê livros, notas ×2, datas e estados", () => {
    const r = parseGoodreads(csv(
      '1,"Dune (Dune, #1)",Frank Herbert,="0441172717",="9780441172719",5,2023/05/14,read',
      '2,Neuromancer,William Gibson,="",="",0,,to-read',
      '3,Emma,Jane Austen,="",="",3,,currently-reading',
    ));
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ title: "Dune", author: "Frank Herbert", isbn: "9780441172719", rating: 10, status: "completo" });
    expect(r[0].readAt).toBeGreaterThan(0);
    expect(r[1]).toMatchObject({ rating: 0, status: "planejado", readAt: null, isbn: "" });
    expect(r[2]).toMatchObject({ rating: 6, status: "assistindo", readAt: null });
  });
  it("data de leitura só conta em 'completo'", () => {
    const r = parseGoodreads(csv('1,A,B,="",="",4,2020/01/01,to-read'));
    expect(r[0].readAt).toBeNull();
  });
  it("ficheiro que não é do Goodreads → []", () => {
    expect(parseGoodreads("Name,Year\nX,2020")).toEqual([]);
    expect(parseGoodreads("")).toEqual([]);
  });
});

describe("resolveGoodreads", () => {
  const entries = [
    { line: 2, title: "Dune", author: "Frank Herbert", isbn: "9780441172719", rating: 10, status: "completo", readAt: 1 },
    { line: 3, title: "Neuromancer", author: "William Gibson", isbn: "", rating: 0, status: "planejado", readAt: null },
    { line: 4, title: "Livro Que Não Existe", author: "X", isbn: "", rating: 0, status: "planejado", readAt: null },
  ];
  const search = async (q) => {
    if (q.startsWith("isbn:")) return [{ id: "gb-dune", title: "Dune", cover: "c" }];
    if (q.startsWith("Neuromancer")) return [{ id: "gb-neu", title: "Neuromancer" }, { id: "gb-x", title: "Count Zero" }];
    return [];
  };
  it("ISBN → ligado; título → ligado; sem nada → none", async () => {
    const r = await resolveGoodreads(entries, { search });
    expect(r[0]).toMatchObject({ state: "ok", by: "isbn" });
    expect(r[0].chosen.id).toBe("gb-dune");
    expect(r[1]).toMatchObject({ state: "ok", by: "titulo" });
    expect(r[1].chosen.id).toBe("gb-neu");
    expect(r[2].state).toBe("none");
  });
  it("ISBN que devolve outro livro é ignorado (cai para o título)", async () => {
    const s = async (q) => (q.startsWith("isbn:") ? [{ id: "gb-lixo", title: "Cozinha Vegetariana" }] : [{ id: "gb-dune", title: "Dune" }]);
    const r = await resolveGoodreads([entries[0]], { search: s });
    expect(r[0].chosen.id).toBe("gb-dune");
    expect(r[0].by).toBe("titulo");
  });
  it("erros na pesquisa não rebentam", async () => {
    const r = await resolveGoodreads([entries[1]], { search: async () => { throw new Error("rede"); } });
    expect(r[0].state).toBe("none");
  });
});

describe("toLibraryItem", () => {
  const res = { entry: { status: "completo", rating: 8, readAt: 1700000000000 }, chosen: { id: "gb-1", title: "Dune", type: "livros" } };
  it("com datas: completo leva addedAt", () => {
    expect(toLibraryItem(res, null, true)).toMatchObject({ userStatus: "completo", userRating: 8, addedAt: 1700000000000, type: "livros" });
  });
  it("sem datas ou sem readAt: nunca inventa addedAt", () => {
    expect(toLibraryItem(res, null, false).addedAt).toBeUndefined();
    expect(toLibraryItem({ ...res, entry: { ...res.entry, readAt: null } }, null, true).addedAt).toBeUndefined();
  });
});
