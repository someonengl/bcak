"use strict";

const TOKEN_KEY = "novamarket_admin_token_v1";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
function requireTokenOrRedirect() {
  if (!getToken()) window.location.href = "./login.html";
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function notice(container, text, kind = "ok") {
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = `notice ${kind === "bad" ? "bad" : "ok"}`;
  div.textContent = text;
  container.appendChild(div);
}

async function adminJson(url, opts = {}) {
  const token = getToken();
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(opts.headers || {})
    },
    ...opts
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (res.status === 401) {
    clearToken();
    window.location.href = "./login.html";
    return;
  }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

requireTokenOrRedirect();

/* Tabs */
const tabProducts = document.getElementById("tabProducts");
const tabOrders = document.getElementById("tabOrders");
const sectionProducts = document.getElementById("sectionProducts");
const sectionOrders = document.getElementById("sectionOrders");
const globalMsg = document.getElementById("globalMsg");

function showTab(which) {
  const prod = which === "products";
  tabProducts.classList.toggle("active", prod);
  tabOrders.classList.toggle("active", !prod);
  sectionProducts.style.display = prod ? "" : "none";
  sectionOrders.style.display = prod ? "none" : "";
}
tabProducts.addEventListener("click", () => showTab("products"));
tabOrders.addEventListener("click", () => showTab("orders"));

/* Logout */
document.getElementById("logoutBtn").addEventListener("click", () => {
  clearToken();
  window.location.href = "./login.html";
});

/* Products */
const productForm = document.getElementById("productForm");
const productMsg = document.getElementById("productMsg");
const productsTableWrap = document.getElementById("productsTableWrap");
const filterProducts = document.getElementById("filterProducts");
const refreshProductsBtn = document.getElementById("refreshProducts");

const pid = document.getElementById("pid");
const pname = document.getElementById("pname");
const pprice = document.getElementById("pprice");
const plogo = document.getElementById("plogo");
const pdesc = document.getElementById("pdesc");
const formTitle = document.getElementById("formTitle");
const cancelEdit = document.getElementById("cancelEdit");
const resetFormBtn = document.getElementById("resetForm");

let products = [];

function resetForm() {
  pid.value = "";
  pname.value = "";
  pprice.value = "";
  plogo.value = "";
  pdesc.value = "";
  formTitle.textContent = "Add product";
  cancelEdit.style.display = "none";
}

function setEdit(p) {
  pid.value = p.id;
  pname.value = p.name || "";
  pprice.value = String(p.price ?? "");
  plogo.value = p.logo || "";
  pdesc.value = p.description || "";
  formTitle.textContent = "Edit product";
  cancelEdit.style.display = "";
}

cancelEdit.addEventListener("click", resetForm);
resetFormBtn.addEventListener("click", resetForm);

function filteredProducts() {
  const q = filterProducts.value.trim().toLowerCase();
  if (!q) return products;
  return products.filter(p => {
    const t = (p.name || "") + " " + (p.description || "") + " " + (p.id || "");
    return t.toLowerCase().includes(q);
  });
}

function renderProducts() {
  const items = filteredProducts();
  if (!items.length) {
    productsTableWrap.innerHTML = `<div class="notice">No products.</div>`;
    return;
  }

  const rows = items.map(p => `
    <tr>
      <td>
        <div style="display:flex; gap:10px; align-items:center">
          <div style="width:42px;height:42px;border-radius:12px;overflow:hidden;border:1px solid var(--border);background:rgba(255,255,255,.03)">
            ${p.logo ? `<img src="${esc(p.logo)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.opacity=.2">` : ""}
          </div>
          <div>
            <div style="font-weight:900">${esc(p.name || "Untitled")}</div>
            <div class="code">${esc(p.id)}</div>
          </div>
        </div>
      </td>
      <td>${Number(p.price ?? 0).toFixed(2)}</td>
      <td class="muted small">${esc((p.description || "").slice(0, 90))}${(p.description||"").length>90?"…":""}</td>
      <td style="white-space:nowrap">
        <button class="btn" data-edit="${esc(p.id)}">Edit</button>
        <button class="btn danger" data-del="${esc(p.id)}">Delete</button>
      </td>
    </tr>
  `).join("");

  productsTableWrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Price</th>
          <th>Description</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  productsTableWrap.querySelectorAll("button[data-edit]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-edit");
      const p = products.find(x => x.id === id);
      if (p) setEdit(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  productsTableWrap.querySelectorAll("button[data-del]").forEach(b => {
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-del");
      const p = products.find(x => x.id === id);
      if (!p) return;
      if (!confirm(`Delete product: ${p.name}?`)) return;

      try {
        await adminJson(`/admin/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
        notice(productMsg, "Deleted.", "ok");
        await loadProducts();
      } catch (e) {
        notice(productMsg, "Delete failed: " + e.message, "bad");
      }
    });
  });
}

async function loadProducts() {
  const data = await adminJson("/admin/api/products");
  products = Array.isArray(data.items) ? data.items : [];
  renderProducts();
}

filterProducts.addEventListener("input", renderProducts);
refreshProductsBtn.addEventListener("click", () => loadProducts().catch(e => notice(globalMsg, e.message, "bad")));

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  productMsg.innerHTML = "";

  const body = {
    name: pname.value.trim(),
    price: pprice.value.trim(),
    logo: plogo.value.trim(),
    description: pdesc.value.trim()
  };

  try {
    if (pid.value) {
      await adminJson(`/admin/api/products/${encodeURIComponent(pid.value)}`, {
        method: "PUT",
        body: JSON.stringify(body)
      });
      notice(productMsg, "Updated product.", "ok");
    } else {
      await adminJson("/admin/api/products", {
        method: "POST",
        body: JSON.stringify(body)
      });
      notice(productMsg, "Created product.", "ok");
    }

    resetForm();
    await loadProducts();
  } catch (err) {
    notice(productMsg, err.message, "bad");
  }
});

/* Orders */
const refreshOrdersBtn = document.getElementById("refreshOrders");
const exportCsvBtn = document.getElementById("exportCsv");
const filterOrders = document.getElementById("filterOrders");
const ordersTableWrap = document.getElementById("ordersTableWrap");
const orderDetails = document.getElementById("orderDetails");
const orderActions = document.getElementById("orderActions");

let orders = [];
let selectedOrderId = "";

function filteredOrders() {
  const q = filterOrders.value.trim().toLowerCase();
  if (!q) return orders;
  return orders.filter(o => {
    const t = (o.id||"") + " " + (o.status||"") + " " +
      (o.customer?.name||"") + " " + (o.customer?.email||"");
    return t.toLowerCase().includes(q);
  });
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "";
  }
}

function renderOrders() {
  const items = filteredOrders();
  if (!items.length) {
    ordersTableWrap.innerHTML = `<div class="notice">No orders.</div>`;
    return;
  }

  const rows = items.map(o => `
    <tr data-open="${esc(o.id)}" style="cursor:pointer">
      <td>
        <div style="font-weight:900">${esc(o.id)}</div>
        <div class="muted small">${esc(formatDate(o.createdAt))}</div>
      </td>
      <td><span class="pill" style="border-radius:12px">${esc(o.status || "NEW")}</span></td>
      <td>
        <div style="font-weight:800">${esc(o.customer?.name || "")}</div>
        <div class="muted small">${esc(o.customer?.email || "")}</div>
      </td>
      <td>${Number(o.total ?? 0).toFixed(2)}</td>
    </tr>
  `).join("");

  ordersTableWrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Status</th>
          <th>Customer</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  ordersTableWrap.querySelectorAll("tr[data-open]").forEach(tr => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-open");
      selectOrder(id);
    });
  });
}

async function loadOrders() {
  const data = await adminJson("/admin/api/orders");
  orders = Array.isArray(data.items) ? data.items : [];
  renderOrders();
  if (selectedOrderId) selectOrder(selectedOrderId, false);
}

function selectOrder(id, scroll = true) {
  selectedOrderId = id;
  const o = orders.find(x => x.id === id);
  if (!o) {
    orderDetails.textContent = "Order not found (maybe deleted).";
    orderActions.innerHTML = "";
    return;
  }

  const itemsHtml = (o.items || []).map(it => `
    <tr>
      <td>${esc(it.name || it.productId)}</td>
      <td>${Number(it.unitPrice ?? 0).toFixed(2)}</td>
      <td>${esc(it.qty)}</td>
      <td>${Number(it.lineTotal ?? 0).toFixed(2)}</td>
    </tr>
  `).join("");

  orderDetails.innerHTML = `
    <div class="notice">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:900">Order</div>
          <div class="code">${esc(o.id)}</div>
        </div>
        <div>
          <div style="font-weight:900">Created</div>
          <div class="muted small">${esc(formatDate(o.createdAt))}</div>
        </div>
        <div>
          <div style="font-weight:900">Total</div>
          <div>${Number(o.total ?? 0).toFixed(2)}</div>
        </div>
      </div>
    </div>

    <div class="hr"></div>

    <div style="font-weight:900;margin-bottom:6px">Customer</div>
    <div class="muted small">
      <div><b>Name:</b> ${esc(o.customer?.name || "")}</div>
      <div><b>Email:</b> ${esc(o.customer?.email || "")}</div>
      <div><b>Phone:</b> ${esc(o.customer?.phone || "")}</div>
      <div><b>Address:</b> ${esc(o.customer?.address || "")}</div>
    </div>

    <div class="hr"></div>

    <div style="font-weight:900;margin-bottom:6px">Items</div>
    <table class="table">
      <thead>
        <tr>
          <th>Item</th><th>Unit</th><th>Qty</th><th>Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  `;

  const current = (o.status || "NEW").toUpperCase();
  orderActions.innerHTML = `
    <div class="row" style="justify-content:flex-start;gap:10px;flex-wrap:wrap">
      <div class="field">
        <span class="muted">Status</span>
        <select id="statusSel">
          ${["NEW","PROCESSING","FULFILLED","CANCELLED"].map(s => `<option value="${s}" ${s===current?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
      <button class="btn primary" id="saveStatus">Save</button>
    </div>
    <div id="orderMsg" style="margin-top:12px"></div>
  `;

  document.getElementById("saveStatus").addEventListener("click", async () => {
    const s = document.getElementById("statusSel").value;
    const orderMsg = document.getElementById("orderMsg");
    orderMsg.innerHTML = "";
    try {
      await adminJson(`/admin/api/orders/${encodeURIComponent(id)}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: s })
      });
      notice(orderMsg, "Status updated.", "ok");
      await loadOrders();
    } catch (e) {
      notice(orderMsg, "Update failed: " + e.message, "bad");
    }
  });

  if (scroll) {
    orderDetails.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

filterOrders.addEventListener("input", renderOrders);
refreshOrdersBtn.addEventListener("click", () => loadOrders().catch(e => notice(globalMsg, e.message, "bad")));

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

exportCsvBtn.addEventListener("click", () => {
  const rows = [
    ["order_id","created_at","status","total","customer_name","customer_email","customer_phone","customer_address","items"]
  ];

  for (const o of orders) {
    const items = (o.items || []).map(it => `${it.name} x${it.qty}`).join(" | ");
    rows.push([
      o.id,
      o.createdAt,
      o.status,
      String(o.total ?? ""),
      o.customer?.name ?? "",
      o.customer?.email ?? "",
      o.customer?.phone ?? "",
      o.customer?.address ?? "",
      items
    ]);
  }

  const csv = rows.map(r => r.map(v => {
    const s = String(v ?? "");
    return `"${s.replaceAll('"','""')}"`;
  }).join(",")).join("\n");

  download(`orders_${new Date().toISOString().slice(0,10)}.csv`, csv);
});

/* Boot */
(async function main() {
  try {
    await loadProducts();
    await loadOrders();
  } catch (e) {
    notice(globalMsg, e.message, "bad");
  }
})();
