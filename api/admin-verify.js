// api/admin-verify.js â Token verification for admin sessions
import crypto from 'crypto';

const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

export function verifyAdminToken(token) {
  const SECRET = process.env.ADMIN_SECRET || 'findingrecipe2026';
  if (!token || typeof token !== 'string' || !token.includes(':')) return false;

  const idx = token.indexOf(':');
  const ts = token.substring(0, idx);
  const sig = token.substring(idx + 1);
  const timestamp = parseInt(ts, 10);
  if (isNaN(timestamp)) return false;

  // Check expiry
  if (Date.now() - timestamp > TOKEN_MAX_AGE) return false;

  // Verify HMAC signature
  const expected = crypto.createHmac('sha256', SECRET).update(ts).digest('hex');
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  return res.status(200).json({ valid: verifyAdminToken(token) });
}
