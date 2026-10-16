export function Notification({ notif, isMobile, onDismiss }) {
  if (!notif) return null;
  const pos = isMobile
    ? { left: 12, right: 12, bottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }
    : { top: 20, right: 20 };
  return (
    <div role="status" aria-live="polite" style={{
      position: "fixed", ...pos, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 14, justifyContent: isMobile ? "space-between" : "flex-start",
      background: notif.color || "#10b981", color: "white",
      padding: notif.action ? "9px 10px 9px 18px" : "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      animation: "slideIn 0.25s cubic-bezier(.34,1.56,.64,1)",
    }}>
      <span>{notif.msg}</span>
      {notif.action && (
        <button onClick={() => { notif.action.onClick(); }} style={{
          background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.35)", color: "white",
          padding: "6px 14px", borderRadius: 9, fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer",
        }}>{notif.action.label}</button>
      )}
    </div>
  );
}
