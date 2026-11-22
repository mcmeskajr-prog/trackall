import { describe, it, expect } from "vitest";
import { buildExploreQuery, buildTmdbRequest, buildIgdbBody, mapTmdbMedia, mapIgdbGame, EXPLORE_HAS_STATUS } from "./explore";

describe("explore · AniList", () => {
  it("manga exclui manhwa e novels por formato/país", () => {
    const q = buildExploreQuery({ type: "manga", sort: "trending" }).query;
    expect(q).toContain("format_in:[MANGA,ONE_SHOT]");
    expect(q).toContain('countryOfOrigin:"JP"');
    expect(q).toContain("TRENDING_DESC");
  });
  it("estado e ano entram no filtro; sem estado esconde o que ainda não saiu", () => {
    expect(buildExploreQuery({ type: "anime", status: "RELEASING", year: 2024 }).query).toContain("status:RELEASING");
    expect(buildExploreQuery({ type: "anime", year: 2024 }).query).toContain("startDate_greater:20240000,startDate_lesser:20250000");
    expect(buildExploreQuery({ type: "anime" }).query).toContain("status_not:NOT_YET_RELEASED");
  });
});

describe("explore · TMDB", () => {
  it("em alta sem filtros usa o endpoint de trending", () => {
    expect(buildTmdbRequest({ type: "filmes", sort: "trending" }).endpoint).toBe("/trending/movie/week");
    expect(buildTmdbRequest({ type: "series", sort: "trending" }).endpoint).toBe("/trending/tv/week");
  });
  it("com ano passa a discover e usa a chave de ano certa", () => {
    const m = buildTmdbRequest({ type: "filmes", sort: "trending", year: 2020 });
    expect(m.endpoint).toBe("/discover/movie");
    expect(m.params.primary_release_year).toBe("2020");
    expect(buildTmdbRequest({ type: "series", sort: "popular", year: 2020 }).params.first_air_date_year).toBe("2020");
  });
  it("mais bem avaliados exige um mínimo de votos; estado só existe nas séries", () => {
    const m = buildTmdbRequest({ type: "filmes", sort: "score" });
    expect(m.params.sort_by).toBe("vote_average.desc");
    expect(m.params["vote_count.gte"]).toBe("500");
    expect(buildTmdbRequest({ type: "series", sort: "popular", status: "FINISHED" }).params.with_status).toBe("3");
    expect(buildTmdbRequest({ type: "filmes", sort: "popular", status: "FINISHED" }).params.with_status).toBeUndefined();
    expect(EXPLORE_HAS_STATUS).not.toContain("filmes");
    expect(EXPLORE_HAS_STATUS).not.toContain("jogos");
  });
  it("tipo desconhecido não gera pedido; o mapa dá o id usado pela biblioteca", () => {
    expect(buildTmdbRequest({ type: "anime" })).toBeNull();
    expect(mapTmdbMedia({ id: 5, title: "X", poster_path: "/a.jpg", release_date: "2021-03-01", vote_average: 7.46 }, "filmes")).toMatchObject({ id: "tmdb-filmes-5", year: "2021", score: 7.5 });
  });
});

describe("explore · IGDB", () => {
  const NOW = 1_700_000_000;
  it("paginação por offset e ordenação por nota", () => {
    const b = buildIgdbBody({ sort: "score", page: 3 }, NOW);
    expect(b).toContain("sort total_rating desc");
    expect(b).toContain("limit 24; offset 48;");
    expect(b).toContain("version_parent = null");
  });
  it("em alta = lançados no último ano; ano filtra por intervalo", () => {
    const b = buildIgdbBody({ sort: "trending" }, NOW);
    expect(b).toContain(`first_release_date > ${NOW - 365 * 86400}`);
    const y = buildIgdbBody({ sort: "popular", year: 2020 }, NOW);
    expect(y).toContain(`first_release_date >= ${Date.UTC(2020, 0, 1) / 1000}`);
    expect(y).toContain(`first_release_date < ${Date.UTC(2021, 0, 1) / 1000}`);
  });
  it("mapa de jogo: id igdb-, capa grande e nota em 0-10", () => {
    const g = mapIgdbGame({ id: 9, name: "G", cover: { url: "//images.igdb.com/t_thumb/a.jpg" }, total_rating: 86.4, first_release_date: 1609459200, genres: [{ name: "RPG" }] });
    expect(g).toMatchObject({ id: "igdb-9", type: "jogos", year: "2021", score: 8.6, genres: ["RPG"] });
    expect(g.cover).toBe("https://images.igdb.com/t_cover_big/a.jpg");
  });
});
