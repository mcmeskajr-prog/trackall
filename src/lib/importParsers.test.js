import { describe, it, expect } from "vitest";
import { parseLetterboxdCSV } from "./importParsers";

describe("parseLetterboxdCSV", () => {
  const csv = [
    "Date,Name,Year,Letterboxd URI,Rating",
    '2024-03-01,"Se7en",1995,https://boxd.it/x,4.5',
    '2024-03-02,"Amélie, ou le destin",2001,https://boxd.it/y,3',
    "2024-03-03,,2000,https://boxd.it/z,5",
  ].join("\n");
  const out = parseLetterboxdCSV(csv);

  it("lê as linhas válidas e ignora as sem título", () => {
    expect(out).toHaveLength(2);
  });
  it("converte a nota 0.5–5 para 1–10", () => {
    expect(out[0].userRating).toBe(9);
    expect(out[1].userRating).toBe(6);
  });
  it("respeita vírgulas dentro de aspas", () => {
    expect(out[1].title).toBe("Amélie, ou le destin");
  });
  it("marca como filme completo e com origem Letterboxd", () => {
    expect(out[0]).toMatchObject({ type: "filmes", userStatus: "completo", source: "Letterboxd", year: 1995 });
  });
  it("gera ids estáveis (o mesmo filme dá sempre o mesmo id)", () => {
    expect(parseLetterboxdCSV(csv)[0].id).toBe(out[0].id);
    expect(out[0].id).toBe("lb-se7en-1995");
  });
  it("CSV vazio ou sem coluna Name → lista vazia", () => {
    expect(parseLetterboxdCSV("")).toEqual([]);
    expect(parseLetterboxdCSV("a,b\n1,2")).toEqual([]);
  });
});
