"use strict";

import { API, addToCart, escapeHtml, jsonFetch, money, setCartBadge } from "./lib.js";

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const qEl = document.getElementById("q");
const sortEl = document.getElementById("sort");

let all = [];

function sortItems(items, mode) {
  const arr = [...items];
  if (mode === "price_asc") arr.sort((a,b) => (a.price ?? 0) - (b.price ?? 0));
  else if (mode === "price_desc") arr.sort((a,b) => (b.price ?? 0) - (a.price ?? 0));
  else if (mode === "name_asc") arr.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""), undefined, { sensitivity: "base" }));
  // "new" keeps file order (admin adds newest first)
  return arr;
}

function filterItems(items, q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return items;
  return items.filter(p => {
    const t = (p.name || "") + " " + (p.description || "");
    return t.toLowerCase().includes(s);
  });
}

function card(p) {
  const img = escapeHtml(p.logo || "");
  const name = escapeHtml(p.name || "Untitled");
  const desc = escapeHtml(p.description || "");
  const price = money(p.price || 0);
  const id = escapeHtml(p.id);

  return `
    <article class="card">
      <a class="img" href="./product.html?id=${encodeURIComponent(p.id)}" aria-label="Open product">
        <img alt="${name}" src="${img}" loading="lazy" onerror="this.style.opacity=.2; this.alt='Image failed to load'"/>
      </a>
      <div class="body">
        <div class="title">${name}</div>
        <div class="desc">${desc}</div>
        <div class="row">
          <div class="price">${price}</div>
          <div class="btns">
            <a class="btn" href="./product.html?id=${encodeURIComponent(p.id)}">Details</a>
            <button class="btn primary" data-add="${id}">Add</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function render() {
  const q = qEl.value;
  const mode = sortEl.value;

  const items = sortItems(filterItems(all, q), mode);
  grid.innerHTML = items.map(card).join("");

  empty.style.display = items.length ? "none" : "block";

  grid.querySelectorAll("button[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-add");
      addToCart(id, 1);
      btn.textContent = "Added";
      setTimeout(() => (btn.textContent = "Add"), 700);
    });
  });
}

async function main() {
  setCartBadge();
  try {
    const data = await jsonFetch(API.products);
    all = Array.isArray(data.items) ? data.items : [];
    render();
  } catch (e) {
    grid.innerHTML = `<div class="notice bad">Failed to load products: ${escapeHtml(e.message)}</div>`;
  }
}

qEl.addEventListener("input", render);
sortEl.addEventListener("change", render);

main();
