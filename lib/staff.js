// lib/staff.js — CRM staff accounts, roles and sessions.
//
// * The owner logs in with ADMIN_PASSWORD (role "owner") until they set their own password on the Account page.
// * Staff log in with email + password. Passwords: scrypt (N=16384, r=8, p=1) with a per-user random salt.
// * Sessions: 32 random bytes, only their sha256 is stored; 12-hour lifetime; revoked on logout, password
//   reset, deactivation or deletion. The browser keeps them in an HttpOnly cookie (see api/admin.js).
// * The owner gets a session too (user_id 0), bound to a fingerprint of the
//   active password (Vercel or Account page): changing it signs every other owner session out.
// * Permissions are checked on the server for every request (see can()).

import crypto from 'node:crypto';
import { getClient } from './db.js';

export const ROLES = ['owner', 'admin', 'sales', 'viewer'];
const SESSION_MS = 12 * 3600 * 1000;
const rowsOf = (r) => (r && r.rows) || [];
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// What each role may do. Read = any GET; the rest are POST actions or exports.
const DELETES = new Set(['delete', 'review_delete', 'delete_subscriber', 'conv_delete']);
const MASS_SEND = new Set(['campaign_send', 'broadcast', 'contact_import', 'ab_create', 'ab_status', 'ab_delete', 'scan_pitches']);
const TEAM = new Set(['team_list', 'team_create', 'team_update', 'team_reset_password', 'team_delete']);
export function can(role, op) {
  // op: { kind: 'read' | 'export' | 'action', action? }
  if (role === 'owner') return true;
  if (op.kind === 'action' && (op.action === 'change_password' || op.action === 'logout')) return true; // every account, incl. viewers
  if (op.kind === 'action' && TEAM.has(op.action)) return false;
  if (role === 'admin') return true;
  if (op.kind === 'read') return true;
  if (role === 'viewer') return false;
  // sales
  if (op.kind === 'export') return false;
  if (DELETES.has(op.action) || MASS_SEND.has(op.action)) return false;
  return true;
}

