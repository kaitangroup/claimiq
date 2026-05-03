# ClaimIQ

**Avoidance Action Portfolio Purchase Platform**

ClaimIQ is a full-stack web application that helps attorneys purchase and prosecute bankruptcy preference (§547), fraudulent transfer (§548), and post-petition transfer (§549) claim portfolios from Chapter 7 trustees. The platform provides:

- A public marketing/landing page explaining the purchase program
- A trustee portal for submitting cases and uploading payment data
- AI-powered statistical analysis (ordinary course defense scoring, bid pricing, hours modeling)
- Admin dashboard for reviewing cases, setting purchase offers, and managing trustees
- Automated document generation (demand letters, complaints)
- Email notifications on case submission and offer delivery

---

## Table of Contents

1. [Requirements](#requirements)
2. [Local Development](#local-development)
3. [Environment Variables](#environment-variables)
4. [Production Deploy — DigitalOcean Droplet](#production-deploy--digitalocean-droplet)
5. [First Admin Account](#first-admin-account)
6. [Architecture](#architecture)
7. [Directory Structure](#directory-structure)
8. [Scripts Reference](#scripts-reference)

---

## Requirements

- **Node.js 20+** (LTS)
- **npm 9+**
- **SQLite** (bundled via `better-sqlite3` — no separate install)
- For production: Ubuntu 22.04 droplet, nginx, certbot

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/your-org/claimiq.git
cd claimiq

# 2. Install dependencies
npm install

# 3. Copy environment file and fill in values
cp .env.example .env
# Edit .env with your SMTP credentials, session secret, etc.

# 4. Start the dev server (Express + Vite on port 5000)
npm run dev
```

Visit http://localhost:5000

### Seed the first admin account (local)

```bash
node scripts/seed-admin.js
```

Then log in at http://localhost:5000/#/auth and navigate to `/#/admin`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running.

| Variable        | Required | Description                                                  |
|-----------------|----------|--------------------------------------------------------------|
| `NODE_ENV`      | Yes      | `development` or `production`                                |
| `PORT`          | No       | HTTP port (default: `5000`)                                  |
| `DB_PATH`       | No       | SQLite database file path (default: `claimiq.db`)            |
| `UPLOADS_DIR`   | No       | Upload directory path (default: `uploads/`)                  |
| `SESSION_SECRET`| Yes      | Long random string for session signing                       |
| `SMTP_HOST`     | Yes      | SMTP server hostname                                         |
| `SMTP_PORT`     | Yes      | SMTP server port (usually `587` or `465`)                    |
| `SMTP_SECURE`   | No       | `true` for port 465 SSL, `false` for STARTTLS (default)      |
| `SMTP_USER`     | Yes      | SMTP username / email address                                |
| `SMTP_PASS`     | Yes      | SMTP password or app password                                |
| `EMAIL_FROM`    | No       | From address (default: `SMTP_USER`)                          |
| `ADMIN_EMAIL`   | Yes      | Attorney's email — receives new case notifications and bids  |

**Generating a strong SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Production Deploy — DigitalOcean Droplet

### Step 1: Provision a new droplet

- Ubuntu 22.04 LTS, minimum 1 vCPU / 1 GB RAM (2 GB recommended)
- Add your SSH key during droplet creation
- Point your domain's A record to the droplet IP

### Step 2: Run the setup script (once per server)

This installs Node 20, nginx, certbot, creates the `claimiq` system user, configures nginx + SSL, and installs the systemd service.

```bash
# Copy the script to the server
scp scripts/setup-droplet.sh root@YOUR_DROPLET_IP:/root/

# SSH in and run it
ssh root@YOUR_DROPLET_IP
chmod +x /root/setup-droplet.sh
/root/setup-droplet.sh yourdomain.com your@email.com
```

The script will:
1. Install system dependencies
2. Create `/var/www/claimiq` application directory and `claimiq` user
3. Write nginx site config with SSL, SPA fallback, and security headers
4. Run certbot for Let's Encrypt SSL certificate
5. Install and enable the `claimiq` systemd service

### Step 3: Create the .env file on the server

```bash
ssh root@YOUR_DROPLET_IP
cp /var/www/claimiq/.env.example /var/www/claimiq/.env
nano /var/www/claimiq/.env
# Fill in all production values
```

### Step 4: Deploy

From your local machine:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh root@YOUR_DROPLET_IP yourdomain.com
```

This will:
1. Run `npm ci` + TypeScript check + production build locally
2. Rsync all files (excluding `.env`, `claimiq.db`, `uploads/`, `node_modules/`) to the server
3. Run `npm ci --omit=dev` on the server
4. Restart the systemd service

### Step 5: Seed the admin account

```bash
ssh root@YOUR_DROPLET_IP
cd /var/www/claimiq
node scripts/seed-admin.js
```

### Step 6: Verify

```bash
# Check service status
ssh root@YOUR_DROPLET_IP 'systemctl status claimiq'

# Watch live logs
ssh root@YOUR_DROPLET_IP 'journalctl -u claimiq -f'
```

Navigate to `https://yourdomain.com` to verify the site is live.

### Subsequent Deploys

```bash
./scripts/deploy.sh root@YOUR_DROPLET_IP yourdomain.com
```

The database and uploaded files are preserved between deploys (they are excluded from the rsync).

---

## First Admin Account

After the first deploy, run the seed script to create your admin account:

```bash
# On the server
cd /var/www/claimiq
node scripts/seed-admin.js
```

Or set the `ADMIN_EMAIL` environment variable to skip the email prompt:

```bash
ADMIN_EMAIL=planet44555@gmail.com node scripts/seed-admin.js
```

After creating the account, log in at `https://yourdomain.com/#/auth` and visit `/#/admin` for the admin dashboard.

---

## Architecture

```
Client (React/Vite)          Server (Express)            Storage
────────────────────         ─────────────────           ────────
Landing page             →   GET /api/me             →   SQLite (Drizzle ORM)
Trustee Portal           →   POST /api/auth/*        →   better-sqlite3
Case Detail              →   GET/POST /api/cases     →   claimiq.db
Admin Dashboard          →   GET /api/admin/*        →
Documents page           →   GET /api/documents/*    →   File uploads
                             POST /api/files/upload  →   uploads/
```

### Analysis Engine (`server/analysis.ts`)

- **Ordinary Course Score (0–100):** Compares 90-day pre-petition payments vs. 2-year historical baseline using standard deviation, weighted averages, and range analysis. Higher score = stronger ordinary course defense = lower plaintiff recovery probability.
- **Score bands:** ≥62 = Strong defense, 40–61 = Moderate, <40 = Weak
- **Bid formula:** `grossExpected = faceValue × estimatedRecovery%; net = gross − expectedLegalCost; bid = net × 0.65`
- **Hours model:** $400/hr billing rate; probability-weighted expected hours based on defense strength

### Auth

- bcryptjs (12 rounds) password hashing
- connect-sqlite3 session store (7-day cookie)
- `isAdmin` flag on trustees table for admin access
- `requireAdmin` middleware protects all `/api/admin/*` routes

### Document Generation (`server/docgen.ts`)

Generates court-ready:
- §547 Demand Letter
- §547 Preference Complaint
- §548 Fraudulent Transfer Complaint
- §549 Post-Petition Transfer Complaint

---

## Directory Structure

```
claimiq/
├── client/                   # React frontend (Vite)
│   └── src/
│       ├── App.tsx            # Routes: /, /auth, /portal, /case/:id, /documents, /admin
│       ├── pages/
│       │   ├── Landing.tsx    # Public marketing page
│       │   ├── Auth.tsx       # Login / register
│       │   ├── Portal.tsx     # Trustee dashboard
│       │   ├── CaseDetail.tsx # Case analysis view
│       │   ├── Documents.tsx  # Document generator
│       │   └── Admin.tsx      # Admin dashboard
│       ├── components/
│       │   └── Navbar.tsx
│       └── lib/
│           └── queryClient.ts  # apiRequest + API_BASE
├── server/
│   ├── index.ts               # Express entry point
│   ├── routes.ts              # All API endpoints
│   ├── storage.ts             # Drizzle ORM CRUD layer
│   ├── analysis.ts            # Statistical analysis engine
│   ├── docgen.ts              # Document generation
│   ├── email.ts               # SMTP email sending
│   └── vite.ts                # Vite dev middleware / static serving
├── shared/
│   └── schema.ts              # Drizzle schema + Zod types
├── scripts/
│   ├── setup-droplet.sh       # One-time server provisioning
│   ├── deploy.sh              # Rsync deploy to DigitalOcean
│   └── seed-admin.js          # Create first admin account
├── uploads/                   # Runtime: uploaded Excel/PDF files (gitignored)
├── claimiq.db                 # Runtime: SQLite database (gitignored)
├── .env                       # Runtime: secrets (gitignored)
├── .env.example               # Environment variable template
└── README.md
```

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (Express + Vite HMR on port 5000) |
| `npm run build` | Type check + production build |
| `npm run check` | TypeScript type check only |
| `node scripts/seed-admin.js` | Create first admin account interactively |
| `./scripts/setup-droplet.sh <domain> <email>` | One-time server provisioning |
| `./scripts/deploy.sh <user@host> [domain]` | Deploy to DigitalOcean droplet |

---

## Competitive Landscape

| Provider | Model | Fee Structure |
|----------|-------|---------------|
| **ASK LLP** | Contingency litigation | 30–55% of recovery (sliding scale by amount) |
| **Hourly counsel** | Litigation | $300–$500/hr, no outcome guarantee |
| **ClaimIQ (this platform)** | Portfolio purchase | Pays trustee upfront at 10–25% of face value; attorney keeps 100% of recovery |

The ClaimIQ model eliminates collection risk and cost risk for the estate — trustees receive immediate cash rather than waiting 2–3 years for contingency recoveries.

---

## Legal Notes

- Portfolio purchase of avoidance action claims is permissible in the **5th, 8th, and 9th Circuits**
- Not currently permissible in the **6th Circuit**
- Always confirm circuit-specific rules before executing a portfolio purchase agreement
- Attorney is licensed: Florida Bar + New York Bar

---

## License

Proprietary — All rights reserved. Not for redistribution.
