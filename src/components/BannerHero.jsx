import { useTheme } from "../contexts/ThemeContext";
import { splitBanner, useBannerPalette, baseColor, backdropCss, bannerFilter } from "../lib/bannerColors";

// Cartão de perfil com banner (telemóvel): imagem no topo que se dissolve num fundo tingido com a
// cor do banner, dentro de um cartão arredondado. A mesma cor passa a ser o destaque do perfil
// (ver useBannerAccent), por isso nada "luta" com a cor do tema.
export function BannerHero({ banner, styleOverride, urlOverride, height = 150, children, style: boxStyle }) {
  const { accent, darkMode } = useTheme();
  const parsed = splitBanner(banner);
  const url = urlOverride || parsed.url;
  const st = styleOverride || parsed.style;
  const palette = useBannerPalette(url);
  const base = baseColor(st, palette, accent);
  const filt = bannerFilter(st);
  const mask = "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.9) 40%, rgba(0,0,0,0.5) 70%, transparent 100%)";
  return (
    <div style={{ position: "relative", borderRadius: 26, overflow: "hidden", border: `1px solid ${accent}55`, background: darkMode ? "#0b0d12" : "#ffffff", boxShadow: `0 10px 40px ${accent}18`, isolation: "isolate", ...boxStyle }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, filter: filt, background: backdropCss(base, st, darkMode), pointerEvents: "none" }} />
      {url && <img src={url} alt="" decoding="async" crossOrigin="anonymous"
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height, objectFit: "cover", display: "block", pointerEvents: "none", filter: filt, WebkitMaskImage: mask, maskImage: mask }} />}
      <div style={{ position: "relative", zIndex: 1, padding: `${Math.max(40, height - 46)}px 18px 18px` }}>{children}</div>
    </div>
  );
}
