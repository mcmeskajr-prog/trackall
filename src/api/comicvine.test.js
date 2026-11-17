import { describe, it, expect } from "vitest";
import { cleanVolumes } from "./comicvine";

describe("cleanVolumes", () => {
  it("junta volumes com o mesmo nome e deixa de fora coleções de 1 edição", () => {
    const out = cleanVolumes([
      { id: 1, name: "King in Black", count_of_issues: 5, image: {} },
      { id: 2, name: "King In Black", count_of_issues: 1, deck: "Trade paperback collecting King In Black." },
      { id: 3, name: "King in Black", count_of_issues: 5, image: {} },
      { id: 4, name: "Namor", count_of_issues: 5 },
    ]);
    expect(out.map((c) => c.id).sort()).toEqual([1, 4]);
  });
  it("mantém corridas do mesmo nome com anos diferentes, as maiores primeiro", () => {
    const out = cleanVolumes([
      { id: 1, name: "Batman", start_year: "2016", count_of_issues: 100 },
      { id: 2, name: "Batman", start_year: "1940", count_of_issues: 700 },
      { id: 3, name: "Batman", start_year: "1940", count_of_issues: 3 },
    ]);
    expect(out.map((c) => c.id)).toEqual([2, 1]);
  });
});
