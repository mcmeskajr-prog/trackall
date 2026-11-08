import { useRef } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../contexts/ThemeContext";
import { BannerEditor } from "./BannerEditor";

// «Editar perfil» no PC (layout novo): só a foto e o banner (com zoom e posição). Nome, bio e e-mail ficam numa secção recolhida.
// Portal para o body: o ProfileView vive dentro de um ancestral com transform (ver DEV_GUIDE).
export function EditProfileModal({ lang, avatar, onAvatarFile, uploadingImage, uploadError, bannerUrl, bannerStyle, onBannerStyle, onBannerFile, onBannerRemove,
  hideBannerMobile, onHideBannerMobile, name, onName, bio, onBio, hideEmail, onHideEmail, saving, onSave, onClose }) {
  const { accent, darkMode } = useTheme();
  const en = lang === "en";
  const fileRef = useRef(null);
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const border = darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.15)";
  const box = { padding: 16, borderRadius: 14, border: `1px solid ${border}`, background: darkMode ? "#0d1117" : "#f8fafc" };
  const btn = { padding: "8px 14px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${border}`, background: "transparent", color: text };
  const busy = !!uploadingImage || saving;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 170, background: "rgba(5,8,12,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column", gap: 14, padding: 22, borderRadius: 24, background: darkMode ? "#11161d" : "#ffffff", border: `1px solid ${border}`, boxShadow: "0 40px 80px -20px rgba(0,0,0,0.9)", color: text }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{en ? "Edit profile" : "Editar perfil"}</div>
          <button onClick={onClose} aria-label={en ? "Close" : "Fechar"} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: text, cursor: "pointer", fontSize: 20, fontFamily: "inherit" }}>×</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 2 }}>
          <div style={{ ...box, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: `linear-gradient(135deg, ${accent}, ${accent}88)`, boxShadow: `0 0 0 3px ${accent}` }}>
              {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 30 }}>👤</span>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{en ? "Profile photo" : "Foto de perfil"}</div>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>{en ? "You can zoom and move it before saving." : "Podes dar zoom e mover antes de guardar."}</div>
              <input type="file" accept="image/*" ref={fileRef} onChange={(e) => { onAvatarFile(e); e.target.value = ""; }} style={{ display: "none" }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingImage === "avatar"} style={btn}>
                {uploadingImage === "avatar" ? (en ? "Uploading…" : "A enviar…") : (en ? "Change photo" : "Mudar foto")}
              </button>
            </div>
          </div>

          <BannerEditor url={bannerUrl} style={bannerStyle} onStyle={onBannerStyle} onFile={onBannerFile} onRemove={onBannerRemove}
            uploading={uploadingImage === "banner"} hide={hideBannerMobile} onHide={onHideBannerMobile} lang={lang} avatar={avatar} name={name} />

          <details style={box}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800 }}>{en ? "Name and bio" : "Nome e bio"}</summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <input value={name} onChange={(e) => onName(e.target.value)} placeholder={en ? "Your name" : "O teu nome"} style={{ padding: "10px 14px", fontSize: 15, fontWeight: 700 }} />
              <input value={bio} onChange={(e) => onBio(e.target.value)} placeholder={en ? "A short bio" : "Uma bio curta"} style={{ padding: "10px 14px", fontSize: 13 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={!!hideEmail} onChange={(e) => onHideEmail(e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
                <span style={{ fontSize: 13, color: muted }}>{en ? "Hide my email on my profile" : "Esconder o meu e-mail no perfil"}</span>
              </label>
            </div>
          </details>
          {uploadError && <div style={{ fontSize: 12.5, color: "#f87171" }}>{uploadError}</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ minHeight: 44, padding: "0 20px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: text, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}>{en ? "Cancel" : "Cancelar"}</button>
          <button onClick={onSave} disabled={busy} style={{ minHeight: 44, padding: "0 24px", borderRadius: 12, border: "none", background: accent, color: "white", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit", fontSize: 14, fontWeight: 800 }}>
            {busy ? (en ? "Wait…" : "Aguarda…") : (en ? "Save" : "Guardar")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
