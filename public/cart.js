"use strict";

import { API, escapeHtml, getCart, jsonFetch, money, removeFromCart, saveCart, setCartBadge, updateQty, toast } from "./lib.js";

const cartArea = document.getElementById("cartArea");
const cartMsg = document.getElementById("cartMsg");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutMsg = document.getElementById("checkoutMsg");
const clearBtn = document.getElementById("clearCart");

let products = [];

function getMap() {
  const m = new Map();
  for (const p of products) m.set(p.id, p);
  return m;
}

function renderCart() {
  setCartBadge();

  const cart = getCart();
  const map = getMap();

  if (!cart.items.length) {
    cartArea.innerHTML = `<div class="notice">Your cart is empty. <a class="pill" href="./index.html" style="margin-left:8px">Browse products</a></div>`;
    cartMsg.innerHTML = "";
    return;
  }

  let total = 0;

  const rows = cart.items.map(it => {
    const p = map.get(it.productId);
    if (!p) return "";
    const qty = Number(it.qty) || 0;
    const line = (Number(p.price) || 0) * qty;
    total += line;
    return `
      <tr>
        <td>
          <div style="font-weight:800">${escapeHtml(p.name)}</div>
          <div class="muted small" style="margin-top:4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;">
            ${escapeHtml(p.id)}
          </div>
        </td>
        <td>${money(p.price || 0)}</td>
        <td style="width:120px">
          <input data-qty="${escapeHtml(p.id)}" type="number" min="0" max="999" value="${qty}"
            style="width:100%; padding:9px 10px; border-radius:12px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text); outline:none"/>
        </td>
        <td>${money(line)}</td>
        <td style="width:110px">
          <button class="btn danger" data-rm="${escapeHtml(p.id)}">Remove</button>
        </td>
      </tr>
    `;
  }).join("");

  cartArea.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Unit</th>
          <th>Qty</th>
          <th>Total</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  cartMsg.innerHTML = `<div class="notice ok"><b>Cart total:</b> ${money(total)}</div>`;

  cartArea.querySelectorAll("input[data-qty]").forEach(inp => {
    inp.addEventListener("change", () => {
      const id = inp.getAttribute("data-qty");
      const v = Number(inp.value);
      if (!Number.isFinite(v) || v < 0 || v > 999) {
        inp.value = "1";
        return;
      }
      updateQty(id, v);
      renderCart();
    });
  });

  cartArea.querySelectorAll("button[data-rm]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-rm");
      removeFromCart(id);
      renderCart();
    });
  });
}

function clearCart() {
  saveCart({ items: [] });
  renderCart();
}

function buildOrderItems() {
  const cart = getCart();
  return cart.items
    .map(it => ({ productId: it.productId, qty: Number(it.qty) || 0 }))
    .filter(it => it.productId && it.qty > 0);
}

function buildItemsText() {
  const cart = getCart();
  const map = getMap();
  const lines = [];
  let total = 0;
  for (const it of cart.items) {
    const p = map.get(it.productId);
    if (!p) continue;
    const qty = Number(it.qty) || 0;
    const lineTotal = (Number(p.price) || 0) * qty;
    total += lineTotal;
    lines.push(`${p.name} x${qty} — ${money(lineTotal)}`);
  }
  return { text: lines.join("\n"), total: money(total) };
}

async function maybeSendEmail(orderId) {
  const cfg = window.EMAILJS_CONFIG;
  const emailjs = window.emailjs;

  if (!cfg || !cfg.enabled) return { sent: false, reason: "EmailJS not enabled" };
  if (!emailjs) return { sent: false, reason: "EmailJS library not loaded (blocked offline?)" };
  if (!cfg.publicKey || !cfg.serviceId || !cfg.templateId) return { sent: false, reason: "EmailJS keys missing" };

  const name = document.getElementById("name").value.trim();
  const to_email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const items = buildItemsText();

  emailjs.init(cfg.publicKey);

  const params = {
    to_email,
    to_name: name,
    order_id: orderId,
    order_total: items.total,
    order_items: items.text,
    customer_phone: phone,
    customer_address: address
  };

  await emailjs.send(cfg.serviceId, cfg.templateId, params);
  return { sent: true };
}

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  checkoutMsg.innerHTML = "";

  const orderItems = buildOrderItems();
  if (!orderItems.length) {
    toast(checkoutMsg, "Your cart is empty.", "bad");
    return;
  }

  const customerName = document.getElementById("name").value.trim();
  const customerEmail = document.getElementById("email").value.trim();
  const customerPhone = document.getElementById("phone").value.trim();
  const customerAddress = document.getElementById("address").value.trim();

  try {
    const result = await jsonFetch(API.orders, {
      method: "POST",
      body: JSON.stringify({
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        items: orderItems
      })
    });

    // Order saved, now email (optional)
    let emailNote = "";
    try {
      const r = await maybeSendEmail(result.orderId);
      if (r.sent) emailNote = " A confirmation email was sent.";
      else emailNote = " (Email not sent: " + r.reason + ")";
    } catch (err) {
      emailNote = " (Email send failed: " + err.message + ")";
    }

    clearCart();
    toast(checkoutMsg, `Order placed! Order ID: ${result.orderId}.${emailNote}`, "ok");

    checkoutForm.reset();
  } catch (err) {
    toast(checkoutMsg, "Checkout failed: " + err.message, "bad");
  }
});

clearBtn.addEventListener("click", clearCart);

async function main() {
  setCartBadge();
  try {
    const data = await jsonFetch(API.products);
    products = Array.isArray(data.items) ? data.items : [];
    renderCart();
  } catch (e) {
    cartArea.innerHTML = `<div class="notice bad">Failed to load products: ${escapeHtml(e.message)}</div>`;
  }
}

main();
