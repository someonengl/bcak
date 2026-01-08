"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors"); // ✅ ADDED

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
   Helpers
-------------------------- */
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
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
   Init data
-------------------------- */
function initDataFiles() {
  ensureDir(DATA_DIR);

  if (!fs.existsSync(PRODUCTS_FILE)) {
    writeJsonAtomic(PRODUCTS_FILE, {
      updatedAt: nowIso(),
      items: []
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
  return readJsonSafe(PRODUCTS_FILE, { updatedAt: nowIso(), items: [] });
}

function saveProducts(db) {
  db.updatedAt = nowIso();
  writeJsonAtomic(PRODUCTS_FILE, db);
}

function getOrders() {
  return readJsonSafe(ORDERS_FILE, { updatedAt: nowIso(), items: [] });
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
  if (!m) return res.status(401).json({ error: "Missing Bearer token" });

  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    if (payload.role !== "admin") {
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

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));

// ✅ CORS FIX (THIS WAS MISSING)
app.use(cors());
app.options("*", cors()); // ✅ handles OPTIONS preflight

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 240,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

/* -------------------------
   Public API
-------------------------- */
app.get("/api/products", (req, res) => {
  const db = getProducts();
  res.json({ items: db.items, updatedAt: db.updatedAt });
});

app.get("/api/products/:id", (req, res) => {
  const db = getProducts();
  const p = db.items.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(p);
});

app.post("/api/orders", (req, res) => {
  const body = req.body || {};
  if (
    !isNonEmptyString(body.customerName) ||
    !isNonEmptyString(body.customerEmail) ||
    !isNonEmptyString(body.customerPhone) ||
    !isNonEmptyString(body.customerAddress)
  ) {
    return res.status(400).json({ error: "Missing customer fields" });
  }

  const order = {
    id: makeId(),
    createdAt: nowIso(),
    status: "NEW",
    customer: body,
    items: body.items || []
  };

  const db = getOrders();
  db.items.unshift(order);
  saveOrders(db);

  res.json({ ok: true, orderId: order.id });
});

/* -------------------------
   Admin API
-------------------------- */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25
});

app.post("/admin/api/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};

  const userOk = bcrypt.compareSync(username || "", ADMIN_USERNAME_BCRYPT);
  const passOk = bcrypt.compareSync(password || "", ADMIN_PASSWORD_BCRYPT);

  if (!userOk || !passOk) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ ok: true, token: issueAdminToken() });
});

app.get("/admin/api/products", requireAdmin, (req, res) => {
  const db = getProducts();
  res.json({ items: db.items });
});

app.post("/admin/api/products", requireAdmin, (req, res) => {
  const { name, price, logo, description } = req.body || {};
  const p = {
    id: makeId(),
    name: sanitizeText(name, 120),
    price: normalizeMoney(price),
    logo: sanitizeText(logo, 600),
    description: sanitizeText(description, 2000)
  };

  const db = getProducts();
  db.items.unshift(p);
  saveProducts(db);

  res.json({ ok: true, item: p });
});

app.delete("/admin/api/products/:id", requireAdmin, (req, res) => {
  const db = getProducts();
  db.items = db.items.filter(p => p.id !== req.params.id);
  saveProducts(db);
  res.json({ ok: true });
});

/* -------------------------
   Fallback
-------------------------- */
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
