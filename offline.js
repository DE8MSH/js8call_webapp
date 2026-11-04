/* JS8Web 1.0 optional offline deployment controller.
 * Offline status is based on verified CacheStorage entries, not navigator.onLine.
 * GPL-3.0-or-later. */
const CACHE='js8web-static-v10';
const CORE=[
 'index.html','app.css','desktop-extra.css','ui-layout.js','app.js',
 'desktop-extra.js','offline.js','ft450-cat.js','protocol.js','jsc.js',
 'jsc-tx.js','js8-messages.js','rx-worker.js','rx-enhance.js',
 'tx-slots.js','live-rx.js','js8-core.wasm','manifest.webmanifest'
];
const CHUNKS=Array.from({length:8},(_,i)=>'jsc-dict/chunk'+i+'.json');
const panel=document.getElementById('status')?.closest('section.panel');
if(panel){
 const block=document.createElement('div');block.className='offline-controls';
 block.innerHTML='<h3>Offline-Betrieb / PWA</h3>'+
  '<p>Oberfläche und WASM-Kern werden nach dem ersten erfolgreichen Online-Laden lokal gespeichert. '+
  'Das JSC-Wörterbuch kann zusätzlich für komplett internetfreien Freitext-TX/RX gespeichert werden.</p>'+
  '<div class="row"><button id="offlinePrepare" type="button">JSC-Wörterbuch offline speichern</button>'+
  '<button id="offlineCheck" type="button">Offline-Status prüfen</button>'+
  '<span id="offlineProgress" role="status">Cache wird geprüft…</span></div>';
 panel.append(block);
 const status=document.getElementById('offlineProgress'),
  button=document.getElementById('offlinePrepare');
 let working=false;
 const notify=s=>{status.textContent=s;};
 async function cachedCount(){
  const cache=await caches.open(CACHE);
  let base=0,dict=0;
  for(const path of CORE)if(await cache.match(new URL(path,location.href).href,{ignoreSearch:true}))base++;
  for(const path of CHUNKS)if(await cache.match(new URL(path,location.href).href,{ignoreSearch:true}))dict++;
  return{base,dict};
 }
 async function inspect(){
  if(!('caches'in window)||!('serviceWorker'in navigator)){
   notify('Dieser Browser unterstützt keinen Offline-Cache.');button.disabled=true;return;
  }
  const result=await cachedCount();
  if(result.base===CORE.length&&result.dict===CHUNKS.length)
   notify('Offline bereit: '+result.base+' Programmdateien · vollständiges JSC-Wörterbuch (8/8).');
  else notify('Offline-Cache: '+result.base+'/'+CORE.length+
    ' Programmdateien, JSC-Wörterbuch '+result.dict+'/8'+
    (navigator.onLine?' · zum Nachladen Onlineverbindung nötig':' · derzeit offline'));
 }
 document.getElementById('offlineCheck').onclick=()=>inspect().catch(e=>notify('Cache-Prüfung: '+e.message));
 button.onclick=async()=>{
  if(working)return;
  if(!navigator.onLine){notify('Bitte zunächst eine Onlineverbindung herstellen.');return;}
  working=true;button.disabled=true;
  try{
   await navigator.serviceWorker.ready;
   for(let i=0;i<CHUNKS.length;i++){
    notify('JSC-Wörterbuch: lade '+(i+1)+'/8…');
    const response=await fetch(new URL(CHUNKS[i],location.href),{cache:'reload'});
    if(!response.ok)throw Error('HTTP '+response.status+' bei '+CHUNKS[i]);
    // Read the full response so service worker Cache.put can finish.
    await response.arrayBuffer();
   }
   // Cache.put is asynchronous relative to application fetch completion.
   let complete=false;
   for(let i=0;i<8;i++){
    const counts=await cachedCount();
    if(counts.dict===8){complete=true;break;}
    await new Promise(resolve=>setTimeout(resolve,180));
   }
   if(!complete)notify('Wörterbuch geladen; Cache noch nicht vollständig bestätigt. Offline-Status erneut prüfen.');
   else await inspect();
  }catch(e){notify('Offline-Paket nicht vollständig: '+e.message);}
  finally{working=false;button.disabled=false;}
 };
 if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
  navigator.serviceWorker.register('./sw.js',{scope:'./'})
   .then(()=>navigator.serviceWorker.ready).then(()=>inspect())
   .catch(e=>notify('Service Worker: '+e.message));
 }else notify('Offline-Funktion erfordert HTTPS oder localhost.');
 window.addEventListener('online',()=>inspect().catch(()=>{}));
 window.addEventListener('offline',()=>inspect().catch(()=>{}));
}