let setupPromise = null;
export function ensureStaffTables() {
  if (!setupPromise) setupPromise = (async () => {
    const db = getClient();
    await db.execute(`CREATE TABLE IF NOT EXISTS staff_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'sales', pass_hash TEXT NOT NULL, salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
      must_change INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), last_login TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS staff_sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON staff_sessions(user_id)');
    try { await db.execute('ALTER TABLE staff_sessions ADD COLUMN owner_fp TEXT'); } catch (e) { if (!/duplicate column|already exists/i.test(String(e.message))) throw e; }
  })().catch((e) => { setupPromise = null; throw e; });
  return setupPromise;
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? reject(e) : resolve(k.toString('hex')))));
}
export function strongEnough(pw) { return typeof pw === 'string' && pw.length >= 10 && /[A-Za-z]/.test(pw) && /\d/.test(pw); }
export function generatePassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const b = crypto.randomBytes(14);
  let s = ''; for (const x of b) s += abc[x % abc.length];
  return s.slice(0, 6) + '-' + s.slice(6, 10) + Math.floor(10 + (b[0] % 90));
}
const publicUser = (u) => ({ id: Number(u.id), email: u.email, name: u.name, role: u.role, active: !!Number(u.active), must_change: !!Number(u.must_change), created_at: u.created_at, last_login: u.last_login });

export async function login(email, password) {
  await ensureStaffTables();
  const db = getClient();
  const u = rowsOf(await db.execute({ sql: 'SELECT * FROM staff_users WHERE email = ?', args: [clip(email, 200).toLowerCase()] }))[0];
  // always run scrypt so timing does not reveal whether the email exists
  const hash = await hashPassword(password, u ? u.salt : 'no-such-user-salt');
  if (!u || !Number(u.active) || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.pass_hash, 'hex'))) return null;
  const s = await newSession(u.id, null, { sql: "UPDATE staff_users SET last_login = datetime('now') WHERE id = ?", args: [u.id] });
  return { ...s, user: publicUser(u) };
}

const OWNER = { id: 0, name: 'Owner', email: '', role: 'owner', active: true, must_change: false };

// Owner password. ADMIN_PASSWORD (Vercel) works until the owner sets a password on the Account page; from then on
// a scrypt hash in owner_auth replaces it. The row remembers which ADMIN_PASSWORD was in place when it was set, so
// changing ADMIN_PASSWORD in Vercel later makes the Vercel value win again: the recovery path if both are forgotten.
// Owner sessions carry a fingerprint of the active password, so any change signs every other owner session out.
const envFp = () => sha('env:' + (process.env.ADMIN_PASSWORD || '')).slice(0, 32);
async function ensureOwnerTables() {
  await ensureStaffTables();
  const db = getClient();
  await db.execute(`CREATE TABLE IF NOT EXISTS owner_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1), pass_hash TEXT NOT NULL, salt TEXT NOT NULL, env_fp TEXT NOT NULL, changed_at TEXT NOT NULL)`);
  await db.execute('CREATE TABLE IF NOT EXISTS owner_resets (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)');
}
async function ownerRow() {
  await ensureOwnerTables();
  const r = rowsOf(await getClient().execute('SELECT * FROM owner_auth WHERE id = 1'))[0];
  return r && r.env_fp === envFp() ? r : null;
}
async function ownerFp() {
  const r = await ownerRow();
  return r ? sha('owner:db:' + r.pass_hash).slice(0, 32) : sha('owner:' + (process.env.ADMIN_PASSWORD || '')).slice(0, 32);
}
// Is there any owner password at all (Vercel or Account page)?
export async function ownerConfigured() { return !!process.env.ADMIN_PASSWORD || !!(await ownerRow()); }
export async function ownerPasswordOk(password) {
  const r = await ownerRow();
  if (r) {
    const hash = await hashPassword(password, r.salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(r.pass_hash, 'hex'));
  }
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(String(password || '')).digest(), crypto.createHash('sha256').update(real).digest());
}
const ownerStrong = (pw) => typeof pw === 'string' && pw.length >= 12 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
async function setOwnerPassword(next) {
  if (!ownerStrong(next)) throw Object.assign(new Error('Use at least 12 characters, with letters and numbers'), { status: 400 });
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await hashPassword(next, salt);
  await getClient().batch([
    { sql: "INSERT INTO owner_auth (id, pass_hash, salt, env_fp, changed_at) VALUES (1, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET pass_hash = excluded.pass_hash, salt = excluded.salt, env_fp = excluded.env_fp, changed_at = excluded.changed_at", args: [hash, salt, envFp()] },
    { sql: 'DELETE FROM staff_sessions WHERE user_id = 0', args: [] },
    { sql: 'DELETE FROM owner_resets', args: [] }
  ], 'write');
  return { ...(await newSession(0, await ownerFp())), user: OWNER };
}
// Account page: current password + new one. Returns a fresh session for this browser (all others are signed out).
export async function changeOwnerPassword(current, next) {
  if (!(await ownerPasswordOk(current))) throw Object.assign(new Error('Current password is wrong'), { status: 400 });
  if (String(next) === String(current)) throw Object.assign(new Error('Choose a different password'), { status: 400 });
  return setOwnerPassword(next);
}
// Forgot password: a single-use token valid for 30 minutes (only its sha256 is stored).
export async function createOwnerReset() {
  await ensureOwnerTables();
  const token = crypto.randomBytes(32).toString('base64url');
  await getClient().batch([
    { sql: 'DELETE FROM owner_resets', args: [] },
    { sql: 'INSERT INTO owner_resets (token_hash, expires_at) VALUES (?, ?)', args: [sha(token), Date.now() + 30 * 60000] }
  ], 'write');
  return token;
}
export async function resetOwnerPassword(token, next) {
  await ensureOwnerTables();
  const ok = /^[A-Za-z0-9_-]{30,}$/.test(token || '') && rowsOf(await getClient().execute({ sql: 'SELECT 1 FROM owner_resets WHERE token_hash = ? AND expires_at > ?', args: [sha(token), Date.now()] })).length;
  if (!ok) throw Object.assign(new Error('This reset link is invalid or has expired. Request a new one.'), { status: 400 });
  return setOwnerPassword(next); // also deletes the token, so it works once
}
async function newSession(userId, fp, extra) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await getClient().batch([
    { sql: 'DELETE FROM staff_sessions WHERE expires_at < ?', args: [now] },
    { sql: 'INSERT INTO staff_sessions (token_hash, user_id, expires_at, created_at, owner_fp) VALUES (?, ?, ?, ?, ?)', args: [sha(token), userId, now + SESSION_MS, now, fp] },
    ...(extra ? [extra] : [])
  ], 'write');
  return { token: 'st_' + token, expiresAt: now + SESSION_MS };
}
// Owner sign-in with ADMIN_PASSWORD -> a session like everyone else's (the password itself never leaves the login request).
export async function ownerLogin(password) {
  if (!(await ownerPasswordOk(password))) return null;
  return { ...(await newSession(0, await ownerFp())), user: OWNER };
}

// Bearer "st_<token>" -> user, or null
export async function userForToken(bearer) {
  if (!/^st_[A-Za-z0-9_-]{30,}$/.test(bearer || '')) return null;
  await ensureStaffTables();
  const r = await getClient().execute({ sql: 'SELECT s.user_id AS sid_user, s.owner_fp, u.* FROM staff_sessions s LEFT JOIN staff_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?', args: [sha(bearer.slice(3)), Date.now()] });
  const u = rowsOf(r)[0];
  if (!u) return null;
  if (Number(u.sid_user) === 0) return u.owner_fp && (await ownerConfigured()) && u.owner_fp === (await ownerFp()) ? { ...OWNER } : null;
  return u.id != null && Number(u.active) ? publicUser(u) : null;
}
export async function logout(bearer) {
  if (!/^st_/.test(bearer || '')) return;
  await ensureStaffTables();
  await getClient().execute({ sql: 'DELETE FROM staff_sessions WHERE token_hash = ?', args: [sha(bearer.slice(3))] });
}

export async function listStaff() {
  await ensureStaffTables();
  return rowsOf(await getClient().execute('SELECT * FROM staff_users ORDER BY created_at DESC')).map(publicUser);
}
export async function createStaff({ email, name, role }) {
  await ensureStaffTables();
  email = clip(email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address'), { status: 400 });
  if (!ROLES.includes(role) || role === 'owner') throw Object.assign(new Error('Role must be admin, sales or viewer'), { status: 400 });
  const password = generatePassword();
  const salt = crypto.randomBytes(16).toString('hex');
  try {
    await getClient().execute({ sql: 'INSERT INTO staff_users (email, name, role, pass_hash, salt) VALUES (?, ?, ?, ?, ?)', args: [email, clip(name, 120), role, await hashPassword(password, salt), salt] });
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw Object.assign(new Error('A team member with that email already exists'), { status: 409 });
    throw e;
  }
  return { password }; // shown once to the owner, never stored in plain text
}
export async function updateStaff(id, { role, active, name }) {
  await ensureStaffTables();
  const sets = [], args = [];
  if (role !== undefined) { if (!ROLES.includes(role) || role === 'owner') throw Object.assign(new Error('Role must be admin, sales or viewer'), { status: 400 }); sets.push('role = ?'); args.push(role); }
  if (active !== undefined) { sets.push('active = ?'); args.push(active ? 1 : 0); }
  if (name !== undefined) { sets.push('name = ?'); args.push(clip(name, 120)); }
  if (!sets.length) return;
  const db = getClient();
  await db.execute({ sql: `UPDATE staff_users SET ${sets.join(', ')} WHERE id = ?`, args: [...args, id] });
  if (active === false || role !== undefined) await db.execute({ sql: 'DELETE FROM staff_sessions WHERE user_id = ?', args: [id] }); // take effect immediately
}
export async function resetStaffPassword(id) {
  await ensureStaffTables();
  const password = generatePassword(), salt = crypto.randomBytes(16).toString('hex');
  const db = getClient();
  const r = await db.execute({ sql: 'UPDATE staff_users SET pass_hash = ?, salt = ?, must_change = 1 WHERE id = ?', args: [await hashPassword(password, salt), salt, id] });
  if (!r.rowsAffected) throw Object.assign(new Error('Team member not found'), { status: 404 });
  await db.execute({ sql: 'DELETE FROM staff_sessions WHERE user_id = ?', args: [id] });
  const u = rowsOf(await db.execute({ sql: 'SELECT * FROM staff_users WHERE id = ?', args: [id] }))[0];
  return { password, user: u ? publicUser(u) : null };
}
export async function deleteStaff(id) {
  await ensureStaffTables();
  const db = getClient();
  await db.batch([{ sql: 'DELETE FROM staff_sessions WHERE user_id = ?', args: [id] }, { sql: 'DELETE FROM staff_users WHERE id = ?', args: [id] }], 'write');
}
export async function changeOwnPassword(userId, current, next) {
  await ensureStaffTables();
  if (!strongEnough(next)) throw Object.assign(new Error('Use at least 10 characters, with letters and numbers'), { status: 400 });
  const db = getClient();
  const u = rowsOf(await db.execute({ sql: 'SELECT * FROM staff_users WHERE id = ?', args: [userId] }))[0];
  if (!u) throw Object.assign(new Error('Account not found'), { status: 404 });
  const h = await hashPassword(current, u.salt);
  if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.pass_hash, 'hex'))) throw Object.assign(new Error('Current password is wrong'), { status: 400 });
  const salt = crypto.randomBytes(16).toString('hex');
  await db.execute({ sql: 'UPDATE staff_users SET pass_hash = ?, salt = ?, must_change = 0 WHERE id = ?', args: [await hashPassword(next, salt), salt, userId] });
}
