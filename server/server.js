"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "a819d7cd38e9101be2e496298e8bf426ce9cdf78d2af35ddf44c6ad25d50158b";

const ADMIN_USERNAME_BCRYPT =
  "$2b$12$4GBYJIwwVlS1J7PRRk889.a1QvKSaqpcIQZXsMrdzVsbgAKjm8rra";
const ADMIN_PASSWORD_BCRYPT =
  "$2b$12$doMTAHHX0XA9Lmbyw2Id3OvNzPB6N6gjubXVPDFSs7hR/1bDahFNm";

const DATA_DIR = path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

/* -------------------------
   Utilities
-------------------------- */
function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

function nowIso() {
  return new Date().toISOString();
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

function normalizeMoney(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function sanitizeText(x, maxLen = 2000) {
  if (typeof x !== "string") return "";
  const s = x.replace(/\s+/g, " ").trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function makeId() {
  return crypto.randomUUID();
}

/* -------------------------
   Data initialization
-------------------------- */
function initDataFiles() {
  ensureDir(DATA_DIR);

  if (!fs.existsSync(PRODUCTS_FILE)) {
    const demoProducts = [
      {
        id: makeId(),
        name: "Aurora Headphones",
        price: 129.99,
        logo:
          "https://images.unsplash.com/photo-1518441902117-f0a06e2e2f93?auto=format&fit=crop&w=800&q=80",
        description:
          "Premium over-ear headphones with warm bass and long battery life."
      },
      {
        id: makeId(),
        name: "Nebula Keyboard",
        price: 89.5,
        logo:
          "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
        description:
          "Mechanical keyboard with a clean, minimal aesthetic and satisfying switches."
      },
      {
        id: makeId(),
        name: "Prism Smart Lamp",
        price: 54.0,
        logo:
          "https://images.unsplash.com/photo-1504197885-609741792ce7?auto=format&fit=crop&w=800&q=80",
        description:
          "Mood lighting with scenes and schedules. Perfect for desks and bedrooms."
      }
    ];

    writeJsonAtomic(PRODUCTS_FILE, {
      updatedAt: nowIso(),
      items: demoProducts
    });
  }

  if (!fs.existsSync(ORDERS_FILE)) {
    writeJsonAtomic(ORDERS_FILE, {
      updatedAt: nowIso(),
      items: []
    });
  }
}

function getProducts() {
  const db = readJsonSafe(PRODUCTS_FILE, {
    updatedAt: nowIso(),
    items: []
  });
  if (!Array.isArray(db.items)) db.items = [];
  return db;
}

function saveProducts(db) {
  db.updatedAt = nowIso();
  writeJsonAtomic(PRODUCTS_FILE, db);
}

function getOrders() {
  const db = readJsonSafe(ORDERS_FILE, {
    updatedAt: nowIso(),
    items: []
  });
  if (!Array.isArray(db.items)) db.items = [];
  return db;
}

function saveOrders(db) {
  db.updatedAt = nowIso();
  writeJsonAtomic(ORDERS_FILE, db);
}

/* -------------------------
   Auth helpers
-------------------------- */
function issueAdminToken() {
  return jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "2h" });
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* -------------------------
   App setup
-------------------------- */
initDataFiles();

const app = express();

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 240,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

/* -------------------------
   Static websites
-------------------------- */
app.use("/", express.static(path.join(__dirname, "..", "public")));
app.use("/admin", express.static(path.join(__dirname, "..", "admin")));

/* -------------------------
   Public API
-------------------------- */
app.get("/api/products", (req, res) => {
  const db = getProducts();
  res.json({ items: db.items, updatedAt: db.updatedAt });
});

app.get("/api/products/:id", (req, res) => {
  const id = String(req.params.id || "");
  const db = getProducts();
  const p = db.items.find(x => x.id === id);
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(p);
});

app.post("/api/orders", (req, res) => {
  const body = req.body || {};

  const customerName = sanitizeText(body.customerName, 120);
  const customerEmail = sanitizeText(body.customerEmail, 200);
  const customerPhone = sanitizeText(body.customerPhone, 60);
  const customerAddress = sanitizeText(body.customerAddress, 400);
  const items = Array.isArray(body.items) ? body.items : [];

  if (
    !isNonEmptyString(customerName) ||
    !isNonEmptyString(customerEmail) ||
    !isNonEmptyString(customerPhone) ||
    !isNonEmptyString(customerAddress)
  ) {
    return res
      .status(400)
      .json({ error: "Missing required customer fields" });
  }

  if (items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  const productsDb = getProducts();
  const productsById = new Map(
    productsDb.items.map(p => [p.id, p])
  );

  const normalizedItems = [];
  let total = 0;

  for (const it of items) {
    const pid = String(it.productId || "");
    const qty = Number(it.qty || 0);

    if (!pid || !Number.isFinite(qty) || qty <= 0 || qty > 999) {
      return res.status(400).json({ error: "Invalid cart item" });
    }

    const p = productsById.get(pid);
    if (!p) {
      return res.status(400).json({ error: "Product not found: " + pid });
    }

    const unit = normalizeMoney(p.price);
    const line = normalizeMoney(unit * qty);
    total = normalizeMoney(total + line);

    normalizedItems.push({
      productId: p.id,
      name: p.name,
      unitPrice: unit,
      qty,
      lineTotal: line
    });
  }

  const order = {
    id: makeId(),
    createdAt: nowIso(),
    status: "NEW",
    customer: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      address: customerAddress
    },
    items: normalizedItems,
    total
  };

  const ordersDb = getOrders();
  ordersDb.items.unshift(order);
  saveOrders(ordersDb);

  res.json({ ok: true, orderId: order.id, total: order.total });
});

/* -------------------------
   Admin auth + Admin API
-------------------------- */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

app.post("/admin/api/login", loginLimiter, (req, res) => {
  const username = String((req.body || {}).username || "");
  const password = String((req.body || {}).password || "");

  const userOk = bcrypt.compareSync(username, ADMIN_USERNAME_BCRYPT);
  const passOk = bcrypt.compareSync(password, ADMIN_PASSWORD_BCRYPT);

  if (!userOk || !passOk) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = issueAdminToken();
  res.json({ ok: true, token, expiresIn: 2 * 60 * 60 });
});

app.get("/admin/api/products", requireAdmin, (req, res) => {
  const db = getProducts();
  res.json({ items: db.items, updatedAt: db.updatedAt });
});

app.post("/admin/api/products", requireAdmin, (req, res) => {
  const body = req.body || {};

  const name = sanitizeText(body.name, 120);
  const price = normalizeMoney(body.price);
  const logo = sanitizeText(body.logo, 600);
  const description = sanitizeText(body.description, 2000);

  if (!isNonEmptyString(name) || price === null || price < 0) {
    return res.status(400).json({ error: "Invalid product fields" });
  }

  const db = getProducts();
  const p = { id: makeId(), name, price, logo, description };

  db.items.unshift(p);
  saveProducts(db);

  res.json({ ok: true, item: p });
});

app.put("/admin/api/products/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id || "");
  const body = req.body || {};

  const db = getProducts();
  const idx = db.items.findIndex(p => p.id === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });

  const cur = db.items[idx];

  const name =
    body.name !== undefined ? sanitizeText(body.name, 120) : cur.name;
  const price =
    body.price !== undefined ? normalizeMoney(body.price) : cur.price;
  const logo =
    body.logo !== undefined ? sanitizeText(body.logo, 600) : cur.logo;
  const description =
    body.description !== undefined
      ? sanitizeText(body.description, 2000)
      : cur.description;

  if (!isNonEmptyString(name) || price === null || price < 0) {
    return res.status(400).json({ error: "Invalid product fields" });
  }

  db.items[idx] = { ...cur, name, price, logo, description };
  saveProducts(db);

  res.json({ ok: true, item: db.items[idx] });
});

