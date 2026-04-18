// api/advisory.js
import Anthropic from '@anthropic-ai/sdk';
import { getAllRegulations } from './regulations.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, regulationIds } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Fetch regulations from persistent store (KV)
  const allRegs = await getAllRegulations(regulationIds);
  const relevant = searchRegulations(question, allRegs);

  if (!relevant.length) {
    return res.status(200).json({
      answer: 'This specific question is not covered in the currently uploaded regulation database. Please ensure the relevant regulation has been uploaded by the administrator.',
      citations: [], confidence: 0, riskFlag: 'unknown', relatedClauses: [],
      disclaimer: 'Advisory only. Consult legal counsel for binding interpretation.'
    });
  }

  const context = relevant.map(c => `[${c.title} | ${c.issuer} | ${c.version}]\n${c.text}`).join('\n\n---\n\n');

  const sys = `You are a senior regulatory compliance advisor for banking and financial services.
STRICT RULES:
1. Answer ONLY from the regulation context provided - never from general knowledge
2. Always cite exact regulation title, issuer, version, and clause/section
3. If not in context say: "This question is not covered in the uploaded regulation database."
4. Identify risk level: critical/high/medium/low
5. List related clauses if found
6. Respond in same language as the question
7. End with: "Advisory only. Consult legal counsel for binding interpretation."

REGULATION DATABASE:
${context}

Respond ONLY with valid JSON:
{"answer":"<answer>","citations":[{"regulation":"","issuer":"","version":"","clause":"","excerpt":""}],"confidence":<0-100>,"riskFlag":"critical|high|medium|low|none","relatedClauses":[],"disclaimer":"Advisory only. Consult legal counsel."}`;

  try {
    const r = await client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 2000,
      system: sys, messages: [{ role: 'user', content: `Question: ${question}` }]
    });
    const raw = r.content[0]?.text || '';
    let parsed;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : raw);
    } catch (e) {
      parsed = {
        answer: raw,
        citations: relevant.slice(0, 2).map(c => ({
          regulation: c.title, issuer: c.issuer, version: c.version,
          clause: 'See regulation', excerpt: c.text.substring(0, 200)
        })),
        confidence: 60, riskFlag: 'medium', relatedClauses: [],
        disclaimer: 'Advisory only.'
      };
    }
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate response: ' + (err.message || 'Unknown error') });
  }
}

function searchRegulations(question, regs) {
  const q = question.toLowerCase();
  const keywords = q.split(/\s+/).filter(w => w.length > 3);
  const results = [];
  for (const reg of regs) {
    for (const chunk of (reg.chunks || [])) {
      const score = keywords.filter(kw => chunk.text.toLowerCase().includes(kw)).length;
      if (score > 0) results.push({ ...chunk, title: reg.title, issuer: reg.issuer, version: reg.version, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 8);
}
