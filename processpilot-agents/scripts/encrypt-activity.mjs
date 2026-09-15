import {readFile,writeFile} from 'node:fs/promises';
export async function encryptActivity(payload,publicJwk){
 const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(payload)));
 const pub=await crypto.subtle.importKey('jwk',publicJwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
 const wrapped=await crypto.subtle.encrypt({name:'RSA-OAEP'},pub,await crypto.subtle.exportKey('raw',key));
 const b64=x=>Buffer.from(x).toString('base64');
 return {version:1,key:b64(wrapped),iv:b64(iv),data:b64(data)};
}
if(process.argv[1]?.endsWith('encrypt-activity.mjs')&&process.argv[2]){
 const [input,output,publicPath='config/activity-public.jwk.json']=process.argv.slice(2);
 const payload=JSON.parse(await readFile(input,'utf8'));
 if(payload.schemaVersion!==1||!Array.isArray(payload.agents)||!Array.isArray(payload.events)||!Array.isArray(payload.reviews))throw new Error('Invalid activity schema');
 await writeFile(output,JSON.stringify(await encryptActivity(payload,JSON.parse(await readFile(publicPath,'utf8'))))+'\n');
}
