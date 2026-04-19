// api/admin-login.js â Server-side admin authentication
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'findingrecipe2026';
  const SECRET = process.env.ADMIN_SECRET || 'findingrecipe2026';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate HMAC-signed session token (stateless, survives cold starts)
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', SECRET).update(ts).digest('hex');
  const token = ts + ':' + sig;

  return res.status(200).json({ success: true, token });
}
