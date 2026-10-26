// lib/staff.js — CRM staff accounts, roles and sessions.
//
// * The owner keeps logging in with ADMIN_PASSWORD (role "owner"); nothing breaks for existing setups.
// * Staff log in with email + password. Passwords: scrypt (N=16384, r=8, p=1) with a per-user random salt.
// * Sessions: 32 random bytes, only their sha256 is stored; 12-hour lifetime; revoked on logout, password
//   reset, deactivation or deletion.
// * Permissions are checked on the server for every request (see can()).

import crypto from 'node:crypto';
import { getClient } from './db.js';

export const ROLES = ['owner', 'admin', 'sales', 'viewer'];
const SESSION_MS = 12 * 3600 * 1000;
const rowsOf = (r) => (r && r.rows) || [];
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// What each role may do. Read = any GET; the rest are POST actions or exports.
const DELETES = new Set(['delete', 'review_delete', 'delete_subscriber']);
const MASS_SEND = new Set(['campaign_send', 'broadcast', 'contact_import', 'ab_create', 'ab_status', 'ab_delete']);
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
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.batch([
    { sql: 'DELETE FROM staff_sessions WHERE expires_at < ?', args: [now] },
    { sql: 'INSERT INTO staff_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', args: [sha(token), u.id, now + SESSION_MS, now] },
    { sql: "UPDATE staff_users SET last_login = datetime('now') WHERE id = ?", args: [u.id] }
  ], 'write');
  return { token: 'st_' + token, user: publicUser(u), expiresAt: now + SESSION_MS };
}

// Bearer "st_<token>" -> user, or null
export async function userForToken(bearer) {
  if (!/^st_[A-Za-z0-9_-]{30,}$/.test(bearer || '')) return null;
  await ensureStaffTables();
  const r = await getClient().execute({ sql: 'SELECT u.* FROM staff_sessions s JOIN staff_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1', args: [sha(bearer.slice(3)), Date.now()] });
  const u = rowsOf(r)[0];
  return u ? publicUser(u) : null;
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
