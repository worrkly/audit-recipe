// api/track.js â activity log with Vercel KV persistence
import { kv } from '@vercel/kv';
const KV_KEY = 'activity_log';
const MAX = 10000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,x-admin-key');
  if(req.method==='OPTIONS') return res.status(200).end();

  if(req.method==='POST') {
    const {tool,action,metadata} = req.body;
    if(!tool||!action) return res.status(400).json({error:'tool and action required'});
    const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.headers['x-real-ip']||'unknown');
    const entry = {
      id:'log_'+Date.now()+'_'+Math.random().toString(36).substr(2,5),
      tool, action, ip:anonIp(ip), timestamp:new Date().toISOString(),
      metadata:sanitize(tool,metadata)
    };
    try {
      const log = (await kv.get(KV_KEY)) || [];
      log.unshift(entry);
      if(log.length>MAX) log.length=MAX;
      await kv.set(KV_KEY, log);
    } catch(e) { console.error('KV write error:',e); }
    return res.status(200).json({success:true});
  }

  if(req.method==='GET') {
    const ADMIN_SECRET = process.env.ADMIN_SECRET || 'findingrecipe2026';
    if(req.headers['x-admin-key']!==ADMIN_SECRET) return res.status(401).json({error:'Unauthorized'});
    const {tool,limit=500,offset=0} = req.query;
    let log = [];
    try { log = (await kv.get(KV_KEY)) || []; } catch(e) { console.error('KV read error:',e); }
    let filtered = tool ? log.filter(e=>e.tool===tool) : log;
    return res.status(200).json({total:filtered.length,entries:filtered.slice(+offset,+offset+ +limit),stats:computeStats(log)});
  }

  return res.status(405).json({error:'Method not allowed'});
}

function anonIp(ip) {
  if(ip.includes('.')) { const p=ip.split('.'); return p[0]+'.'+p[1]+'.'+p[2]+'.*'; }
  return ip.substring(0,8)+'****';
}

function sanitize(tool,meta) {
  const schemas = {
    finding_builder:['riskLevel','findingCount','auditArea'],
    report_builder:['reportType','sectionCount'],
    standards_ai:['standardUsed','auditMode','breachCount','totalRequirements'],
    compliance_advisory:['regulationCount','questionLength','citationCount','confidence'],
    compliance_analyzer:['documentType','analysisType']
  };
  const safe={};
  for(const k of (schemas[tool]||[])) if(meta?.[k]!==undefined) safe[k]=meta[k];
  return safe;
}

function computeStats(log) {
  const toolCounts={},dailyCounts={},hourCounts={};
  for(const e of log) {
    toolCounts[e.tool]=(toolCounts[e.tool]||0)+1;
    const day=e.timestamp.substring(0,10);
    dailyCounts[day]=(dailyCounts[day]||0)+1;
    const h=new Date(e.timestamp).getHours();
    hourCounts[h]=(hourCounts[h]||0)+1;
  }
  const top=Object.entries(toolCounts).sort((a,b)=>b[1]-a[1])[0];
  const peak=Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0];
  return {totalUsage:log.length,toolBreakdown:toolCounts,mostPopularTool:top?.[0]||'none',
    last7Days:Object.entries(dailyCounts).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,7),
    peakHour:peak?.[0]||0};
}
