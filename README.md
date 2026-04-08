# Audit Recipe
### Internal Audit Platform by Worrkly

Two tools in one platform:
- **Finding Builder** — AI-powered IIA audit observation generator
- **Report Builder** — Full audit report builder with Word export

---

## Project Structure

```
auditrecipe/
├── api/
│   └── generate.js          ← Secure Claude API proxy (Vercel serverless)
├── public/
│   ├── index.html           ← Home page
│   ├── finding-builder.html ← Finding Builder tool
│   ├── report-builder.html  ← Report Builder tool
│   ├── admin-login.html     ← Admin login (separate, no public nav link)
│   └── admin-dashboard.html ← Admin dashboard
├── .env.example             ← Environment variables reference
├── package.json
└── vercel.json              ← Vercel routing config
```

---

## Deploy to Vercel — Step by Step

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit — Audit Recipe"
git remote add origin https://github.com/YOUR_USERNAME/audit-recipe.git
git push -u origin main
```

### 2. Connect to Vercel
1. Go to vercel.com → New Project
2. Import your GitHub repo
3. Framework Preset: **Other**
4. Root Directory: leave as `/`
5. Click **Deploy**

### 3. Add Environment Variable
In Vercel → Project Settings → Environment Variables:
```
ANTHROPIC_API_KEY = sk-ant-your-actual-key-here
```
Apply to: Production, Preview, Development

### 4. Connect Custom Domain (GoDaddy)
In Vercel → Project Settings → Domains:
- Add `auditrecipe.com`
- Vercel gives you DNS records to copy

In GoDaddy → DNS Management:
- Add the A record and CNAME that Vercel provides
- Takes 5–30 minutes to propagate

---

## Local Development

```bash
npm install -g vercel
vercel dev
```
This runs the serverless functions locally at `http://localhost:3000`

Create `.env.local` from `.env.example` and add your API key.

---

## Admin Credentials
- URL: `auditrecipe.com/admin-login.html`
- Username: `admin`
- Password: `findingrecipe2026`

⚠️ Change the password in `admin-login.html` before going live.

---

## Tech Stack
- Frontend: Plain HTML/CSS/JS — no build step needed
- Backend: Vercel Serverless Functions (Node.js 18)
- AI: Anthropic Claude Sonnet (claude-sonnet-4-20250514)
- Storage: Browser localStorage (history, attempt tracking)
- Hosting: Vercel
- Domain: GoDaddy → Vercel

---

## Attempt Limiting
- 5 generations per week per browser (shared across both tools)
- Resets every Monday at midnight
- Tracked via localStorage key `fr_attempts`
- Admin can monitor usage in the admin dashboard

---

Built by Worrkly · 2026
