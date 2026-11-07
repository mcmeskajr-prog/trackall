import { describe, it, expect } from "vitest";
import { parseMalXml, parseMalDate, buildMalItems } from "./malImport";

const animeXml = `<?xml version="1.0"?><myanimelist><myinfo><user_id>1</user_id></myinfo>
<anime><series_animedb_id>1</series_animedb_id><series_title><![CDATA[Cowboy Bebop]]></series_title><my_finish_date>2021-03-14</my_finish_date><my_score>9</my_score><my_status>Completed</my_status></anime>
<anime><series_animedb_id>5</series_animedb_id><series_title>Tom &amp; Jerry</series_title><my_finish_date>0000-00-00</my_finish_date><my_score>0</my_score><my_status>Plan to Watch</my_status></anime>
<anime><series_animedb_id>1</series_animedb_id><series_title>Repetido</series_title><my_status>Dropped</my_status></anime>
<anime><series_animedb_id>7</series_animedb_id><series_title>X</series_title><my_finish_date>2020-00-00</my_finish_date><my_score>15</my_score><my_status>2</my_status></anime></myanimelist>`;
const mangaXml = `<myanimelist><manga><manga_mangadb_id>2</manga_mangadb_id><series_title>Berserk</series_title><my_status>Reading</my_status><my_score>10</my_score></manga></myanimelist>`;

describe("parseMalDate", () => {
  it("só aceita datas completas", () => {
    expect(parseMalDate("2021-03-14")).toEqual({ year: 2021, month: 3, day: 14 });
    expect(parseMalDate("0000-00-00")).toBeNull();
    expect(parseMalDate("2020-00-00")).toBeNull();
    expect(parseMalDate("")).toBeNull();
  });
});

describe("parseMalXml", () => {
  const list = parseMalXml(animeXml);
  it("lê entradas, CDATA e entidades, sem repetidos", () => {
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ type: "ANIME", malId: 1, title: "Cowboy Bebop", status: "COMPLETED", score: 9, finish: { year: 2021, month: 3, day: 14 } });
    expect(list[1]).toMatchObject({ title: "Tom & Jerry", status: "PLANNING", finish: null });
  });
  it("estado numérico e nota limitada a 10", () => {
    expect(list[2]).toMatchObject({ malId: 7, status: "COMPLETED", score: 10, finish: null });
  });
  it("manga", () => {
    expect(parseMalXml(mangaXml)[0]).toMatchObject({ type: "MANGA", malId: 2, status: "CURRENT", score: 10 });
  });
  it("lixo → lista vazia", () => { expect(parseMalXml("olá")).toEqual([]); });
});

describe("buildMalItems", () => {
  it("liga ao AniList, data só em completos, e separa os não encontrados", () => {
    const entries = parseMalXml(animeXml);
    const media = { ANIME1: { id: 1, type: "ANIME", title: { romaji: "Cowboy Bebop" } } };
    const { items, missing } = buildMalItems(entries, media);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "al-anime-1", userStatus: "completo", userRating: 9 });
    expect(items[0].addedAt).toBeTypeOf("number");
    expect(missing).toHaveLength(2);
  });
});
