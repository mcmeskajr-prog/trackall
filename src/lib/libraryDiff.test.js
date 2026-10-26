import { describe, it, expect } from "vitest";
import { diffLibrary } from "./libraryDiff";

const a = { id: "a", title: "A", userRating: 8 };
const b = { id: "b", title: "B", userRating: 6 };

describe("diffLibrary", () => {
  it("sem alterações não escreve nada", () => {
    expect(diffLibrary({ a, b }, { a: { ...a }, b: { ...b } })).toEqual({ upserts: [], deletes: [] });
  });
  it("item novo → upsert", () => {
    expect(diffLibrary({ a }, { a, b })).toEqual({ upserts: [["b", b]], deletes: [] });
  });
  it("item alterado → upsert só desse", () => {
    const a2 = { ...a, userRating: 9 };
    expect(diffLibrary({ a, b }, { a: a2, b })).toEqual({ upserts: [["a", a2]], deletes: [] });
  });
  it("item removido → delete", () => {
    expect(diffLibrary({ a, b }, { a })).toEqual({ upserts: [], deletes: ["b"] });
  });
  it("nunca apaga linhas especiais (__hall_of_fame__)", () => {
    expect(diffLibrary({ a, __hall_of_fame__: { hall: [] } }, { a }).deletes).toEqual([]);
  });
  it("repor um item removido volta a fazer upsert (Desfazer)", () => {
    const removed = diffLibrary({ a, b }, { a });
    expect(removed.deletes).toEqual(["b"]);
    expect(diffLibrary({ a }, { a, b }).upserts).toEqual([["b", b]]);
  });
  it("aceita biblioteca vazia / indefinida", () => {
    expect(diffLibrary(undefined, undefined)).toEqual({ upserts: [], deletes: [] });
    expect(diffLibrary({}, { a }).upserts).toHaveLength(1);
  });
});
