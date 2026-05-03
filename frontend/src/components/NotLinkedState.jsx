import React from "react";
import { Link2 } from "lucide-react";
import Sidebar from "./Sidebar";

export default function NotLinkedState({
  title = "You're not connected yet",
  description = "We couldn’t find your health record in our system.",
  explanation = "Your account is created, but your patient profile hasn’t been linked yet.",
  primaryText = "Link my patient record →",
  onPrimary,
  secondary = "If you already have a record, contact your provider.",
}) {
  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <section style={styles.card}>
          <div style={styles.iconWrap}>
            <Link2 size={20} color="#2f6f8c" />
          </div>

          <h1 style={styles.title}>{title}</h1>
          <p style={styles.desc}>{description}</p>
          <p style={styles.explain}>{explanation}</p>

          {onPrimary && (
            <button type="button" onClick={onPrimary} style={styles.btn}>
              {primaryText}
            </button>
          )}

          <p style={styles.secondary}>{secondary}</p>
        </section>
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    background: "#f5f8fb",
  },
  main: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    background: "linear-gradient(180deg, #f2fbfb 0%, #edf7f8 100%)",
    border: "1px solid #d8e9eb",
    borderRadius: "18px",
    padding: "24px 24px",
    boxShadow: "0 6px 20px rgba(24, 73, 98, 0.08)",
    textAlign: "center",
  },
  iconWrap: {
    width: "44px",
    height: "44px",
    margin: "0 auto 10px",
    borderRadius: "12px",
    background: "#deeff3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    margin: 0,
    fontFamily: "Lora, serif",
    fontSize: "29px",
    color: "#1f4a63",
  },
  desc: {
    margin: "8px 0 0",
    fontSize: "14px",
    color: "#4f6a7a",
  },
  explain: {
    margin: "8px auto 0",
    fontSize: "12.8px",
    color: "#668294",
    maxWidth: "50ch",
    lineHeight: 1.45,
  },
  btn: {
    marginTop: "14px",
    border: "none",
    background: "#2f6f8c",
    color: "#fff",
    borderRadius: "999px",
    padding: "9px 15px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(35, 96, 126, 0.2)",
  },
  secondary: {
    marginTop: "10px",
    fontSize: "12.3px",
    color: "#6a8698",
  },
};
