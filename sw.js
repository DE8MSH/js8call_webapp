/* JS8Web v0.9 offline cache. Scope is confined to the GitHub Pages repo.
 * Core JS8 engine is precached; JSC dictionary is opt-in / cache-on-use.
 * No remote API, no remote storage. GPL-3.0-or-later. */
const CACHE='js8web-static-v09';
const ROOT=new URL(self.registration.scope);
const CORE=[
 './','./index.html','./app.css','./desktop-extra.css',
 './ui-layout.js','./app.js','./desktop-extra.js','./offline.js',
 './ft450-cat.js','./protocol.js','./jsc.js','./jsc-tx.js',
 './js8-messages.js','./rx-worker.js','./rx-enhance.js',
 './tx-slots.js','./js8-core.wasm','./manifest.webmanifest'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(CORE.map(p=>new URL(p,ROOT).href));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const name of await caches.keys()){
   if(name.startsWith('js8web-static-')&&name!==CACHE)await caches.delete(name);
  }
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const dictionary=url.pathname.includes('/jsc-dict/');
  if(dictionary){
   const hit=await cache.match(request,{ignoreSearch:true});
   if(hit)return hit;
  }
  try{
   const response=await fetch(request);
   if(response.ok&&response.type!=='opaque')
     event.waitUntil(cache.put(request,response.clone()));
   return response;
  }catch(error){
   const saved=await cache.match(request,{ignoreSearch:true});
   if(saved)return saved;
   if(request.mode==='navigate'){
    const home=await cache.match(new URL('./index.html',ROOT).href);
    if(home)return home;
   }
   throw error;
  }
 })());
});
