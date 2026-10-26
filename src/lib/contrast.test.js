import { describe, it, expect } from "vitest";
import { hexRgb, hexLum, isDarkLum, onAccent, overlayAlpha, ratio } from "./contrast";

describe("cores", () => {
  it("hexRgb lê #rrggbb e #rgb, e rejeita lixo", () => {
    expect(hexRgb("#ff8000")).toEqual([255, 128, 0]);
    expect(hexRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexRgb("laranja")).toBeNull();
    expect(hexRgb("")).toBeNull();
  });
  it("preto e branco nos extremos da luminância", () => {
    expect(hexLum("#000000")).toBe(0);
    expect(hexLum("#ffffff")).toBeCloseTo(1, 5);
  });
  it("fundos escuros vs claros", () => {
    expect(isDarkLum(hexLum("#0d1117"))).toBe(true);
    expect(isDarkLum(hexLum("#ffffff"))).toBe(false);
    expect(isDarkLum(hexLum("#e2e8f0"))).toBe(false);
  });
  it("contraste preto/branco = 21", () => {
    expect(ratio(hexLum("#000000"), hexLum("#ffffff"))).toBeCloseTo(21, 0);
  });
  it("texto sobre a cor de destaque: branco em cores escuras, preto em claras", () => {
    expect(onAccent("#1e3a8a")).toBe("#ffffff");
    expect(onAccent("#fde047")).toBe("#0b0b0b");
  });
});

describe("overlayAlpha", () => {
  it("lê o alfa de rgba()", () => {
    expect(overlayAlpha("rgba(0,0,0,0.55)")).toBeCloseTo(0.55);
    expect(overlayAlpha("rgba(0, 0, 0, 0)")).toBe(0);
  });
  it("rgb() sem alfa = 1 e texto inválido = 0", () => {
    expect(overlayAlpha("rgb(10,10,10)")).toBe(1);
    expect(overlayAlpha("nada")).toBe(0);
    expect(overlayAlpha(undefined)).toBe(0);
  });
});
