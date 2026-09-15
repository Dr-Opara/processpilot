import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker,{decryptEnvelope} from '../server/worker.mjs';
import {encryptActivity} from '../scripts/encrypt-activity.mjs';
const key=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
const pub=await crypto.subtle.exportKey('jwk',key.publicKey),priv=await crypto.subtle.exportKey('jwk',key.privateKey);
const snapshot={schemaVersion:1,updatedAt:'2026-09-09T19:00:00Z',agents:[],events:[],reviews:[]};
test('all 50 states and DC have exactly one scout owner',async()=>{
 const c=JSON.parse(await readFile('web/agents.json','utf8')),states=c.agents.flatMap(a=>a.states);
 const expected='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');
 assert.equal(c.agents.length,30);assert.equal(states.length,51);assert.deepEqual(new Set(states),new Set(expected));
 assert.equal(new Set(c.pods.flatMap(p=>p.agents)).size,30);
});
test('private feed can be decrypted only by the matching key and rejects corruption',async()=>{
 const e=await encryptActivity(snapshot,pub);assert.deepEqual(await decryptEnvelope(e,priv),snapshot);
 const bytes=Buffer.from(e.data,'base64');bytes[0]^=1;
 await assert.rejects(decryptEnvelope({...e,data:bytes.toString('base64')},priv));
 assert.ok(!JSON.stringify(e).includes('reviews'));
});
test('anonymous activity requests fail before fetching',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/activity'),{});
 assert.equal(r.status,401);
});
test('authenticated response merges a newer real review overlay',async()=>{
 const original=global.fetch;
 const review={...snapshot,updatedAt:'2026-09-09T19:01:00Z',reviews:[{id:'unit-only',status:'pending',title:'Unit test, never sent'}]};
 const base=await encryptActivity(snapshot,pub),overlay=await encryptActivity(review,pub);
 global.fetch=async u=>Response.json(String(u).includes('reviews.enc')?overlay:base);
 try{
 const r=await worker.fetch(new Request('https://example.test/api/activity',{headers:{'oai-authenticated-user-id':'test-user'}}),{ACTIVITY_PRIVATE_JWK:JSON.stringify(priv)});
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const body=await r.json();assert.equal(body.reviews.length,1);assert.equal(body.reviewsCheckedAt,review.updatedAt);
 }finally{global.fetch=original;}
});
test('upstream failure is visible and does not invent an empty success',async()=>{
 const original=global.fetch;global.fetch=async()=>new Response('',{status:503});
 try{const r=await worker.fetch(new Request('https://example.test/api/activity',{headers:{'oai-authenticated-user-id':'test-user'}}),{ACTIVITY_PRIVATE_JWK:JSON.stringify(priv)});assert.equal(r.status,503);}finally{global.fetch=original;}
});
