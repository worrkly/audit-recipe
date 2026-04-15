// api/track.js
const activityLog = [];
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
    activityLog.unshift(entry);
    if(activityLog.length>MAX) activityLog.pop();
    return res.status(200).json({success:true});
  }

  if(req.method==='GET') {
    if(req.headers['x-admin-key']!==process.env.ADMIN_SECRET) return res.status(401).json({error:'Unauthorized'});
    const {tool,limit=500,offset=0} = req.query;
    let filtered = tool ? activityLog.filter(e=>e.tool===tool) : activityLog;
    return res.status(200).json({total:filtered.length,entries:filtered.slice(+offset,+offset+ +limit),stats:computeStats(activityLog)});
  }
  return res.status(405).json({error:'Method not allowed'});
}

function anonIp(ip) {
  if(ip.includes('.')) { const p=ip.split('.'); return p[0]+'.'+p[1]+'.'+p[2]+'.***'; }
  return ip.substring(0,8)+'***';
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
    last7Days:Object.entries(dailyCounts).sort((a,b)=>a[0].localeCompare(b[0])).slice(-7),
    peakHour:peak?`${peak[0]}:00`:'unknown'};
}