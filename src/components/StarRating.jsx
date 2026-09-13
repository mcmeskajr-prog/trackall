import { useState } from "react";

export function StarRating({ value = 0, onChange, size = 16, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  // Each star = 1 point, but we support 0.5 increments
  // We render 10 stars, each star can be empty, half, or full
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1,2,3,4,5,6,7,8,9,10].map((star) => {
        const full = active >= star;
        const half = !full && active >= star - 0.5;
        return (
          <div
            key={star}
            style={{ position: "relative", width: size, height: size, cursor: readOnly ? "default" : "pointer", flexShrink: 0 }}
            onMouseLeave={() => !readOnly && setHover(0)}
          >
            {/* Background star */}
            <span style={{ fontSize: size, color: "#374151", lineHeight: 1, userSelect: "none" }}>★</span>
            {/* Filled overlay */}
            {(full || half) && (
              <span style={{
                position: "absolute", left: 0, top: 0, fontSize: size, color: "#f59e0b",
                lineHeight: 1, overflow: "hidden", width: full ? "100%" : "50%", userSelect: "none",
              }}>★</span>
            )}
            {/* Left half hitbox (X - 0.5) */}
            <div
              style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%" }}
              onMouseEnter={() => !readOnly && setHover(star - 0.5)}
              onClick={(e) => { if(!readOnly && onChange){ const p=e.currentTarget.parentElement; if(p){p.classList.remove("ta-star");void p.offsetWidth;p.classList.add("ta-star");} onChange(value === star - 0.5 ? 0 : star - 0.5); } }}
            />
            {/* Right half hitbox (X) */}
            <div
              style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%" }}
              onMouseEnter={() => !readOnly && setHover(star)}
              onClick={(e) => { if(!readOnly && onChange){ const p=e.currentTarget.parentElement; if(p){p.classList.remove("ta-star");void p.offsetWidth;p.classList.add("ta-star");} onChange(value === star ? 0 : star); } }}
            />
          </div>
        );
      })}
      {active > 0 && !readOnly && (
        <span style={{ fontSize: size * 0.8, color: "#f59e0b", fontWeight: 700, marginLeft: 4, minWidth: "2.2ch", display: "inline-block" }}>{active}</span>
      )}
      {readOnly && value > 0 && (
        <span style={{ fontSize: size * 0.8, color: "#f59e0b", fontWeight: 700, marginLeft: 4 }}>{value}</span>
      )}
    </div>
  );
}
