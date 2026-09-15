import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
const assets={};
for(const name of await readdir('web')){
  const mime=name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.json')?'application/json':null;
  if(mime) assets['/'+name]={mime,data:Buffer.from(await readFile('web/'+name)).toString('base64')};
}
assets['/people.png']={mime:'image/png',data:(await readFile('dist/little-agents.png')).toString('base64')};
const worker=await readFile('server/worker.mjs','utf8');
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js','const ASSETS='+JSON.stringify(assets)+';\n'+worker.replace("import { ASSETS } from './assets.mjs';",''));
await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
console.log('Built private office and authenticated activity endpoint.');
