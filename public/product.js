"use strict";

import { API, addToCart, escapeHtml, jsonFetch, money, setCartBadge } from "./lib.js";

const root = document.getElementById("root");

function getId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("id") || "";
}

function render(p) {
  const img = escapeHtml(p.logo || "");
  const name = escapeHtml(p.name || "Untitled");
  const desc = escapeHtml(p.description || "");
  const price = money(p.price || 0);

  root.innerHTML = `
    <div class="kv">
      <div class="bigimg"><img src="${img}" alt="${name}" onerror="this.style.opacity=.2"/></div>
      <div class="panel">
        <h2 class="h">${name}</h2>
        <div class="muted" style="line-height:1.6">${desc}</div>
        <div style="height:14px"></div>

        <div class="row" style="justify-content:flex-start;gap:12px">
          <div class="price" style="font-size:20px">${price}</div>
          <div class="muted small">Product ID: <span style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;">${escapeHtml(p.id)}</span></div>
        </div>

        <div style="height:14px"></div>

        <div class="row" style="justify-content:flex-start;gap:10px">
          <input id="qty" class="pill" style="width:110px;border-radius:12px" type="number" min="1" max="999" value="1"/>
          <button id="add" class="btn primary">Add to cart</button>
          <a class="btn" href="./cart.html">Go to cart</a>
        </div>

        <div id="note" style="margin-top:12px"></div>
      </div>
    </div>
  `;

  document.getElementById("add").addEventListener("click", () => {
    const q = Number(document.getElementById("qty").value || 1);
    addToCart(p.id, q);
    const note = document.getElementById("note");
    note.innerHTML = `<div class="notice ok">Added to cart.</div>`;
  });
}

async function main() {
  setCartBadge();
  const id = getId();
  if (!id) {
    root.innerHTML = `<div class="notice bad">Missing product id.</div>`;
    return;
  }
  try {
    const p = await jsonFetch(API.product(id));
    render(p);
  } catch (e) {
    root.innerHTML = `<div class="notice bad">Failed to load product: ${escapeHtml(e.message)}</div>`;
  }
}

main();
