"use strict";

export const API = {
  products: "/api/products",
  product: (id) => `/api/products/${encodeURIComponent(id)}`,
  orders: "/api/orders"
};

export function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(x);
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const CART_KEY = "novamarket_cart_v1";

export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const data = raw ? JSON.parse(raw) : { items: [] };
    if (!Array.isArray(data.items)) data.items = [];
    return data;
  } catch {
    return { items: [] };
  }
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function cartCount() {
  const cart = getCart();
  return cart.items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
}

export function setCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  el.textContent = String(cartCount());
}

export function addToCart(productId, qty = 1) {
  const cart = getCart();
  const q = Math.max(1, Math.min(999, Number(qty) || 1));
  const idx = cart.items.findIndex(x => x.productId === productId);
  if (idx >= 0) {
    cart.items[idx].qty = Math.min(999, (Number(cart.items[idx].qty) || 0) + q);
  } else {
    cart.items.push({ productId, qty: q });
  }
  saveCart(cart);
  setCartBadge();
}

export function updateQty(productId, qty) {
  const cart = getCart();
  const q = Number(qty);
  cart.items = cart.items
    .map(it => it.productId === productId ? ({ ...it, qty: q }) : it)
    .filter(it => Number(it.qty) > 0);
  saveCart(cart);
  setCartBadge();
}

export function removeFromCart(productId) {
  const cart = getCart();
  cart.items = cart.items.filter(it => it.productId !== productId);
  saveCart(cart);
  setCartBadge();
}

export async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export function toast(container, message, kind = "ok") {
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = `notice ${kind === "bad" ? "bad" : "ok"}`;
  div.textContent = message;
  container.appendChild(div);
}
