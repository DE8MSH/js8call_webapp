/* JS8Web LAB receiver – one-frequency Costas detection and sparse LDPC WASM.
   Experimental receiver: not a replacement for JS8Call's search/soft decoder. */
let core;
const MODES={normal:{sps:1920,delay:0.5,period:15,cos:0},fast:{sps:1200,delay:0.2,period:10,cos:1},turbo:{sps:600,delay:0.1,period:6,cos:1},slow:{sps:3840,delay:0.5,period:30,cos:1}};
const COSTAS=[[[4,2,5,6,1,3,0],[4,2,5,6,1,3,0],[4,2,5,6,1,3,0]],[[0,6,2,3,5,4,1],[1,5,0,2,3,6,4],[2,5,0,6,4,1,3]]];
async function engine(){if(!core){const r=await fetch(new URL('./js8-core.wasm',import.meta.url));if(!r.ok)throw Error('WASM-HTTP '+r.status);const {instance}=await WebAssembly.instantiate(await r.arrayBuffer());core=instance.exports;}return core;}
function resample(a,sr){if(Math.abs(sr-12000)<1)return a;const n=Math.floor(a.length*12000/sr);const out=new Float32Array(n);for(let i=0;i<n;i++){let p=i*sr/12000,j=p|0,k=p-j;out[i]=(a[j]||0)*(1-k)+(a[j+1]||0)*k;}return out;}
// Goertzel energy at exact target frequency, Hann window applied for robustness.
function energy(a,start,count,f){if(start<0||start+count>a.length||f<100)return 0;const w=2*Math.PI*f/12000,c=2*Math.cos(w);let s0=0,s1=0,s2=0;const edge=Math.max(1,(count*0.045)|0);for(let i=0;i<count;i++){let x=a[start+i];if(i<edge)x*=i/edge;else if(i>count-edge)x*=(count-i)/edge;s0=x+c*s1-s2;s2=s1;s1=s0;}return Math.max(0,s1*s1+s2*s2-c*s1*s2);}
function findSync(a,freq,m){const sps=m.sps,delta=12000/sps,costas=COSTAS[m.cos],nom=Math.round(m.delay*12000);let best={q:-1,start:nom,freq};
  // Limited search around expected UTC start and selected audio frequency.
  for(let offs=-5;offs<=5;offs++){let start=nom+offs*Math.round(0.032*12000);for(let df=-8;df<=8;df+=4){let sum=0;for(let k=0;k<21;k++){const sym=Math.floor(k/7)*36+k%7,t=costas[(k/7)|0][k%7],p=start+sym*sps;if(p<0||p+sps>a.length){sum=-1;break;}let e=0,total=0;for(let n=0;n<8;n++){const v=energy(a,p,sps,freq+df+n*delta);total+=v;if(n===t)e=v;}sum+=e/(total+1e-12);}let q=sum/21;if(q>best.q)best={q,start,freq:freq+df};}}
  return best;
}
function demod(a,sync,m){const scores=new Float32Array(174),sps=m.sps,step=12000/sps;for(let i=0;i<58;i++){const sym=i<29?7+i:43+i-29,p=sync.start+sym*sps;let powers=[];for(let t=0;t<8;t++)powers.push(energy(a,p,sps,sync.freq+t*step));let avg=powers.reduce((x,y)=>x+y,0)/8+1e-12;for(let k=0;k<3;k++){let hi=0,lo=0;for(let t=0;t<8;t++)if(t&(1<<(2-k)))hi=Math.max(hi,powers[t]);else lo=Math.max(lo,powers[t]);let diff=(hi-lo)/avg,idx=i<29?i*3+k:87+(i-29)*3+k;scores[idx]=Math.max(-8,Math.min(8,diff*1.2));}}return scores;}
function createAudio(tones,m,freq){const out=new Float32Array(m.period*12000);let phi=0,sp=m.sps,step=12000/sp,start=(m.delay*12000)|0;for(let i=0;i<tones.length*sp;i++){const tone=tones[Math.floor(i/sp)],hz=freq+tone*step;phi+=2*Math.PI*hz/12000;if(phi>2*Math.PI)phi-=2*Math.PI;let fade=Math.min(1,i/(sp*0.12),(tones.length*sp-i)/(sp*0.12));out[start+i]=0.7*Math.sin(phi)*Math.max(0,fade);}return out;}
async function decode(msg){const e=await engine(),m=MODES[msg.mode];if(!m)throw Error('Unbekannter Modus');let samples=msg.synthetic?createAudio(msg.tones,m,msg.freq):resample(msg.samples,msg.sr);if(samples.length < m.delay*12000+79*m.sps)throw Error('Zu wenig Samples für einen vollständigen Frame');
  const sync=findSync(samples,msg.freq,m);if(sync.q<0.21)return{ok:false,reason:'Kein eindeutiger Costas-Sync',q:sync.q};
  let b=e.memory.buffer,p=e.js8_llr_ptr();new Float32Array(b,p,174).set(demod(samples,sync,m));let iters=e.js8_decode();if(iters<0)return{ok:false,reason:'LDPC/CRC konnte Daten nicht decodieren',q:sync.q};
  const raw=new Uint8Array(e.memory.buffer,e.js8_decoded_ptr(),12);return{ok:true,text:String.fromCharCode(...raw),type:e.js8_type(),iters,sync:sync.q,frequency:sync.freq,dt:sync.start/12000-m.delay};
}
self.onmessage=async ev=>{try{const result=await decode(ev.data);self.postMessage({id:ev.data.id,...result});}catch(ex){self.postMessage({id:ev.data.id,ok:false,reason:String(ex.message||ex)});}};
