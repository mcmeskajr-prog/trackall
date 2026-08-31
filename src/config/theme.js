// ─── Accent Presets ───────────────────────────────────────────────────────────
export const ACCENT_PRESETS = [
  { name: "Laranja", color: "#f97316" },
  { name: "Roxo",    color: "#a855f7" },
  { name: "Ciano",   color: "#06b6d4" },
  { name: "Rosa",    color: "#ec4899" },
  { name: "Verde",   color: "#10b981" },
  { name: "Azul",    color: "#3b82f6" },
  { name: "Amarelo", color: "#eab308" },
  { name: "Vermelho",color: "#ef4444" },
];

// ── Background Presets ───────────────────────────────────────────────────────
export const BG_PRESETS = [
  // Escuro
  { name: "Preto",   value: "#080c10", dark: true },
  { name: "Escuro",  value: "#0d1117", dark: true },
  { name: "Ardósia", value: "#0f172a", dark: true },
  { name: "Grafite", value: "#111827", dark: true },
  // Claro — warm off-white
  { name: "Papel",   value: "#f5f0eb", dark: false },
  { name: "Creme",   value: "#fdf6e3", dark: false },
  { name: "Nuvem",   value: "#f0f4f8", dark: false },
  { name: "Branco",  value: "#ffffff", dark: false },
];

// ─── Color Utilities ──────────────────────────────────────────────────────────
// Detecta se uma cor hex é escura ou clara
export function isColorDark(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0,2),16);
  const g = parseInt(c.substr(2,2),16);
  const b = parseInt(c.substr(4,2),16);
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminance < 0.5;
}

// Gera 3 variações da cor de destaque para os blocos de estatísticas
// shiftDeg: 0 = original, 15 = deslocado +15°, 30 = +30°, etc.
export function accentShade(hex, shiftDeg) {
  const c = hex.replace("#", "");
  let r = parseInt(c.substr(0,2),16)/255;
  let g = parseInt(c.substr(2,2),16)/255;
  let b = parseInt(c.substr(4,2),16)/255;
  
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0, s = max === 0 ? 0 : d/max, v = max;
  
  if (d !== 0) {
    if (max === r) h = ((g-b)/d + 6) % 6;
    else if (max === g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h = h * 60;
  }
  
  h = ((h + shiftDeg) % 360 + 360) % 360;
  
  const f = (n) => {
    const k = (n + h/60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4-k, 1));
  };
  
  const toHex = (x) => Math.round(x*255).toString(16).padStart(2, "0");
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
}

// Gera variações subtis do accent — hue ±10° + brilho ligeiramente diferente
export function accentVariant(hex, index) {
  try {
    const r = parseInt(hex.slice(1,3),16)/255, 
          g = parseInt(hex.slice(3,5),16)/255, 
          b = parseInt(hex.slice(5,7),16)/255;
    
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0;
    
    if (d) { 
      h = max===r ? ((g-b)/d)%6 : max===g ? (b-r)/d+2 : (r-g)/d+4; 
      h = ((h*60)+360)%360; 
    }
    
    const s = max ? d/max : 0;
    // Pequenas variações: hue ±10°, valor ±8%
    const shifts = [[0,0],[10,0.06],[-10,0.06],[18,-0.05],[-18,-0.05],[8,0.10]];
    const [dh, dv] = shifts[index % shifts.length];
    const nh = (h + dh + 360) % 360;
    const nv = Math.min(1, Math.max(0.3, max + dv));
    
    const hi = Math.floor(nh/60), f = nh/60-hi, p = nv*(1-s), q = nv*(1-f*s), tv = nv*(1-(1-f)*s);
    const [nr,ng,nb] = [[nv,tv,p],[q,nv,p],[p,nv,tv],[p,q,nv],[tv,p,nv],[nv,p,q]][hi];
    
    return '#'+[nr,ng,nb].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
  } catch { 
    return hex; 
  }
}