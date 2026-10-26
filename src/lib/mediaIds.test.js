import { describe, it, expect } from "vitest";
import { normalizeMediaId, findLibraryEntry, normalizeMediaItem } from "./mediaIds";

describe("normalizeMediaId", () => {
  it("minúsculas, espaços → hífen, sem caracteres especiais", () => {
    expect(normalizeMediaId("Anime 123")).toBe("anime-123");
    expect(normalizeMediaId("TT_0111161!")).toBe("tt0111161");
  });
  it("vazio / nulo → string vazia", () => {
    expect(normalizeMediaId("")).toBe("");
    expect(normalizeMediaId(null)).toBe("");
    expect(normalizeMediaId(undefined)).toBe("");
  });
  it("números viram texto", () => {
    expect(normalizeMediaId(42)).toBe("42");
  });
});

describe("findLibraryEntry", () => {
  const lib = { "anime-1": { title: "X" }, "tt1": { title: "Y" } };
  it("encontra pelo id exato", () => {
    expect(findLibraryEntry(lib, "tt1")).toEqual({ key: "tt1", item: { title: "Y" } });
  });
  it("encontra ignorando maiúsculas e espaços", () => {
    expect(findLibraryEntry(lib, "Anime 1")?.key).toBe("anime-1");
    expect(findLibraryEntry(lib, "TT1")?.key).toBe("tt1");
  });
  it("devolve null quando não existe ou os dados são inválidos", () => {
    expect(findLibraryEntry(lib, "nope")).toBeNull();
    expect(findLibraryEntry(null, "tt1")).toBeNull();
    expect(findLibraryEntry(lib, "")).toBeNull();
    expect(findLibraryEntry(lib, undefined)).toBeNull();
  });
  it("o id 0 é válido (não é tratado como vazio)", () => {
    expect(findLibraryEntry({ "0": { title: "Z" } }, 0)?.key).toBe("0");
  });
});

describe("normalizeMediaItem", () => {
  it("preenche os campos base sem perder os outros", () => {
    const n = normalizeMediaItem({ id: 5, name: "Foo", poster: "p.jpg", extra: 1 });
    expect(n).toMatchObject({ id: 5, title: "Foo", cover: "p.jpg", type: "", extra: 1 });
  });
  it("item nulo → objeto base", () => {
    expect(normalizeMediaItem(null)).toEqual({ id: "", type: "", title: "", cover: "" });
  });
});
