// api/regulations.js
// Regulation storage - in-memory store (upgrade to Vercel KV or Supabase later)
const regulations = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,x-admin-key');
  if(req.method==='OPTIONS') return res.status(200).end();

  const adminKey = req.headers['x-admin-key'];
  if(req.method!=='GET' && adminKey!==process.env.ADMIN_SECRET) {
    return res.status(401).json({error:'Unauthorized'});
  }

  if(req.method==='GET') {
    const list = Array.from(regulations.values()).map(r=>({
      id:r.id, title:r.title, category:r.category, issuer:r.issuer,
      version:r.version, uploadedAt:r.uploadedAt, chunkCount:r.chunks?.length||0, size:r.size
    }));
    return res.status(200).json({regulations:list});
  }

  if(req.method==='POST') {
    const {title,category,issuer,version,text,filename} = req.body;
    if(!title||!text) return res.status(400).json({error:'title and text required'});
    const chunks = chunkText(text,500);
    const id = 'reg_'+Date.now()+'_'+Math.random().toString(36).substr(2,6);
    regulations.set(id,{id,title,category:category||'general',issuer:issuer||'',
      version:version||'',filename:filename||title,uploadedAt:new Date().toISOString(),
      size:text.length,chunks,fullText:text});
    return res.status(200).json({success:true,id,chunkCount:chunks.length});
  }

  if(req.method==='DELETE') {
    const {id} = req.query;
    if(!id||!regulations.has(id)) return res.status(404).json({error:'Not found'});
    regulations.delete(id);
    return res.status(200).json({success:true});
  }

  return res.status(405).json({error:'Method not allowed'});
}

function chunkText(text,chunkSize=500) {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const chunks=[];let current='';let index=0;
  for(const s of sentences) {
    if((current+s).length>chunkSize&&current) {chunks.push({text:current.trim(),index:index++});current=s+' ';}
    else current+=s+' ';
  }
  if(current.trim()) chunks.push({text:current.trim(),index:index});
  return chunks;
}
export {regulations};