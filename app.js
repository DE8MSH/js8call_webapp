import {makeHeartbeat,makeDirected,parseFrame} from './protocol.js';
import {decodeJscFrame,MessageAssembler} from './jsc.js';
import {prepareMessagePlan,MessageSessionTracker} from './js8-messages.js';
import {SlotTransmitter} from './tx-slots.js';
import {LiveSlotPlanner,BoundedLiveDecoder} from './live-rx.js';
/* JS8Web LAB browser controller, GPL-3.0. See README.md for precise limitations. */
const $=id=>document.getElementById(id);
const MODES={normal:{sps:1920,period:15,delay:.5,cos:0},fast:{sps:1200,period:10,delay:.2,cos:1},turbo:{sps:600,period:6,delay:.1,cos:1},slow:{sps:3840,period:30,delay:.5,cos:1}};
let wasm,worker,stream,ctx,source,analyser,processor,zero,fftData,renderTimer,slot=-1,chunks=[],rxOn=false,serial=null,txSource=null,txTimer=null,pttTimer=null,prepared=null,logs=[],seq=0;
const pending=new Map();
function status(s){const el=$('status');el.textContent=new Date().toISOString().slice(11,19)+' UTC · '+s+'\n'+el.textContent.slice(0,650);}
function info(s){$('txInfo').textContent=s;}
function utc(){const d=new Date(Date.now()+Number($('offset').value||0));$('utc').textContent=d.toISOString().slice(11,19)+' UTC';const m=MODES[$('mode').value],r=(d.getTime()%(m.period*1000))/1000;$('clockStatus').textContent=`Zeitfenster ${r.toFixed(1)} / ${m.period} s · Browseruhr`;}setInterval(utc,250);utc();
function mode(){return MODES[$('mode').value];}
function freq(){return Math.min(3000,Math.max(300,Number($('audioFreq').value)||1500));}
function makeDecoderWorker(){
 const decoder=new Worker(new URL('./rx-worker.js?v=1.0',import.meta.url),{type:'module'});
 decoder.onmessage=({data})=>{
  const entry=pending.get(data.id);
  if(!entry||entry.worker!==decoder)return;
  pending.delete(data.id);clearTimeout(entry.timer);entry.resolve(data);
 };
 decoder.onerror=event=>{
  const error=new Error('RX-Worker: '+(event.message||'Modul-/DSP-Fehler'));
  for(const [id,entry] of pending)if(entry.worker===decoder){
   pending.delete(id);clearTimeout(entry.timer);entry.reject(error);
  }
  status(error.message);
 };
 return decoder;
}
async function init(){try{const resp=await fetch('./js8-core.wasm');if(!resp.ok)throw Error('HTTP '+resp.status);const {instance}=await WebAssembly.instantiate(await resp.arrayBuffer());wasm=instance.exports;worker=makeDecoderWorker();$('engine').textContent='✓ JS8-Kern · WASM aktiv';status('WASM-Codec geladen · Test mit „Eigenen Frame testen“ möglich.');}catch(e){$('engine').textContent='WASM nicht verfügbar';status('WASM konnte nicht geladen werden: '+e.message+' · Bitte über HTTPS oder HTTP-Server aufrufen.');}}
function make(){if(!wasm)throw Error('WASM-Engine nicht bereit');const text=$('message').value;const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+';if(text.length!==12||[...text].some(c=>!alphabet.includes(c)))throw Error('Es sind genau 12 gültige Frame-Zeichen erforderlich.');const mem=new Uint8Array(wasm.memory.buffer),p=wasm.js8_input_ptr();for(let i=0;i<12;i++)mem[p+i]=text.charCodeAt(i);const typ=Number($('type').value),m=mode();const code=wasm.js8_encode(typ,m.cos);if(code!==0)throw Error('WASM-Encoder-Fehler '+code);const view=new Int32Array(wasm.memory.buffer,wasm.js8_tones_ptr(),79);return {text,typ,tones:Array.from(view),mode:$('mode').value,freq:freq()};}
function prepare(){try{prepared=make();$('tx').disabled=!$('txconfirm').checked;info(`79 echte JS8-Tonsymbole generiert · ${prepared.mode.toUpperCase()} · ${prepared.freq} Hz · Frame-Typ ${prepared.typ}.`);status('JS8-Frame vorbereitet: '+prepared.text);}catch(e){prepared=null;$('tx').disabled=true;status(e.message);info(e.message);}}
$('prepare').onclick=prepare;$('txconfirm').onchange=()=>{$('tx').disabled=!prepared||!$('txconfirm').checked;};['mode','audioFreq','type','message'].forEach(id=>$(id).addEventListener('change',()=>{prepared=null;$('tx').disabled=true;info('Einstellungen geändert: Frame neu vorbereiten.');}));
function audioSamples(t,m,hz,sr){const n=m.period*sr,out=new Float32Array(n);let phase=0;const symSamples=Math.round(m.sps*sr/12000),start=Math.round(m.delay*sr),length=symSamples*t.length;for(let k=0;k<length;k++){const tone=t[Math.min(78,Math.floor(k/symSamples))];phase+=2*Math.PI*(hz+tone*12000/m.sps)/sr;if(phase>2*Math.PI)phase-=2*Math.PI;const fade=Math.max(0,Math.min(1,k/(symSamples*.10),(length-k)/(symSamples*.10)));out[start+k]=Math.sin(phase)*fade*0.65;}return out;}
function wavBytes(samples,sr){const n=samples.length,out=new ArrayBuffer(44+n*2),v=new DataView(out);function str(pos,s){for(let i=0;i<s.length;i++)v.setUint8(pos+i,s.charCodeAt(i));}str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);return new Blob([out],{type:'audio/wav'});}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
$('downloadTest').onclick=()=>{try{const p=make();download(wavBytes(audioSamples(p.tones,mode(),p.freq,12000),12000),`js8web-${p.mode}-${p.text}.wav`);status('Vollständige JS8-Testrahmen-WAV erzeugt.');}catch(e){status(e.message)}};
function rxDecode(payload,receiver=worker,timeoutMs=60000){
 return new Promise((resolve,reject)=>{
  if(!receiver){reject(Error('RX-Worker nicht bereit'));return;}
  const id=++seq,entry={resolve,reject,worker:receiver,timer:null};
  pending.set(id,entry);
  entry.timer=setTimeout(()=>{
   if(pending.get(id)!==entry)return;
   pending.delete(id);reject(Error('RX-Worker Zeitlimit überschritten'));
  },timeoutMs);
  try{receiver.postMessage({id,...payload},payload.samples?[payload.samples.buffer]:[]);}
  catch(error){clearTimeout(entry.timer);pending.delete(id);reject(error);}
 });
}
const seenFrames=new Set();
const textAssembler=new MessageAssembler();
let jscSequence=Promise.resolve(),rxGeneration=0;
const conversationTracker=new MessageSessionTracker();
window.addEventListener('js8:frame',event=>{
  const message=conversationTracker.accept(event.detail);
  if(message)window.dispatchEvent(new CustomEvent('js8:conversation',{detail:message}));
});
function row(result,origin,meta={}){
 if(!result.ok){status(origin+': '+result.reason+(Number.isFinite(result.q)?' · Sync '+result.q.toFixed(2):'')+(Number.isFinite(result.scanPeak)?' · stärkster Kandidat '+result.scanPeak.toFixed(0)+' Hz':''));return;}
 let frames=[...(result.results?.length?result.results:[result])].sort((a,b)=>(a.start||0)-(b.start||0)),added=0;
 for(const f of frames){
  const ms=meta.startMs==null?Date.now():meta.startMs+(f.start||0)/12000*1000;
  const key=Math.round(ms/2000)+'|'+Math.round(f.frequency/8)+'|'+f.text;
  if(seenFrames.has(key))continue;
  seenFrames.add(key);if(seenFrames.size>500){seenFrames.delete(seenFrames.values().next().value);}
  let parsed;try{parsed=parseFrame(f.text,f.type);}catch{parsed={display:'Unbekannt',kind:'unknown'};}
  const item={time:new Date(ms).toISOString(),mode:meta.mode||$('mode').value,type:f.type,text:f.text,display:parsed.display,parsed,frequency:f.frequency,sync:f.sync,strategy:f.strategy||'max-log',repeatCount:f.combined||0,origin};
  logs.unshift(item);added++;
  window.dispatchEvent(new CustomEvent('js8:frame',{detail:item}));
  let list=$('log');list.querySelector('.empty')?.remove();let r=document.createElement('div');r.className='logrow';
  let a=document.createElement('time');a.textContent=item.time.slice(11,19);
  let b=document.createElement('strong');b.textContent=item.mode.toUpperCase();
  let c=document.createElement('span');c.textContent='T'+item.type+' · '+item.frequency.toFixed(0)+'Hz';
  let d=document.createElement('code');d.textContent=parsed.display+(f.pass==='SIC'?' [SIC]':f.combined?' [Soft '+f.combined+'×]':'')+' · RAW '+item.text;r.append(a,b,c,d);list.prepend(r);
  status('RX '+origin+': '+parsed.display+' · '+item.frequency.toFixed(1)+' Hz · Sync '+item.sync.toFixed(2));
  // Complete JS8Call JSC (s=7,c=9) dictionary decompression is lazy.
  // A CRC-valid data frame remains recorded even if the dictionary cannot load.
  if(parsed.kind==='data'||(f.type&4)){
    const generation=rxGeneration;
    jscSequence=jscSequence.catch(()=>{}).then(()=>decodeJscFrame(f.text,f.type)).then(decoded=>{
      if(generation!==rxGeneration)return;
      if(!decoded?.display)return;
      const assembled=textAssembler.add({frame:f.text,text:decoded.display,mode:item.mode,
        frequency:item.frequency,type:f.type,time:item.time,period:MODES[item.mode]?.period||15});
      const combined=assembled?.display||decoded.display;
      const complete=assembled?.complete??true;
      item.display=combined;
      item.parsed={kind:complete?'text':'text_fragment',display:combined,command:'JSC',call:'',to:''};
      d.textContent=combined+(complete?' [JSC]':' [JSC · Teiltext]')+' · RAW '+item.text;
      d.classList.add('jsc-decoded');
      window.dispatchEvent(new CustomEvent('js8:frame',{detail:{...item,parsed:item.parsed}}));
      status('RX JSC '+origin+': '+combined.trim()+' · '+item.frequency.toFixed(1)+' Hz');
    }).catch(err=>status('JSC-Wörterbuch: '+err.message));
  }

 }
 if(added)$('framecount').textContent=logs.length+' Frames';
}
$('clear').onclick=()=>{rxGeneration++;textAssembler.reset();conversationTracker.reset();seenFrames.clear();logs=[];window.dispatchEvent(new Event('js8:clear'));$('log').replaceChildren();$('framecount').textContent='0 Frames';};
$('csv').onclick=()=>{const rows=[['UTC','Mode','Type','Decoded','RawFrame','AudioHz','Sync','Decoder','Quelle'],...logs.map(x=>[x.time,x.mode,x.type,x.display,x.text,x.frequency,x.sync,x.strategy,x.origin])];let csv=rows.map(x=>x.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');download(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}),'js8web-rx-log.csv');};
$('synthetic').onclick=async()=>{try{if(!worker)throw Error('Worker nicht bereit');const p=make();status('Eigenen JS8-Frame über simulierten 12-kHz-Funkkanal decodieren …');const r=await rxDecode({synthetic:true,tones:p.tones,freq:p.freq,mode:p.mode});row(r,'Selbsttest');}catch(e){status('Selbsttest: '+e.message)}};

$('wav').onclick=()=>$('wavFile').click();
let wavScanning=false;
$('wavStop').onclick=()=>{wavScanning=false;$('wavStop').disabled=true;status('WAV-Analyse: Abbruch angefordert.');};
$('wavFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 if(wavScanning){status('WAV-Analyse läuft bereits.');return;}
 wavScanning=true;$('wavStop').disabled=false;$('wav').disabled=true;
 try{
  if(!worker)throw Error('Worker nicht bereit');
  const ac=new AudioContext();
  let ab;
  try{ab=await ac.decodeAudioData(await file.arrayBuffer());}finally{await ac.close();}
  const sr=ab.sampleRate,src=ab.getChannelData(0),duration=src.length/sr,
    modes=$('wavAllModes').checked?Object.keys(MODES):[$('mode').value],wavStart=Date.now();
  let good=0,checks=0;
  for(const name of modes){
   if(!wavScanning)break;
   const m=MODES[name],period=m.period,needed=79*m.sps/12000;
   if(duration<needed){status('WAV '+name.toUpperCase()+': zu kurz für vollständigen Frame');continue;}
   const maxStart=Math.max(0,duration-period),hop=Math.min(2,Math.max(.5,(period-needed)/2));
   for(let begin=0;begin<=maxStart+1e-7&&wavScanning;begin+=hop){
    const from=Math.floor(begin*sr),to=Math.min(src.length,from+Math.ceil((period+2.5)*sr));
    const data=new Float32Array(src.slice(from,to)),startMs=wavStart+begin*1000;
    const res=await rxDecode({samples:data,sr,mode:name,freq:freq(),auto:$('scanAuto').checked,
      enhanced:$('enhancedRx').checked,startMs});
    if(!wavScanning)break;
    if(res.ok){good+=res.results?.length||1;row(res,'WAV '+file.name,{startMs,mode:name});}
    if(++checks%4===0)status('WAV-Analyse: '+name.toUpperCase()+' · '+checks+' Fenster · '+good+' Decodes');
   }
  }
  status((wavScanning?'WAV fertig':'WAV abgebrochen')+': '+checks+' Suchfenster · '+good+
    ' Decodes'+(good?'':' · Modus/Audioeingang prüfen'));
 }catch(ex){status('WAV-Fehler: '+ex.message);}
 finally{wavScanning=false;$('wavStop').disabled=true;$('wav').disabled=false;e.target.value='';}
};
async function getAudio(){
 if(!ctx)ctx=new AudioContext({latencyHint:'interactive'});
 await ctx.resume();
 const device=$('txDevice')?.value||'';
 if(device && ctx.sinkId!==device){
  if(typeof ctx.setSinkId!=='function')throw Error('TX-Ausgangswahl wird von diesem Browser nicht unterstützt (AudioContext.setSinkId).');
  await ctx.setSinkId(device);
 }else if(!device && typeof ctx.setSinkId==='function' && typeof ctx.sinkId==='string' && ctx.sinkId!==''){
  await ctx.setSinkId('');
 }
 return ctx;
}
function flatten(list){let n=list.reduce((s,x)=>s+x.length,0),out=new Float32Array(n),p=0;for(const c of list){out.set(c,p);p+=c.length;}return out;}
function spectrogram(){if(!analyser)return;const c=$('spectrum'),g=c.getContext('2d');const db=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(db);g.drawImage(c,0,1);const strip=g.createImageData(c.width,1),hzPerBin=ctx.sampleRate/analyser.fftSize;for(let x=0;x<c.width;x++){const hz=300+x/c.width*2700,bin=Math.floor(hz/hzPerBin),p=db[Math.max(0,Math.min(db.length-1,bin))]/255,v=Math.max(0,Math.min(255,Math.floor((p-.12)*400))),q=x*4;strip.data[q]=Math.max(0,Math.min(255,v*.9));strip.data[q+1]=Math.max(0,Math.min(255,v*1.1));strip.data[q+2]=Math.max(0,Math.min(255,v*1.65));strip.data[q+3]=255;}g.putImageData(strip,0,0);let x=(freq()-300)/2700*c.width;g.fillStyle='#f9ae5a';g.fillRect(x,0,2,2);}
let captureStartMs=0,captureFrames=0,pcmBlocks=[],activeMode='normal',activeModes=['normal'];
let liveWorkers=[],liveFound=0;
const livePlanner=new LiveSlotPlanner();
function stopLiveWorkers(){
 for(const decoder of liveWorkers){
  for(const [id,entry] of pending)if(entry.worker===decoder){
   pending.delete(id);clearTimeout(entry.timer);entry.reject(Error('Live-RX gestoppt'));
  }
  decoder.terminate();
 }
 liveWorkers=[];
}
function startLiveWorkers(count){
 stopLiveWorkers();
 for(let i=0;i<count;i++)liveWorkers.push(makeDecoderWorker());
}
function liveStatus(){
 const badge=$('liveModeStatus');if(!badge)return;
 badge.textContent='Live '+(activeModes.length===4?'AUTO4':'1 Modus')+
  ' ·  Worker '+liveQueue.busy+'/'+liveQueue.lanes.length+
  ' · Wartend '+liveQueue.queued+' · Decodes '+liveQueue.completed+
  ' · Treffer '+liveFound+' · Verworfen '+liveQueue.dropped;
}
const liveQueue=new BoundedLiveDecoder({
 concurrency:2,maxQueued:4,maxAgeMs:30000,
 now:()=>Date.now()+Number($('offset').value||0),
 decode:async(job,lane)=>{
  const decoder=liveWorkers[lane];
  if(!decoder)throw Error('Live-Worker wurde angehalten');
  try{
   return await rxDecode({samples:job.samples,sr:job.sr,mode:job.mode,
     freq:job.freq,auto:job.auto,enhanced:job.enhanced,startMs:job.startMs},decoder,45000);
  }catch(error){
   if(liveWorkers[lane]===decoder){
    decoder.terminate();
    for(const [id,entry] of pending)if(entry.worker===decoder){
     pending.delete(id);clearTimeout(entry.timer);entry.reject(error);
    }
    liveWorkers[lane]=makeDecoderWorker();
   }
   throw error;
  }
 },
 onResult:(result,job)=>{
  if(!rxOn||job.epoch!==rxGeneration)return;
  if(result?.ok){liveFound+=result.results?.length||1;row(result,'Mikrofon',{startMs:job.startMs,mode:job.mode});}
  liveStatus();
 },
 onError:(error,job)=>{
  if(!rxOn||job.epoch!==rxGeneration)return;
  status('Live-RX '+job.mode.toUpperCase()+': '+error.message);liveStatus();
 },
 onDrop:()=>{if(rxOn)liveStatus();}
});
function windowAudio(beginMs,endMs,sr){
 const start=Math.round((beginMs-captureStartMs)*sr/1000),end=Math.round((endMs-captureStartMs)*sr/1000;
 const out=new Float32Array(Math.max(0,end-start));
 for(const block of pcmBlocks){
  const a=Math.max(start,block.i),z=Math.min(end,block.i+block.data.length);
  if(z>a)out.set(block.data.subarray(a-block.i,z-block.i),a-start);
 }
 return out;
}
function acceptRxBuffer(audio){
 const sr=ctx.sampleRate;
 if(!captureStartMs){
  captureStartMs=Date.now()+Number($('offset').value||0)-audio.length/sr*1000;
  livePlanner.reset(captureStartMs,activeModes);
 }
 const block=new Float32Array(audio);
 pcmBlocks.push({i:captureFrames,data:block});captureFrames+=block.length;
 const audioEndMs=captureStartMs+captureFrames/sr*1000;
 const jobs=livePlanner.collect(audioEndMs);
 for(const job of jobs){
  const samples=windowAudio(job.startMs,job.endMs,sr);
  if(!samples.length)continue;
  liveQueue.submit({...job,samples,sr,epoch:rxGeneration,
    freq:freq(),auto:$('scanAuto').checked,enhanced:$('enhancedRx').checked});
 }
 const longestPeriod=Math.max(...activeModes.map(name=>MODES[name].period));
 const keepFrom=captureFrames-Math.ceil((longestPeriod+5)*sr);
 pcmBlocks=pcmBlocks.filter(block=>block.i+block.data.length>keepFrom);
 if(jobs.length)liveStatus();
}
async function refreshAudioInputs(){
 if(!navigator.mediaDevices?.enumerateDevices){status('Audioeingang-Auswahl erfordert HTTPS');return;}
 const select=$('rxDevice'),previous=select.value;
 const all=await navigator.mediaDevices.enumerateDevices();
 const devices=all.filter(x=>x.kind==='audioinput');
 select.replaceChildren(new Option('Standard-Audioeingang',''));
 devices.forEach((d,i)=>select.add(new Option(d.label||('Audioeingang '+(i+1)),d.deviceId)));
 if([...select.options].some(o=>o.value===previous))select.value=previous;
 const out=$('txDevice');
 if(out){
  const selected=out.value;
  out.replaceChildren(new Option('Standard-Audioausgang',''));
  all.filter(d=>d.kind==='audiooutput').forEach((d,i)=>out.add(new Option(d.label||('Audioausgang '+(i+1)),d.deviceId)));
  if([...out.options].some(o=>o.value===selected))out.value=selected;
 }
}
$('refreshAudio').onclick=()=>refreshAudioInputs().catch(e=>status('Audioeingänge: '+e.message));
navigator.mediaDevices?.addEventListener?.('devicechange',()=>refreshAudioInputs().catch(()=>{}));
refreshAudioInputs().catch(()=>{});
$('start').onclick=async()=>{
 try{
  if(rxOn)return;if(!worker)throw Error('WASM nicht geladen');
  const constraints={channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false};if($('rxDevice').value)constraints.deviceId={exact:$('rxDevice').value};stream=await navigator.mediaDevices.getUserMedia({audio:constraints});await refreshAudioInputs();
  await getAudio();source=ctx.createMediaStreamSource(stream);analyser=ctx.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=.38;
  processor=ctx.createScriptProcessor(4096,1,1);zero=ctx.createGain();zero.gain.value=0;
  source.connect(analyser);source.connect(processor);processor.connect(zero);zero.connect(ctx.destination);
  captureStartMs=0;captureFrames=0;pcmBlocks=[];activeMode=$('mode').value;
  activeModes=$('liveAllModes').checked?Object.keys(MODES):[activeMode];
  rxGeneration++;liveQueue.reset();liveFound=0;
  startLiveWorkers(activeModes.length===4?2:1);
  rxOn=true;
  $('mode').disabled=true;$('offset').disabled=true;$('rxDevice').disabled=true;$('liveAllModes').disabled=true;
  liveStatus();
  processor.onaudioprocess=e=>{if(!rxOn)return;const a=e.inputBuffer.getChannelData(0);let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*a[i];$('rxLevel').textContent='RX · '+(20*Math.log10(Math.sqrt(sum/a.length)+1e-8)).toFixed(1)+' dBFS';acceptRxBuffer(a);};
  renderTimer=setInterval(spectrogram,95);$('start').disabled=true;$('stop').disabled=false;
  status('RX aktiv · '+ctx.sampleRate+' Hz · '+activeModes.map(x=>x.toUpperCase()).join('/')+' · '+(activeModes.length===4?'2 Decoder-Worker · begrenzter Rückstau · ':'')+($('scanAuto').checked?'300–3000 Hz (hohe CPU-Last)':'±30 Hz um Audiofrequenz'));
  if(activeModes.length===4&&$('scanAuto').checked)status('Hinweis: AUTO4 mit 300–3000 Hz braucht hohe CPU-Leistung; bei Verwerfungen schmalbandig scannen.');
 }catch(e){status('Mikrofon-Start: '+e.message);stream?.getTracks().forEach(t=>t.stop());}
};
$('stop').onclick=()=>{
 rxOn=false;if(processor)processor.onaudioprocess=null;processor?.disconnect();source?.disconnect();zero?.disconnect();stream?.getTracks().forEach(t=>t.stop());
 clearInterval(renderTimer);analyser=null;pcmBlocks=[];captureStartMs=0;
 rxGeneration++;liveQueue.reset();stopLiveWorkers();livePlanner.reset(0,[]);
 textAssembler.reset();conversationTracker.reset();
 $('mode').disabled=false;$('offset').disabled=false;$('rxDevice').disabled=false;$('liveAllModes').disabled=false;
 $('start').disabled=false;$('stop').disabled=true;liveStatus();status('RX gestoppt · Decoder-Worker freigegeben');
};
$('spectrum').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));$('audioFreq').value=Math.round(300+2700*x);status('Manuelle Audiofrequenz: '+freq()+' Hz');});
$('call').addEventListener('input',()=>{$('protocolCall').value=$('call').value.toUpperCase();});
function protocolPrepare(packet){
 $('message').value=packet.frame;$('type').value=String(packet.type);prepared=null;$('tx').disabled=true;prepare();
 $('protoInfo').textContent=packet.display+' · 12-Zeichen-Transportframe: '+packet.frame;
}
$('makeBeacon').onclick=()=>{try{protocolPrepare(makeHeartbeat($('call').value,$('locator').value,$('beaconKind').value));}catch(e){status('CQ/HB: '+e.message);}};
$('makeDirected').onclick=()=>{try{protocolPrepare(makeDirected($('call').value,$('targetCall').value,$('directCmd').value));}catch(e){status('Directed: '+e.message);}};
let armedPttLine=null;
async function pttActive(state){
 if(!serial){
  if(state&&$('pttLine').value!=='none')throw Error('PTT '+$('pttLine').value.toUpperCase()+' gewählt, aber kein serieller Port verbunden');
  return;
 }
 const line=state?$('pttLine').value:(armedPttLine||$('pttLine').value);
 if(line==='none')return;
 if(state)armedPttLine=line;
 try{await serial.setSignals(line==='rts'?{requestToSend:state}:{dataTerminalReady:state});}
 finally{if(!state)armedPttLine=null;}
}
$('serialConnect').onclick=async()=>{try{if(!navigator.serial)throw Error('WebSerial nur in kompatiblen Chromium-Browsern über HTTPS verfügbar');serial=await navigator.serial.requestPort();await serial.open({baudRate:9600});await serial.setSignals({requestToSend:false,dataTerminalReady:false});$('serialStatus').textContent='Port verbunden';$('serialConnect').disabled=true;$('serialDisconnect').disabled=false;status('WebSerial-Port verbunden – RTS/DTR nur mit korrekter PTT-Verdrahtung nutzen.');}catch(e){try{await serial?.close();}catch{}serial=null;status('WebSerial: '+e.message)}};
$('serialDisconnect').onclick=async()=>{
 try{
  if(txController.busy)await txController.cancel();
  await pttActive(false);
  await serial?.close();
 }catch(e){status('PTT/Seriell trennen: '+e.message);}
 finally{serial=null;armedPttLine=null;$('serialStatus').textContent='Nicht verbunden';$('serialConnect').disabled=false;$('serialDisconnect').disabled=true;}
};
let transmitting=false;
const txController=new SlotTransmitter({
  ptt:state=>pttActive(state),
  status:event=>{
    window.dispatchEvent(new CustomEvent('js8:txstate',{detail:event}));
    if(event.state==='armed')status('TX vorbereitet für '+new Date(event.utcMs).toISOString().slice(11,19)+' UTC · PTT vor dem Audio');
    else if(event.state==='onair')status('TX-Audio aktiv · Slot '+new Date(event.utcMs).toISOString().slice(11,19)+' UTC');
    else if(event.state==='ptt-release-error')status('PTT-Freigabe fehlgeschlagen: '+event.error+' · Funkgerät sofort prüfen!');
  }
});
$('tx').onclick=async()=>{
 if(!prepared||!$('txconfirm').checked){status('TX: Frame und manuelle TX-Freigabe erforderlich');return false;}
 if(transmitting||txController.busy)return false;
 transmitting=true;$('tx').disabled=true;$('cancel').disabled=false;
 const frame=prepared;
 try{
  const m=MODES[frame.mode];
  const result=await txController.transmit({
    periodMs:m.period*1000,
    utcCorrectionMs:Number($('offset').value||0),
    leadMs:Math.max(100,Math.min(1500,Math.round(Number($('pttLead').value)||350))),
    audio:()=>getAudio(),
    createSource:ac=>{
      const samples=audioSamples(frame.tones,m,frame.freq,ac.sampleRate);
      const buffer=ac.createBuffer(1,samples.length,ac.sampleRate);
      buffer.copyToChannel(samples,0);
      const s=ac.createBufferSource();s.buffer=buffer;s.connect(ac.destination);return s;
    },
    onSource:s=>{txSource=s;}
  });
  status('JS8-Audioframe vollständig ausgegeben, PTT deaktiviert · '+new Date(result.utcMs).toISOString().slice(11,19)+' UTC');
  return true;
 }catch(e){
  status('TX nicht abgeschlossen: '+e.message);
  return false;
 }finally{
  transmitting=false;txSource=null;
  $('pttLine').disabled=false;$('pttLead').disabled=false;$('txDevice').disabled=false;
  $('cancel').disabled=true;$('tx').disabled=!prepared||!$('txconfirm').checked;
 }
};
$('cancel').onclick=async()=>{
  await txController.cancel();
  transmitting=false;txSource=null;
  $('cancel').disabled=true;$('tx').disabled=!prepared||!$('txconfirm').checked;
  status('TX abgebrochen · PTT-Freigabe angefordert.');
};
$('txconfirm').addEventListener('change',()=>{
  if(!$('txconfirm').checked&&txController.busy)$('cancel').click();
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&txController.busy)$('cancel').click();
});
window.addEventListener('pagehide',()=>{void txController.cancel();});
init();

