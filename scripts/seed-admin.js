#!/usr/bin/env node
/**
 * ClaimIQ — Seed First Admin Account
 *
 * Creates the initial admin trustee account so you can log in and access
 * the admin dashboard at /admin.
 *
 * Usage:
 *   node scripts/seed-admin.js
 *
 * Environment variables (read from .env if present):
 *   DB_PATH     — path to SQLite database (default: claimiq.db)
 *   ADMIN_EMAIL — email for the admin account (prompted if not set)
 *
 * Example:
 *   ADMIN_EMAIL=planet44555@gmail.com node scripts/seed-admin.js
 */

'use strict';

const path = require('path');
const fs = require('fs');
const readline = require('readline');

// ─── Load .env if present ─────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
  console.log('Loaded .env');
}

// ─── Dependencies ─────────────────────────────────────────────────────────────
let Database, bcrypt;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 not found. Run: npm install');
  process.exit(1);
}
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  console.error('bcryptjs not found. Run: npm install');
  process.exit(1);
}

// ─── DB path ──────────────────────────────────────────────────────────────────
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'claimiq.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at: ${dbPath}`);
  console.error('Start the server at least once to create the database, then run this script.');
  process.exit(1);
}

const db = new Database(dbPath);

// ─── Prompt helper ────────────────────────────────────────────────────────────
function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Hide input
    process.stdout.write(question);
    const stdin = process.openStdin();
    let password = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function handler(char) {
      char = char + '';
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        rl.close();
        resolve(password);
      } else if (char === '\u0003') {
        process.exit();
      } else if (char === '\u007f') {
        password = password.slice(0, -1);
      } else {
        password += char;
        process.stdout.write('*');
      }
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ClaimIQ — Seed Admin Account');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Database: ${dbPath}`);
  console.log('');

  // Check for existing admins
  const existingAdmins = db.prepare("SELECT id, email FROM trustees WHERE isAdmin = 1").all();
  if (existingAdmins.length > 0) {
    console.log('Existing admin accounts:');
    existingAdmins.forEach(a => console.log(`  • ${a.email} (id: ${a.id})`));
    console.log('');
    const cont = await prompt('An admin already exists. Create another? (y/N): ');
    if (cont.toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Gather info
  const defaultEmail = process.env.ADMIN_EMAIL || '';
  const email = await prompt(`Admin email${defaultEmail ? ` [${defaultEmail}]` : ''}: `) || defaultEmail;
  if (!email || !email.includes('@')) {
    console.error('Invalid email address.');
    process.exit(1);
  }

  const name = await prompt('Full name: ');
  if (!name) {
    console.error('Name is required.');
    process.exit(1);
  }

  const firm = await prompt('Firm name [ClaimIQ]: ') || 'ClaimIQ';
  const phone = await prompt('Phone (optional): ') || null;

  let password;
  try {
    password = await promptPassword('Password (min 8 chars): ');
  } catch (e) {
    // Fallback for environments without TTY
    password = await prompt('Password (min 8 chars): ');
  }

  if (!password || password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  let confirmPass;
  try {
    confirmPass = await promptPassword('Confirm password: ');
  } catch (e) {
    confirmPass = await prompt('Confirm password: ');
  }

  if (password !== confirmPass) {
    console.error('Passwords do not match.');
    process.exit(1);
  }

  // Check if email already taken
  const existing = db.prepare("SELECT id FROM trustees WHERE email = ?").get(email);
  if (existing) {
    console.log(`\nUser with email ${email} already exists (id: ${existing.id}).`);
    const upgrade = await prompt('Upgrade this account to admin? (y/N): ');
    if (upgrade.toLowerCase() === 'y') {
      const hash = await bcrypt.hash(password, 12);
      db.prepare("UPDATE trustees SET passwordHash = ?, isAdmin = 1, name = ?, firm = ? WHERE id = ?")
        .run(hash, name, firm, existing.id);
      console.log(`\n✓ Account upgraded to admin: ${email}`);
    } else {
      console.log('Aborted.');
    }
    process.exit(0);
  }

  // Hash password
  console.log('\nHashing password...');
  const passwordHash = await bcrypt.hash(password, 12);

  // Insert admin
  const now = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO trustees (email, passwordHash, name, firm, phone, isAdmin, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)"
  ).run(email, passwordHash, name, firm, phone, now);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✓ Admin account created!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ID:    ${result.lastInsertRowid}`);
  console.log(`  Email: ${email}`);
  console.log(`  Name:  ${name}`);
  console.log(`  Firm:  ${firm}`);
  console.log('');
  console.log('Log in at /auth and navigate to /admin to access the dashboard.');
  console.log('');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
