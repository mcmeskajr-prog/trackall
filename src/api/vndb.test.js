import { describe, it, expect } from "vitest";
import { mapVn, cleanVndbText, buildVndbExploreBody, buildVndbSearchBody, isExplicitCover } from "./vndb";

const vn = (o = {}) => ({ id: "v17", title: "Steins;Gate", image: { url: "https://t.vndb.org/cv/1.jpg", sexual: 0, violence: 0 }, released: "2009-10-15", rating: 88.4, description: "Texto [url=https://x.y]link[/url] [spoiler]segredo[/spoiler] fim", developers: [{ name: "5pb." }], platforms: ["win", "ps3"], tags: [{ name: "Time Travel", rating: 2.9, spoiler: 0 }, { name: "Twist", rating: 2.8, spoiler: 2 }, { name: "Sci-fi", rating: 2.5, spoiler: 0 }], ...o });

describe("vndb", () => {
  it("mapVn converte campos principais", () => {
    const m = mapVn(vn());
    expect(m).toMatchObject({ id: "vndb-v17", type: "visualnovels", year: "2009", score: 8.8, extra: "5pb.", source: "VNDB" });
    expect(m.genres).toEqual(["Time Travel", "Sci-fi"]);
    expect(m.cover).toContain("vndb.org");
  });
  it("capas explícitas ficam sem imagem e saem do Explorar", () => {
    const ex = vn({ image: { url: "x", sexual: 2, violence: 0 } });
    expect(isExplicitCover(ex.image)).toBe(true);
    expect(mapVn(ex).cover).toBe("");
    expect(mapVn(ex, { hideExplicit: true })).toBeNull();
  });
  it("cleanVndbText remove BBCode e spoilers", () => {
    expect(cleanVndbText("A [url=http://a]b[/url] [spoiler]x[/spoiler] [b]c[/b]")).toBe("A b  c");
  });
  it("data parcial ('TBA' ou só ano-mês) não parte o ano", () => {
    expect(mapVn(vn({ released: "TBA" })).year).toBe("");
    expect(mapVn(vn({ released: "2024-05" })).year).toBe("2024");
  });
  it("corpo de pesquisa e de explorar", () => {
    expect(buildVndbSearchBody("clannad").filters).toEqual(["search", "=", "clannad"]);
    const b = buildVndbExploreBody({ sort: "score", year: 2020, page: 2 });
    expect(b.sort).toBe("rating"); expect(b.reverse).toBe(true); expect(b.page).toBe(2);
    expect(JSON.stringify(b.filters)).toContain("2020-01-01");
    expect(buildVndbExploreBody({ sort: "new" }).sort).toBe("released");
  });
});
