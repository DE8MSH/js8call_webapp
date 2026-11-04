import fs from 'node:fs';
const root=new URL('../',import.meta.url),binary=fs.readFileSync(new URL('../js8-core.wasm',import.meta.url));
const w=(await WebAssembly.instantiate(binary)).instance.exports;
const replies=[];globalThis.fetch=async()=>new Response(binary,{status:200});globalThis.self={postMessage:x=>replies.push(x)};
await import('../rx-worker.js');
let tests=0;
function check(cond,name){if(!cond)throw Error('FAIL '+name);console.log('[ OK ] '+name);tests++;}
const modes={normal:[1920,15,.5,0],fast:[1200,10,.2,1],turbo:[600,6,.1,1],slow:[3840,30,.5,1]};
function audio(tones,mode,f,sr,shift=0,noise=0,amp=.7){let [sps,period,delay]=modes[mode];let wave=new Float32Array(Math.round(period*sr)),phase=0,nsps=sps*sr/12000,start=Math.floor((delay+shift)*sr),length=Math.round(79*nsps);for(let k=0;k<length;k++){let sym=Math.min(78,Math.floor(k/nsps)),hz=f+tones[sym]*12000/sps;phase+=2*Math.PI*hz/sr;wave[start+k]=Math.sin(phase)*amp*Math.max(0,Math.min(1,k/(nsps*.12),(length-k)/(nsps*.12)));}if(noise){let x=12345;for(let i=0;i<wave.length;i++){x=(1664525*x+1013904223)>>>0;wave[i]+=noise*((x/4294967296)*2-1);}}return wave;}
async function rx(samples,mode,sr=12000){const before=replies.length;self.onmessage({data:{id:tests+41,samples,sr,mode,freq:1500,auto:true}});for(let n=0;n<500&&replies.length===before;n++)await new Promise(r=>setTimeout(r,25));return replies.at(-1);}
for(const [mode,freq,shift,sr,noise] of [['normal',650,.12,12000,.04],['fast',2550,-.08,12000,.025],['slow',1750,.18,12000,.02],['turbo',1250,.03,12000,.02],['normal',2085,-.16,48000,.03],['fast',910,.2,48000,.02],['normal',870,1.1,12000,.01]]){
 const mem=new Uint8Array(w.memory.buffer);mem.set(Buffer.from('0123456789AB'),w.js8_input_ptr());const m=modes[mode];w.js8_encode(3,m[3]);const tones=Array.from(new Int32Array(w.memory.buffer,w.js8_tones_ptr(),79));const a=audio(tones,mode,freq,sr,shift,noise);let start=performance.now(),decoded=await rx(a,mode,sr);check(decoded.ok&&decoded.text==='0123456789AB'&&Math.abs(decoded.frequency-freq)<8,`${mode} auto RX at ${freq}Hz, clock shift ${shift}s, ${sr}Hz, noise ${noise} (${(performance.now()-start).toFixed(0)}ms), reason ${decoded.reason||'decoded'}`);
}
{
 const mem=new Uint8Array(w.memory.buffer);
 mem.set(Buffer.from('0123456789AB'),w.js8_input_ptr());w.js8_encode(3,0);
 const a=Array.from(new Int32Array(w.memory.buffer,w.js8_tones_ptr(),79));
 mem.set(Buffer.from('CDEFGHIJKLMN'),w.js8_input_ptr());w.js8_encode(3,0);
 const b=Array.from(new Int32Array(w.memory.buffer,w.js8_tones_ptr(),79));
 const wa=audio(a,'normal',750,12000,.02,.005,.65),wb=audio(b,'normal',1900,12000,.04,0,.6);
 for(let i=0;i<wa.length;i++)wa[i]+=wb[i];
 const r=await rx(wa,'normal',12000),strings=r.results?.map(x=>x.text)||[];
 check(r.ok&&strings.includes('0123456789AB')&&strings.includes('CDEFGHIJKLMN'),'Decode two simultaneous JS8 signals at 750/1900Hz ('+strings+')');
}
{
 let a=new Float32Array(180000),seed=42;for(let i=0;i<a.length;i++){seed=(Math.imul(1664525,seed)+1013904223)>>>0;a[i]=(seed/4294967296-.5)*.2;}
 const r=await rx(a,'normal',12000);
 check(!r.ok,'No false positive in deterministic noise-only window');
}
console.log('Passed '+tests+' wideband scan cases.');