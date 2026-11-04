import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const events=new Map(),stores=new Map();
const scope='https://de8msh.github.io/js8call_webapp/';
function url(request){return typeof request==='string'?request:request.url;}
function ensure(name){
 if(!stores.has(name))stores.set(name,new Map());
 const items=stores.get(name);
 return {
  async addAll(paths){for(const path of paths)items.set(url(path),new Response('test '+url(path)));},
  async match(request,{ignoreSearch=false}={}){
   let key=url(request);
   if(ignoreSearch){const query=new URL(key);query.search='';key=query.href;}
   const entry=items.get(key);return entry?.clone();
  },
  async put(request,response){items.set(url(request),response.clone());}
 };
}
const caches={
  open:async name=>ensure(name),
  keys:async()=>[...stores.keys()],
  delete:async name=>stores.delete(name)
};
let online=false;
const self={
  registration:{scope},
  addEventListener:(name,fn)=>events.set(name,fn),
  skipWaiting:async()=>{},
  clients:{claim:async()=>{}}
};
vm.runInNewContext(source,{self,caches,URL,Promise,fetch:async request=>{
  if(!online)throw Error('Simulated offline');
  return new Response('served '+url(request),{status:200});
}});
const install=[];
events.get('install')({waitUntil:p=>install.push(p)});
await Promise.all(install);
const base=stores.get('js8web-static-v11');
assert.ok(base.size>=15,'core should be precached');
assert.ok(base.has(scope+'js8-core.wasm'),'WASM is required for offline decoding');
assert.ok(base.has(scope+'tx-slots.js'),'safe TX is required offline');
assert.ok(base.has(scope+'live-rx.js'),'multi-mode live RX is required offline');
assert.ok(base.has(scope+'original-ui.js'),'Original UI control layer must work offline');
assert.ok(base.has(scope+'original-ui.css'),'Original UI styling must work offline');
assert.ok(base.has(scope+'offline.js'),'offline UI must be available');
async function request(path){
 let responded,extras=[];
 const req=new Request(new URL(path,scope));
 events.get('fetch')({request:req,respondWith:p=>{responded=p;},waitUntil:p=>extras.push(p)});
 if(!responded)return null;
 const response=await responded;
 await Promise.all(extras);
 return response;
}
assert.match(await (await request('app.js?v=0.9')).text(),/test .*app.js/);
assert.equal(await request('../different-repo/app.js'),null,'do not intercept another Pages site');
await assert.rejects(()=>request('jsc-dict/chunk0.json'),/offline/);
online=true;
const dict=await request('jsc-dict/chunk0.json');
assert.equal(dict.status,200);
assert.ok(base.has(scope+'jsc-dict/chunk0.json'));
online=false;
assert.match(await (await request('jsc-dict/chunk0.json')).text(),/served/);
const active=[];
events.get('activate')({waitUntil:p=>active.push(p)});
await Promise.all(active);
assert.equal(stores.has('js8web-static-v11'),true);
console.log('Offline SW tests: scoped cache, wasm precache, fallback, JSC dictionary cache-on-use PASS');
