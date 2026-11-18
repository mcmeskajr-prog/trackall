import { describe, it, expect } from "vitest";
import { needsLegibility, legibleTheme, isLightOverlay, LEGIBLE_AUTO_PANEL, LEGIBLE_AUTO_OPACITY, LEGIBLE_MIN_OPACITY } from "./contrast";

describe("needsLegibility", () => {
  it("imagem clara (média 0.72) precisa", () => expect(needsLegibility({ lum: 0.72, std: 0.35 })).toBe(true));
  it("imagem escura não precisa", () => expect(needsLegibility({ lum: 0.05, std: 0.1 })).toBe(false));
  it("cinzento suave não precisa", () => expect(needsLegibility({ lum: 0.25, std: 0.1 })).toBe(false));
  it("média intermédia mas muito contrastada precisa", () => expect(needsLegibility({ lum: 0.3, std: 0.35 })).toBe(true));
  it("sem dados não precisa", () => { expect(needsLegibility(null)).toBe(false); expect(needsLegibility({})).toBe(false); });
});

describe("legibleTheme", () => {
  const base = { hasImage: true, overlay: "rgba(0,0,0,0.55)" };
  it("desligado não mexe em nada", () => expect(legibleTheme({ ...base, on: false, panelBg: "", panelOpacity: 100 })).toEqual({ active: false, panelBg: "", panelOpacity: 100 }));
  it("sem imagem não faz nada, mesmo ligado", () => expect(legibleTheme({ ...base, on: true, hasImage: false, panelBg: "", panelOpacity: 100 }).active).toBe(false));
  it("com película branca não faz nada (já é o modo claro)", () => { expect(isLightOverlay("rgba(255,255,255,0.6)")).toBe(true); expect(legibleTheme({ ...base, on: true, overlay: "rgba(255,255,255,0.6)", panelBg: "", panelOpacity: 100 }).active).toBe(false); });
  it("painel Auto passa a vidro escuro", () => expect(legibleTheme({ ...base, on: true, panelBg: "", panelOpacity: 100 })).toEqual({ active: true, panelBg: LEGIBLE_AUTO_PANEL, panelOpacity: LEGIBLE_AUTO_OPACITY }));
  it("cor própria mantém-se e ganha opacidade mínima", () => {
    expect(legibleTheme({ ...base, on: true, panelBg: "#223344", panelOpacity: 40 })).toEqual({ active: true, panelBg: "#223344", panelOpacity: LEGIBLE_MIN_OPACITY });
    expect(legibleTheme({ ...base, on: true, panelBg: "#223344", panelOpacity: 90 }).panelOpacity).toBe(90);
  });
});