/* JSC text TX queue: uses the existing WebAssembly transport coder and
 * per-slot TX audio. Operator must explicitly approve every queue run. */
let textTxPacket=null,textTxIndex=0,textTxRunning=false,textTxAborted=false;
let textTxFingerprint='';
function txQueueFingerprint(){
  return [$('mode').value,$('audioFreq').value,$('call').value,$('textRecipient')?.value||'', $('textKind')?.value||'plain',$('txDevice')?.value||'',$('pttLine')?.value||'none',$('pttLead')?.value||'350'].join('|');
}
function currentTxQueueValid(){return txQueueFingerprint()===textTxFingerprint;}
function textTxEvent(state,extra={}){window.dispatchEvent(new CustomEvent('js8:txqueue',{detail:{state,...extra}}));}
window.addEventListener('js8:prepare-text',async({detail})=>{
  textTxPacket=null;textTxRunning=false;textTxAborted=false;
  try{
    const original=String(detail?.text||'');
    const from=($('call').value||'').trim().toUpperCase();
    const to=($('textRecipient')?.value||'@ALLCALL').trim().toUpperCase();
    if(!/^[A-Z0-9/]{3,18}$/.test(from))throw Error('Bitte ein gültiges eigenes Rufzeichen eintragen.');
    const kind=$('textKind')?.value||'plain';
    const packet=await prepareMessagePlan({from,to,text:original,mode:$('mode').value,kind});
    textTxPacket=packet;textTxIndex=0;
    textTxFingerprint=txQueueFingerprint();
    for(let type=0;type<8;type++)if(![...$('type').options].some(o=>Number(o.value)===type)){
      const option=new Option('Transporttyp '+type,String(type));$('type').append(option);
    }
    textTxEvent('ready',{packet});
    status('JSC TX: '+packet.frames.length+' komprimierte JS8-Frames mit FIRST/LAST vorbereitet.');
  }catch(e){textTxEvent('error',{error:e.message});status('JSC TX: '+e.message);}
});
async function sendTextFrame(){
  if(textTxAborted||!textTxRunning||!textTxPacket)return;
  if(!currentTxQueueValid()){textTxRunning=false;textTxEvent('error',{error:'TX-Einstellungen seit Vorbereitung geändert. Bitte erneut vorbereiten.'});return;}
  const f=textTxPacket.frames[textTxIndex];
  if(!f){textTxRunning=false;textTxEvent('complete',{total:textTxPacket.frames.length});return;}
  $('message').value=f.frame;$('type').value=String(f.type);prepare();
  if(!prepared){textTxRunning=false;textTxEvent('error',{error:'WASM-Frame konnte nicht codiert werden'});return;}
  textTxEvent('sending',{index:textTxIndex,total:textTxPacket.frames.length});
  const completed=await $('tx').onclick();
  if(!textTxRunning||textTxAborted)return;
  if(!completed){
    textTxRunning=false;
    textTxEvent('error',{error:'Frame nicht vollständig gesendet; Queue sicher gestoppt.'});
    return;
  }
  textTxIndex++;
  if(textTxIndex>=textTxPacket.frames.length){
    textTxRunning=false;textTxEvent('complete',{total:textTxPacket.frames.length});
  }else{
    setTimeout(()=>sendTextFrame().catch(e=>{
      textTxRunning=false;textTxEvent('error',{error:e.message});
    }),80);
  }
}
window.addEventListener('js8:send-queue',()=>{
  if(!textTxPacket||textTxRunning)return;
  if(!currentTxQueueValid()){textTxEvent('error',{error:'TX-Einstellungen seit Vorbereitung geändert. Bitte erneut vorbereiten.'});return;}
  if(!$('txconfirm').checked){textTxEvent('error',{error:'TX-Freigabe fehlt'});return;}
  textTxRunning=true;textTxAborted=false;textTxIndex=0;
  sendTextFrame().catch(e=>{textTxRunning=false;textTxEvent('error',{error:e.message});});
});
function abortTextQueue(){
  if(!textTxRunning)return;
  textTxRunning=false;textTxAborted=true;textTxEvent('cancelled');
}
const originalTextCancel=$('cancel').onclick;
$('cancel').onclick=async function(event){abortTextQueue();return originalTextCancel.call(this,event);};
window.addEventListener('js8:clear-txqueue',()=>{
  abortTextQueue();textTxPacket=null;
  if(transmitting)$('cancel').onclick();
});
