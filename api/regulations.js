// api/regulations.js
// Persistent regulation storage via Vercel KV (Redis)
// Falls back to in-memory Map if KV env vars not configured
import { verifyAdminToken } from './admin-verify.js';

/* --- Storage layer --------------------------------------- */
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_AVAILABLE = !!(KV_URL && KV_TOKEN);

// Fallback in-memory store (only survives a single warm invocation)
const memStore = new Map();

async function kvFetch(path, opts = {}) {
  const res = await fetch(`${KV_URL}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KV_TOKEN}`, ...(opts.headers || {}) }
  });
  return res.json();
}

async function storeGet(key) {
  if (!KV_AVAILABLE) return memStore.get(key) || null;
  const { result } = await kvFetch(`/get/${encodeURIComponent(key)}`);
  return result ? (typeof result === 'string' ? JSON.parse(result) : result) : null;
}

async function storeSet(key, value) {
  if (!KV_AVAILABLE) { memStore.set(key, value); return; }
  await kvFetch(`/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value))
  });
}

async function storeDel(key) {
  if (!KV_AVAILABLE) { memStore.delete(key); return; }
  await kvFetch(`/del/${encodeURIComponent(key)}`, { method: 'POST' });
}

/* --- Keys ------------------------------------------------ */
const INDEX_KEY = 'audit_regs:index';
const dataKey = (id) => `audit_regs:${id}`;

/* --- API handler ----------------------------------------- */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminKey = req.headers['x-admin-key'];
  const ADMIN_SECRET = process.env.ADMIN_SECRET || 'findingrecipe2026';

  if (req.method !== 'GET' && adminKey !== ADMIN_SECRET && !verifyAdminToken(adminKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  /* -- GET: list regulations -- */
  if (req.method === 'GET') {
    const index = (await storeGet(INDEX_KEY)) || [];
    return res.status(200).json({ regulations: index });
  }

  /* -- POST: upload regulation -- */
  if (req.method === 'POST') {
    const { title, category, issuer, version, text, filename } = req.body;
    if (!title || !text) return res.status(400).json({ error: 'title and text required' });

    const chunks = chunkText(text, 500);
    const id = 'reg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const regulation = {
      id, title,
      category: category || 'general',
      issuer: issuer || '',
      version: version || '',
      filename: filename || title,
      uploadedAt: new Date().toISOString(),
      size: text.length,
      chunks,
      fullText: text
    };

    // Store full regulation data
    await storeSet(dataKey(id), regulation);

    // Update index (metadata only - no fullText/chunks)
    const index = (await storeGet(INDEX_KEY)) || [];
    index.push({
      id, title,
      category: regulation.category,
      issuer: regulation.issuer,
      version: regulation.version,
      uploadedAt: regulation.uploadedAt,
      chunkCount: chunks.length,
      size: text.length
    });
    await storeSet(INDEX_KEY, index);

    return res.status(200).json({ success: true, id, chunkCount: chunks.length });
  }

  /* -- DELETE: remove regulation -- */
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(404).json({ error: 'Not found' });

    await storeDel(dataKey(id));

    const index = (await storeGet(INDEX_KEY)) || [];
    const newIndex = index.filter(r => r.id !== id);
    await storeSet(INDEX_KEY, newIndex);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/* --- Helpers --------------------------------------------- */
function chunkText(text, chunkSize = 500) {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const chunks = []; let current = ''; let index = 0;
  for (const s of sentences) {
    if ((current + s).length > chunkSize && current) {
      chunks.push({ text: current.trim(), index: index++ });
      current = s + ' ';
    } else current += s + ' ';
  }
  if (current.trim()) chunks.push({ text: current.trim(), index: index });
  return chunks;
}

/* --- Exports for advisory.js ----------------------------- */
export async function getAllRegulations(filterIds) {
  const index = (await storeGet(INDEX_KEY)) || [];
  const ids = filterIds?.length ? index.filter(m => filterIds.includes(m.id)) : index;
  const regs = [];
  for (const meta of ids) {
    const reg = await storeGet(dataKey(meta.id));
    if (reg) regs.push(reg);
  }
  return regs;
}

