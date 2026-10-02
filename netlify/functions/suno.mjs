const BASE = 'https://api.sunoapi.org/api/v1';
const reply = (statusCode, data) => ({statusCode, headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(data)});
const messages = {401:'Invalid API key. Check your Suno API key and reconnect.',429:'Not enough credits. Top up your Suno API account.',430:'Too many requests. Wait a moment before trying again.',405:'Rate limit reached. Please wait before retrying.',455:'Suno API is under maintenance. Try again later.'};
function string(value, max, name, required=false) {
  if (value === undefined || value === null) value='';
  if(typeof value !== 'string' || value.length>max || (required&&!value.trim())) throw new Error(`${name} must contain ${required?'1–':'up to '}${max} characters.`);
  return value.trim();
}
export function musicPayload(p, callback) {
  if(!p || typeof p!=='object' || Array.isArray(p)) throw new Error('Invalid music settings.');
  if(!['V6','V6_MINI','V6_WILD'].includes(p.model)) throw new Error('Choose a supported model.');
  if(typeof p.customMode!=='boolean'||typeof p.instrumental!=='boolean') throw new Error('Invalid generation mode.');
  const out={model:p.model,customMode:p.customMode,instrumental:p.instrumental,style:string(p.style,1000,'Style',true),callBackUrl:callback};
  if(!p.customMode) out.prompt=string(p.prompt,3000,'Description',true);
  else {
    out.title=string(p.title,80,'Title');
    out.negativeTags=string(p.negativeTags,1000,'Excluded styles');
    if(!p.instrumental) out.lyrics=string(p.lyrics,5000,'Lyrics',true);
    if(!Number.isInteger(p.duration)||p.duration<10||p.duration>360) throw new Error('Duration must be 10–360 seconds.');
    out.duration=p.duration;
    if(!p.instrumental&&p.vocalGender) {
      if(!['m','f'].includes(p.vocalGender)) throw new Error('Invalid vocal preference.');
      out.vocalGender=p.vocalGender;
    }
    for(const k of ['styleWeight','weirdnessConstraint']) {
      if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<0||p[k]>1) throw new Error('Invalid creative settings.');
      out[k]=Math.round(p[k]*100)/100;
    }
  }
  return out;
}
export async function handler(event) {
  if(event.httpMethod!=='POST') return reply(405,{error:'Use POST.'});
  if((event.body||'').length>24000) return reply(413,{error:'Request too large.'});
  const headers=event.headers||{};
  const key=headers['x-suno-key'];
  if(typeof key!=='string'||!/^[\x21-\x7E]{8,512}$/.test(key)) return reply(401,{error:'Enter a valid Suno API key.'});
  const origin=headers.origin;
  const allowed=[process.env.URL,process.env.DEPLOY_PRIME_URL,process.env.DEPLOY_URL,...(!process.env.NETLIFY?['http://localhost:8888']:[])].filter(Boolean).map(value=>{try{return new URL(value).origin;}catch{return '';}});
  if(!allowed.includes(origin)) return reply(403,{error:'Request origin is not allowed.'});
  if(!headers['content-type']?.startsWith('application/json')) return reply(415,{error:'Use JSON.'});
  let action,payload,path,method='GET',body;
  try {
    const request=JSON.parse(event.body||'{}');
    if(!request||typeof request!=='object'||Array.isArray(request))throw new Error('Invalid request.');
    ({action,payload={}}=request);
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Invalid payload.');
    const callback=`${origin}/.netlify/functions/callback`;
    switch(action) {
      case 'credits': path='/generate/credit'; break;
      case 'generate': path='/generate'; method='POST'; body=musicPayload(payload,callback); break;
      case 'lyrics': path='/lyrics';method='POST';body={prompt:string(payload.prompt,200,'Lyrics idea',true),callBackUrl:callback};break;
      case 'music-status': case 'lyrics-status': {
        const taskId=string(payload.taskId,160,'Task ID',true);
        if(!/^[a-zA-Z0-9_-]+$/.test(taskId)) throw new Error('Invalid task ID.');
        path=`/${action==='music-status'?'generate':'lyrics'}/record-info?taskId=${encodeURIComponent(taskId)}`;break;
      }
      default: throw new Error('Unknown action.');
    }
  } catch(e) {return reply(400,{error:e.message});}
  try {
    const response=await fetch(BASE+path,{method,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000),redirect:'error'});
    const result=await response.json();
    if(!response.ok||result.code!==200) {
      const code=result.code||response.status;
      return reply(code===401?401:code===429||code===430||code===405?429:502,{error:messages[code]||'Suno API could not complete the request. Check your settings or try again later.',providerCode:code});
    }
    // Return only expected data, never provider parameters that could contain credentials.
    if(action==='generate'||action==='lyrics') {
      if(typeof result.data?.taskId!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(result.data.taskId)) return reply(502,{error:'The provider did not return a task ID.'});
      return reply(200,{data:{taskId:result.data.taskId}});
    }
    if(action==='credits') {
      const balance=typeof result.data==='number'?result.data:result.data?.credits??result.data?.remainingCredits;
      if(typeof balance!=='number'||!Number.isFinite(balance)||balance<0)return reply(502,{error:'The provider returned an invalid credit balance.'});
      return reply(200,{data:balance});
    }
    if(typeof result.data?.status!=='string')return reply(502,{error:'The provider returned invalid task status.'});
    return reply(200,{data:{status:result.data?.status,response:result.data?.response,errorCode:result.data?.errorCode,errorMessage:result.data?.errorMessage?'The provider could not finish this task. Please try a different prompt.':null}});
  } catch {return reply(502,{error:'Could not reach Suno API. Check your connection and try again. If you submitted a generation, do not resubmit until you have checked whether it was accepted.'});}
}
