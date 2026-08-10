import React from "react";
import { createRoot } from "react-dom/client";
import ExpenseTracker from "./ExpenseTracker.jsx";

// Uses Claude's built-in storage when viewed inside the Claude app,
// otherwise falls back to the phone's own browser storage (localStorage)
// so the app also works standalone in Safari / as a Home Screen app.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      if (v === null) throw new Error("not found");
      return { key, value: v };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true };
    },
    async list(prefix) {
      const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
      return { keys };
    },
  };
}

createRoot(document.getElementById("root")).render(<ExpenseTracker />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