app.delete("/admin/api/products/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id || "");
  const db = getProducts();

  const before = db.items.length;
  db.items = db.items.filter(p => p.id !== id);

  if (db.items.length === before) {
    return res.status(404).json({ error: "Not found" });
  }

  saveProducts(db);
  res.json({ ok: true });
});

app.get("/admin/api/orders", requireAdmin, (req, res) => {
  const db = getOrders();
  res.json({ items: db.items, updatedAt: db.updatedAt });
});

app.put("/admin/api/orders/:id/status", requireAdmin, (req, res) => {
  const id = String(req.params.id || "");
  const status = String((req.body || {}).status || "")
    .toUpperCase()
    .trim();

  const allowed = new Set([
    "NEW",
    "PROCESSING",
    "FULFILLED",
    "CANCELLED"
  ]);

  if (!allowed.has(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const db = getOrders();
  const idx = db.items.findIndex(o => o.id === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });

  db.items[idx].status = status;
  db.items[idx].updatedAt = nowIso();
  saveOrders(db);

  res.json({ ok: true, item: db.items[idx] });
});

/* -------------------------
   Fallback
-------------------------- */
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Marketplace running on http://localhost:${PORT}`);
  console.log(
    `Admin panel at     http://localhost:${PORT}/admin/login.html`
  );
});
