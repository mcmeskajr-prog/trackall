import { useTheme } from "../contexts/ThemeContext";
import { splitBanner, useBannerPalette, baseColor, backdropCss, bannerFilter } from "../lib/bannerColors";

// Banner do perfil no telemóvel: imagem que se dissolve num fundo tingido com a cor do banner.
// `children` fica por cima (avatar, nome, números…). `height` = altura visível da imagem.
// `bleed` anula o padding lateral/superior do contentor (ecrã inteiro).
export function BannerHero({ banner, styleOverride, urlOverride, height = 190, bleed = 16, topBleed = 0, children, style: boxStyle }) {
  const { accent, darkMode } = useTheme();
  const parsed = splitBanner(banner);
  const url = urlOverride || parsed.url;
  const st = styleOverride || parsed.style;
  const palette = useBannerPalette(url);
  const base = baseColor(st, palette, accent);
  return (
    <div style={{ position: "relative", margin: `${-topBleed}px ${-bleed}px 0`, overflow: "hidden", ...boxStyle }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, filter: bannerFilter(st), background: backdropCss(base, st, darkMode), pointerEvents: "none" }}>
        {url && <img src={url} alt="" decoding="async" crossOrigin="anonymous"
          style={{ position: "absolute", left: 0, top: 0, width: "100%", height, objectFit: "cover", display: "block",
            WebkitMaskImage: "linear-gradient(180deg, #000 45%, transparent 100%)", maskImage: "linear-gradient(180deg, #000 45%, transparent 100%)" }} />}
      </div>
      <div style={{ position: "relative", zIndex: 1, padding: `${Math.max(40, height - 54)}px ${bleed}px 6px` }}>{children}</div>
    </div>
  );
}
