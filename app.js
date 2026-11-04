import {makeHeartbeat,makeDirected,parseFrame} from './protocol.js';
import {decodeJscFrame,MessageAssembler} from './jsc.js';
import {prepareMessagePlan,MessageSessionTracker} from './js8-messages.js';
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
async function init(){try{const resp=await fetch('./js8-core.wasm');if(!resp.ok)throw Error('HTTP '+resp.status);const {instance}=await WebAssembly.instantiate(await resp.arrayBuffer());wasm=instance.exports;worker=new Worker(new URL('./rx-worker.js?v=0.8',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const r=pending.get(data.id);if(r){pending.delete(data.id);r(data);} };worker.onerror=e=>status('RX-Worker-Fehler: '+e.message);$('engine').textContent='✓ JS8-Kern · WASM aktiv';status('WASM-Codec geladen · Test mit „Eigenen Frame testen“ möglich.');}catch(e){$('engine').textContent='WASM nicht verfügbar';status('WASM konnte nicht geladen werden: '+e.message+' · Bitte über HTTPS oder HTTP-Server aufrufen.');}}
function make(){if(!wasm)throw Error('WASM-Engine nicht bereit');const text=$('message').value;const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+';if(text.length!==12||[...text].some(c=>!alphabet.includes(c)))throw Error('Es sind genau 12 gültige Frame-Zeichen erforderlich.');const mem=new Uint8Array(wasm.memory.buffer),p=wasm.js8_input_ptr();for(let i=0;i<12;i++)mem[p+i]=text.charCodeAt(i);const typ=Number($('type').value),m=mode();const code=wasm.js8_encode(typ,m.cos);if(code!==0)throw Error('WASM-Encoder-Fehler '+code);const view=new Int32Array(wasm.memory.buffer,wasm.js8_tones_ptr(),79);return {text,typ,tones:Array.from(view),mode:$('mode').value,freq:freq()};}
function prepare(){try{prepared=make();$('tx').disabled=!$('txconfirm').checked;info(`79 echte JS8-Tonsymbole generiert · ${prepared.mode.toUpperCase()} · ${prepared.freq} Hz · Frame-Typ ${prepared.typ}.`);status('JS8-Frame vorbereitet: '+prepared.text);}catch(e){prepared=null;$('tx').disabled=true;status(e.message);info(e.message);}}
$('prepare').onclick=prepare;$('txconfirm').onchange=()=>{$('tx').disabled=!prepared||!$('txconfirm').checked;};['mode','audioFreq','type','message'].forEach(id=>$(id).addEventListener('change',()=>{prepared=null;$('tx').disabled=true;info('Einstellungen geändert: Frame neu vorbereiten.');}));
function audioSamples(t,m,hz,sr){const n=m.period*sr,out=new Float32Array(n);let phase=0;const symSamples=Math.round(m.sps*sr/12000),start=Math.round(m.delay*sr),length=symSamples*t.length;for(let k=0;k<length;k++){const tone=t[Math.min(78,Math.floor(k/symSamples))];phase+=2*Math.PI*(hz+tone*12000/m.sps)/sr;if(phase>2*Math.PI)phase-=2*Math.PI;const fade=Math.max(0,Math.min(1,k/(symSamples*.10),(length-k)/(symSamples*.10)));out[start+k]=Math.sin(phase)*fade*0.65;}return out;}
function wavBytes(samples,sr){const n=samples.length,out=new ArrayBuffer(44+n*2),v=new DataView(out);function str(pos,s){for(let i=0;i<s.length;i++)v.setUint8(pos+i,s.charCodeAt(i));}str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);return new Blob([out],{type:'audio/wav'});}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
$('downloadTest').onclick=()=>{try{const p=make();download(wavBytes(audioSamples(p.tones,mode(),p.freq,12000),12000),`js8web-${p.mode}-${p.text}.wav`);status('Vollständige JS8-Testrahmen-WAV erzeugt.');}catch(e){status(e.message)}};
function rxDecode(payload){return new Promise(resolve=>{const id=++seq;pending.set(id,resolve);worker.postMessage({id,...payload},payload.samples?[payload.samples.buffer]:[]);});}
const seenFrames=new Set();
const textAssembler=new MessageAssembler();
const conversationTracker=new MessageSessionTracker();
window.addEventListener('js8:frame',event=>{
  const message=conversationTracker.accept(event.detail);
  if(message)window.dispatchEvent(new CustomEvent('js8:conversation',{detail:message}));
});
function row(result,origin,meta={}){
 if(!result.ok){status(origin+': '+result.reason+(Number.isFinite(result.q)?' · Sync '+result.q.toFixed(2):'')+(Number.isFinite(result.scanPeak)?' · stärkster Kandidat '+result.scanPeak.toFixed(0)+' Hz':''));return;}
 let frames=result.results?.length?result.results:[result],added=0;
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
    decodeJscFrame(f.text,f.type).then(decoded=>{
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
$('clear').onclick=()=>{seenFrames.clear();logs=[];window.dispatchEvent(new Event('js8:clear'));$('log').replaceChildren();$('framecount').textContent='0 Frames';};
$('csv').onclick=()=>{const rows=[['UTC','Mode','Type','Decoded','RawFrame','AudioHz','Sync','Decoder','Quelle'],...logs.map(x=>[x.time,x.mode,x.type,x.display,x.text,x.frequency,x.sync,x.strategy,x.origin])];let csv=rows.map(x=>x.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');download(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}),'js8web-rx-log.csv');};
$('synthetic').onclick=async()=>{try{if(!worker)throw Error('Worker nicht bereit');const p=make();status('Eigenen JS8-Frame über simulierten 12-kHz-Funkkanal decodieren …');const r=await rxDecode({synthetic:true,tones:p.tones,freq:p.freq,mode:p.mode});row(r,'Selbsttest');}catch(e){status('Selbsttest: '+e.message)}};
$('wav').onclick=()=>$('wavFile').click();
$('wavFile').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  if(!worker)throw Error('Worker nicht bereit');
  const ac=new AudioContext(),ab=await ac.decodeAudioData(await f.arrayBuffer());await ac.close();
  const m=mode(),sr=ab.sampleRate,src=ab.getChannelData(0),period=m.period,needed=79*m.sps/12000;
  const duration=src.length/sr,maxStart=Math.max(0,duration-period),hop=Math.min(2,Math.max(.5,(period-needed)/2));
  if(duration<needed)throw Error('WAV kürzer als ein JS8-Frame');
  let good=0,checks=0;
  for(let begin=0;begin<=maxStart+1e-7;begin+=hop){
   const from=Math.floor(begin*sr),to=Math.min(src.length,from+Math.ceil((period+2.5)*sr));
   const data=new Float32Array(src.slice(from,to));
   const res=await rxDecode({samples:data,sr,mode:$('mode').value,freq:freq(),auto:$('scanAuto').checked,enhanced:$('enhancedRx').checked,startMs:Date.now()+begin*1000});
   if(res.ok){good+=res.results?.length||1;row(res,'WAV '+f.name,{startMs:Date.now()+begin*1000,mode:$('mode').value});}
   if(++checks%4===0)status('WAV-Analyse: '+checks+' Fenster · '+good+' erfolgreiche Decodes');
  }
  status('WAV fertig: '+checks+' Suchfenster · '+good+' gültige Decodes'+(good?'':' · Prüfe Modus und Audioquelle'));
 }catch(ex){status('WAV-Fehler: '+ex.message);}e.target.value='';
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
let captureStartMs=0,captureFrames=0,pcmBlocks=[],nextRxSlot=0,activeMode='normal';
function windowAudio(beginMs,endMs,sr){
 const start=Math.round((beginMs-captureStartMs)*sr/1000),end=Math.round((endMs-captureStartMs)*sr/1000),out=new Float32Array(Math.max(0,end-start));
 for(const b of pcmBlocks){const a=Math.max(start,b.i),z=Math.min(end,b.i+b.data.length);if(z>a)out.set(b.data.subarray(a-b.i,z-b.i),a-start);}
 return out;
}
function acceptRxBuffer(a){
 const sr=ctx.sampleRate,m=MODES[activeMode],pms=m.period*1000;
 if(!captureStartMs){captureStartMs=Date.now()+Number($('offset').value||0)-a.length/sr*1000;nextRxSlot=Math.floor(captureStartMs/pms);}
 const b=new Float32Array(a);pcmBlocks.push({i:captureFrames,data:b});captureFrames+=b.length;
 const audioEndMs=captureStartMs+captureFrames/sr*1000,completed=Math.floor((audioEndMs-1000)/pms)-1;
 while(nextRxSlot<=completed){
  const thisSlot=nextRxSlot++,slotMs=thisSlot*pms,begin=slotMs-850,end=slotMs+pms+1000;
  const samples=windowAudio(begin,end,sr);
  if(samples.length>0){const meta={startMs:begin,mode:activeMode};rxDecode({samples,sr,mode:activeMode,freq:freq(),auto:$('scanAuto').checked,enhanced:$('enhancedRx').checked,startMs:begin}).then(r=>row(r,'Mikrofon',{...meta})).catch(err=>status('RX: '+err.message));}
 }
 const keepFrom=captureFrames-Math.ceil((m.period+5)*sr);
 pcmBlocks=pcmBlocks.filter(x=>x.i+x.data.length>keepFrom);
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
  captureStartMs=0;captureFrames=0;pcmBlocks=[];activeMode=$('mode').value;rxOn=true;
  $('mode').disabled=true;$('offset').disabled=true;$('rxDevice').disabled=true;
  processor.onaudioprocess=e=>{if(!rxOn)return;const a=e.inputBuffer.getChannelData(0);let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*a[i];$('rxLevel').textContent='RX · '+(20*Math.log10(Math.sqrt(sum/a.length)+1e-8)).toFixed(1)+' dBFS';acceptRxBuffer(a);};
  renderTimer=setInterval(spectrogram,95);$('start').disabled=true;$('stop').disabled=false;
  status('RX aktiv · '+ctx.sampleRate+' Hz · automatische Suche '+($('scanAuto').checked?'300–3000 Hz':'±30 Hz um Audiofrequenz')+' · '+activeMode.toUpperCase());
 }catch(e){status('Mikrofon-Start: '+e.message);stream?.getTracks().forEach(t=>t.stop());}
};
$('stop').onclick=()=>{
 rxOn=false;if(processor)processor.onaudioprocess=null;processor?.disconnect();source?.disconnect();zero?.disconnect();stream?.getTracks().forEach(t=>t.stop());
 clearInterval(renderTimer);analyser=null;pcmBlocks=[];captureStartMs=0;$('mode').disabled=false;$('offset').disabled=false;$('rxDevice').disabled=false;
 $('start').disabled=false;$('stop').disabled=true;worker?.postMessage({reset:true});status('RX gestoppt');
};
$('spectrum').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));$('audioFreq').value=Math.round(300+2700*x);status('Manuelle Audiofrequenz: '+freq()+' Hz');});
$('call').addEventListener('input',()=>{$('protocolCall').value=$('call').value.toUpperCase();});
function protocolPrepare(packet){
 $('message').value=packet.frame;$('type').value=String(packet.type);prepared=null;$('tx').disabled=true;prepare();
 $('protoInfo').textContent=packet.display+' · 12-Zeichen-Transportframe: '+packet.frame;
}
$('makeBeacon').onclick=()=>{try{protocolPrepare(makeHeartbeat($('call').value,$('locator').value,$('beaconKind').value));}catch(e){status('CQ/HB: '+e.message);}};
$('makeDirected').onclick=()=>{try{protocolPrepare(makeDirected($('call').value,$('targetCall').value,$('directCmd').value));}catch(e){status('Directed: '+e.message);}};
function pttActive(state){if(!serial||$('pttLine').value==='none')return Promise.resolve();return serial.setSignals($('pttLine').value==='rts'?{requestToSend:state}:{dataTerminalReady:state});}
$('serialConnect').onclick=async()=>{try{if(!navigator.serial)throw Error('WebSerial nur in kompatiblen Chromium-Browsern über HTTPS verfügbar');serial=await navigator.serial.requestPort();await serial.open({baudRate:9600});$('serialStatus').textContent='Port verbunden';$('serialConnect').disabled=true;$('serialDisconnect').disabled=false;status('WebSerial-Port verbunden – RTS/DTR nur mit korrekter PTT-Verdrahtung nutzen.');}catch(e){serial=null;status('WebSerial: '+e.message)}};
$('serialDisconnect').onclick=async()=>{try{await pttActive(false);await serial?.close();}catch(e){status(e.message);}finally{serial=null;$('serialStatus').textContent='Nicht verbunden';$('serialConnect').disabled=false;$('serialDisconnect').disabled=true;}};
let transmitting=false;
$('tx').onclick=async()=>{try{if(!prepared||!$('txconfirm').checked)throw Error('Vorbereiten und Laborfreigabe erforderlich');if(transmitting)return;const ac=await getAudio(),m=MODES[prepared.mode],now=Date.now(),off=Number($('offset').value||0),periodMs=m.period*1000,next=Math.ceil((now+off+400)/periodMs)*periodMs-off;const start=ac.currentTime+(next-now)/1000;const samples=audioSamples(prepared.tones,m,prepared.freq,ac.sampleRate);const buffer=ac.createBuffer(1,samples.length,ac.sampleRate);buffer.copyToChannel(samples,0);txSource=ac.createBufferSource();txSource.buffer=buffer;txSource.connect(ac.destination);transmitting=true;$('tx').disabled=true;$('cancel').disabled=false;txSource.onended=async()=>{if(!transmitting)return;transmitting=false;clearTimeout(pttTimer);await pttActive(false).catch(e=>status('PTT: '+e.message));$('cancel').disabled=true;$('tx').disabled=!$('txconfirm').checked;status('TX-Audio beendet, PTT aus.');};const wait=Math.max(0,next-now-200);pttTimer=setTimeout(()=>pttActive(true).catch(err=>status('PTT-Fehler: '+err.message)),wait);txSource.start(start);txSource.stop(start+m.period);status(`JS8-Laborframe TX eingeplant: ${new Date(next).toISOString().slice(11,19)} UTC · ${prepared.mode} · ${prepared.freq} Hz. Die Soundkarte kann für HF-TX eine eigene PTT-Anbindung benötigen.`);}catch(e){status('TX: '+e.message);transmitting=false;$('tx').disabled=false;$('cancel').disabled=true;}};
$('cancel').onclick=async()=>{clearTimeout(pttTimer);clearTimeout(txTimer);try{txSource?.stop();}catch{}transmitting=false;await pttActive(false).catch(e=>status(e.message));$('cancel').disabled=true;$('tx').disabled=!prepared||!$('txconfirm').checked;status('TX gestoppt, PTT deaktiviert.');};
window.addEventListener('beforeunload',()=>{if(transmitting)try{txSource?.stop()}catch{};});
init();

/* JSC text TX queue: uses the existing WebAssembly transport coder and
 * per-slot TX audio. Operator must explicitly approve every queue run. */
let textTxPacket=null,textTxIndex=0,textTxRunning=false,textTxAborted=false;
let textTxFingerprint='';
function txQueueFingerprint(){
  return [$('mode').value,$('audioFreq').value,$('call').value,$('textRecipient')?.value||'', $('textKind')?.value||'plain',$('txDevice')?.value||''].join('|');
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
  await $('tx').onclick();
  if(!transmitting||!txSource){textTxRunning=false;textTxEvent('error',{error:'Audio-Ausgabe konnte nicht gestartet werden'});return;}
  txSource.addEventListener('ended',()=>{
    if(!textTxRunning||textTxAborted)return;
    textTxIndex++;
    if(textTxIndex>=textTxPacket.frames.length){
      textTxRunning=false;textTxEvent('complete',{total:textTxPacket.frames.length});
    }else setTimeout(()=>sendTextFrame().catch(e=>{textTxRunning=false;textTxEvent('error',{error:e.message});}),500);
  },{once:true});
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
