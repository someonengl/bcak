"use strict";

const TOKEN_KEY = "novamarket_admin_token_v1";

function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");

if (getToken()) {
  // If already logged in, go to dashboard
  window.location.href = "./dashboard.html";
}

function notice(text, kind = "ok") {
  msg.innerHTML = "";
  const div = document.createElement("div");
  div.className = `notice ${kind === "bad" ? "bad" : "ok"}`;
  div.textContent = text;
  msg.appendChild(div);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.innerHTML = "";

  const username = document.getElementById("u").value;
  const password = document.getElementById("p").value;

  try {
    const res = await fetch("/admin/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Login failed");

    setToken(data.token);
    window.location.href = "./dashboard.html";
  } catch (err) {
    notice(err.message, "bad");
  }
});
