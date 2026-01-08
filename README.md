# Marketplace (No-Code Friendly) — Full Website + Admin Panel (Zip)

This project is a fully working marketplace website with:
- Public storefront (browse products, product page, cart, checkout)
- Separate Admin site (login + dashboard)
- Admin can add / edit / delete products and manage orders
- Products: id, name, price, logo URL, description
- Checkout collects: name, email, phone, address
- Optional EmailJS integration to email the customer after checkout (you paste your EmailJS keys)

## Requirements
- Node.js 18+ (recommended 20+)

## Quick start (local)
1) Open a terminal in the project folder
2) Install dependencies:
   npm install
3) Run:
   npm run start

Then open:
- Storefront: http://localhost:3000/
- Admin:      http://localhost:3000/admin/login.html

## Admin credentials
The admin login expects the following EXACT strings:
- Username: (the long hex string you provided)
- Password: (the long hex string you provided)

They are stored securely as bcrypt hashes in the backend (the plaintext is not stored).

## Data storage
Data is stored in:
- server/data/products.json
- server/data/orders.json

## EmailJS (optional)
This project includes a ready-to-fill EmailJS integration on checkout:
- Edit: public/emailjs-config.js
- Paste your EmailJS public key, service ID, and template ID
- Ensure your EmailJS template uses the variables described in that file

If EmailJS is not configured, checkout still works (orders are saved in orders.json and visible in Admin).

## Security notes (for real deployment)
- Set a strong JWT secret via environment variable:
  - Windows PowerShell:
    $env:JWT_SECRET="your-long-random-secret"
    npm run start
  - macOS/Linux:
    JWT_SECRET="your-long-random-secret" npm run start
- Use HTTPS and a proper reverse proxy if you deploy publicly.
- This is a lightweight demo-grade backend (JSON storage) designed to be easy to run anywhere.
