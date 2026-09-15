import { ASSETS } from './assets.mjs';
const FEED='https://raw.githubusercontent.com/Dr-Opara/processpilot/processpilot-agents/processpilot-agents/data/activity.enc.json';
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function decryptEnvelope(envelope,privateJwk){
  if(envelope.version!==1)throw new Error('Unsupported feed version');
  const privateKey=await crypto.subtle.importKey('jwk',privateJwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
  const raw=await crypto.subtle.decrypt({name:'RSA-OAEP'},privateKey,decode(envelope.key));
  const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv)},key,decode(envelope.data));
  const payload=JSON.parse(new TextDecoder().decode(plaintext));
  if(payload.schemaVersion!==1||!Array.isArray(payload.agents)||!Array.isArray(payload.reviews)||!Array.isArray(payload.events)||!Number.isFinite(Date.parse(payload.updatedAt)))throw new Error('Invalid activity data');
  return payload;
}
export default {async fetch(request,env){
  if(!request.headers.get('oai-authenticated-user-id'))return new Response('Sign in to access your private office.',{status:401,headers});
  const path=new URL(request.url).pathname;
  if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers});
  if(path==='/api/activity'){
    if(!env.ACTIVITY_PRIVATE_JWK)return Response.json({error:'Activity connection not configured'},{status:503,headers});
    try{
      const upstream=await fetch(FEED+'?t='+Math.floor(Date.now()/30000),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)});
      if(!upstream.ok)throw new Error('Feed unavailable');
      const envelope=await upstream.json();
      const data=await decryptEnvelope(envelope,JSON.parse(env.ACTIVITY_PRIVATE_JWK));
      try{
        const response=await fetch(FEED.replace('activity.enc.json','reviews.enc.json')+'?t='+Math.floor(Date.now()/30000),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error('Review feed unavailable');
        const reviewData=await decryptEnvelope(await response.json(),JSON.parse(env.ACTIVITY_PRIVATE_JWK));
        if(Date.parse(reviewData.updatedAt)>Date.parse(data.reviewsCheckedAt||data.updatedAt)){
          data.reviews=reviewData.reviews;data.reviewsCheckedAt=reviewData.updatedAt;
          data.events=[...data.events,...reviewData.events].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(-60);
        }
      }catch{data.reviewSyncWarning='Email review feed unavailable; review status may be stale.';}
      return Response.json(data,{headers});
    }catch{return Response.json({error:'Activity feed unavailable. Last displayed results may be out of date.'},{status:503,headers});}
  }
  const asset=ASSETS[path==='/'?'/index.html':path];
  if(!asset)return new Response('Not found',{status:404,headers});
  return new Response(decode(asset.data),{headers:{...headers,'Content-Type':asset.mime,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"}});
}};
