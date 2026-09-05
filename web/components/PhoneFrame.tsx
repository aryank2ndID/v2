"use client";
import * as React from "react";

/** The ASHA worker's phone. A ₹6,000 Android, so the UI is sized for it. */
export function PhoneFrame({ children, status }: { children: React.ReactNode; status?: React.ReactNode }) {
  return (
    <div style={{
      width: 352, flex: "0 0 352px", borderRadius: 34, padding: 9,
      background: "linear-gradient(160deg, #1A1A2E, #0B1A33)",
      boxShadow: "var(--sh-pop)", position: "sticky", top: 74,
    }}>
      <div style={{
        borderRadius: 27, background: "var(--paper)", overflow: "hidden",
        border: "1px solid #333", display: "flex", flexDirection: "column",
        height: 660,
      }}>
        <div className="between" style={{
          padding: "9px 16px 7px", fontSize: 11, color: "var(--ink-2)",
          fontWeight: 600, letterSpacing: "-0.01em", flex: "0 0 auto",
        }}>
          <span className="num">9:41</span>
          <div className="row" style={{ gap: 5 }}>{status}</div>
        </div>
        <div className="grow" style={{ overflowY: "auto", overflowX: "hidden" }}>{children}</div>
      </div>
    </div>
  );
}
