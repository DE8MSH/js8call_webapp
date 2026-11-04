import {SoftFrameCombiner,subtractDecodedToneSequence} from './rx-enhance.js';
/* JS8Web LAB v0.8 browser receiver - GPL-3.0. Multi-frequency Costas/LDPC search.
   Weak-signal performance is experimental, not equivalent to the original WSJT-X decoder. */
let core;
const combiner=new SoftFrameCombiner({ttlMs:120000,capacity:48,maxRepeats:4});
const MODES={normal:{sps:1920,delay:.5,period:15,cos:0},fast:{sps:1200,delay:.2,period:10,cos:1},turbo:{sps:600,delay:.1,period:6,cos:1},slow:{sps:3840,delay:.5,period:30,cos:1}};
const COSTAS=[[[4,2,5,6,1,3,0],[4,2,5,6,1,3,0],[4,2,5,6,1,3,0]],[[0,6,2,3,5,4,1],[1,5,0,2,3,6,4],[2,5,0,6,4,1,3]]];
async function engine(){if(!core){let r=await fetch(new URL('./js8-core.wasm',import.meta.url));if(!r.ok)throw Error('WASM HTTP '+r.status);core=(await WebAssembly.instantiate(await r.arrayBuffer())).instance.exports;}return core;}
// Lowpass first at the original sample rate before 12 kHz decimation.
function resample(a,sr){
  if(!Number.isFinite(sr)||sr<8000||sr>192000)throw Error('Ungültige Abtastrate');
  if(Math.abs(sr-12000)<.1)return a;
  const ratio=sr/12000,n=Math.floor(a.length/ratio),out=new Float32Array(n);
  if(sr<=12500){for(let i=0;i<n;i++){const p=i*ratio,j=p|0,k=p-j;out[i]=(a[j]||0)*(1-k)+(a[j+1]||0)*k;}return out;}
  const half=24,phases=128,cutoff=3700/sr;
  const weights=Array.from({length:phases},(_,q)=>{
    const arr=new Float32Array(2*half+1),frac=q/phases;let sum=0;
    for(let k=-half;k<=half;k++){const x=k-frac,z=2*cutoff*x,u=x/half;
      const v=2*cutoff*(Math.abs(z)<1e-9?1:Math.sin(Math.PI*z)/(Math.PI*z))*(.42+.5*Math.cos(Math.PI*u)+.08*Math.cos(2*Math.PI*u));
      arr[k+half]=v;sum+=v;
    }
    for(let k=0;k<arr.length;k++)arr[k]/=sum;return arr;
  });
  for(let i=0;i<n;i++){const p=i*ratio,j=Math.floor(p),co=weights[Math.min(phases-1,Math.round((p-j)*(phases-1)))];let value=0,denom=0;
    for(let k=0;k<co.length;k++){const ix=j-half+k;if(ix>=0&&ix<a.length){value+=a[ix]*co[k];denom+=co[k];}}
    out[i]=denom>.1?value/denom:value;
  }
  return out;
}
function energy(a,start,count,f){if(start<0||start+count>a.length||f<100||f>5800)return 0;const w=2*Math.PI*f/12000,c=2*Math.cos(w);let s0=0,s1=0,s2=0,edge=Math.max(1,(count*.04)|0);for(let i=0;i<count;i++){let v=a[start+i];if(i<edge)v*=i/edge;else if(i>=count-edge)v*=(count-1-i)/edge;s0=v+c*s1-s2;s2=s1;s1=s0;}return Math.max(0,s1*s1+s2*s2-c*s1*s2);}
function fftPower(a,start,count,nfft){let re=new Float32Array(nfft),im=new Float32Array(nfft);let end=Math.min(count,a.length-start);if(start<0||end<count)return null;for(let i=0;i<count;i++){let w=.5-.5*Math.cos(2*Math.PI*i/(count-1));re[i]=a[start+i]*w;}for(let i=1,j=0;i<nfft;i++){let bit=nfft>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let x=re[i];re[i]=re[j];re[j]=x;}}
  for(let len=2;len<=nfft;len<<=1){let theta=-2*Math.PI/len,wr0=Math.cos(theta),wi0=Math.sin(theta);for(let j=0;j<nfft;j+=len){let wr=1,wi=0;for(let k=0;k<len/2;k++){let h=j+k,l=h+len/2,tr=wr*re[l]-wi*im[l],ti=wr*im[l]+wi*re[l],xr=re[h],xi=im[h];re[h]=xr+tr;im[h]=xi+ti;re[l]=xr-tr;im[l]=xi-ti;let q=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=q;}}}
  let pow=new Float32Array(Math.floor(3100*nfft/12000)+2);for(let i=0;i<pow.length;i++)pow[i]=re[i]*re[i]+im[i]*im[i];return pow;}
function spectralAt(spectrum,f,hzbin){let bin=f/hzbin,j=Math.floor(bin),t=bin-j;if(j<0||j+1>=spectrum.length)return 0;return spectrum[j]*(1-t)+spectrum[j+1]*t;}
function fineScore(a,start,freq,m){let sum=0,sps=m.sps,step=12000/sps,cos=COSTAS[m.cos];for(let i=0;i<21;i++){let sym=Math.floor(i/7)*36+i%7,k=cos[Math.floor(i/7)][i%7],at=start+sym*sps;let total=0,hit=0;for(let n=0;n<8;n++){let e=energy(a,at,sps,freq+n*step);total+=e;if(n===k)hit=e;}sum+=hit/(total+1e-12);}return sum/21;}
function search(a,m,low,high){let nfft=1;while(nfft<m.sps)nfft*=2;const hzbin=12000/nfft,step=12000/m.sps,cos=COSTAS[m.cos],maxStart=a.length-79*m.sps;
  let trial=[],hop=Math.max(150,Math.round(12000*.105));for(let x=0;x<=maxStart;x+=hop)trial.push(x);if(!trial.includes(maxStart))trial.push(maxStart);
  let top=[],highest=-1,peakFreq=0;
  for(let start of trial){let specs=[];for(let i=0;i<21;i++){let sym=Math.floor(i/7)*36+i%7;specs.push(fftPower(a,start+sym*m.sps,m.sps,nfft));}
    for(let base=low;base<=high-7*step;base+=hzbin){let score=0;for(let k=0;k<21;k++){let target=cos[Math.floor(k/7)][k%7],powers=specs[k],tot=1e-12,hit=0;for(let t=0;t<8;t++){let e=spectralAt(powers,base+t*step,hzbin);tot+=e;if(t===target)hit=e;}score+=hit/tot;}score/=21;if(score>highest){highest=score;peakFreq=base;}
      if(score<.22)continue;
      let candidate={q:score,start,freq:base},index=top.findIndex(x=>Math.abs(x.freq-base)<step*2.2&&Math.abs(x.start-start)<Math.max(hop*2,500));
      if(index>=0){if(score>top[index].q)top[index]=candidate;}else top.push(candidate);
      if(top.length>40){top.sort((a,b)=>b.q-a.q);top.length=26;}
    }
  }
  top.sort((a,b)=>b.q-a.q);return {candidates:top.slice(0,20),best:highest,peakFreq};
}
function refine(a,c,m){let best={q:-1,start:c.start,freq:c.freq},timeStep=Math.max(1,Math.round(.025*12000));for(let dt=-4;dt<=4;dt++){let start=c.start+dt*timeStep;if(start<0||start+79*m.sps>a.length)continue;for(let df=-4;df<=4;df+=2){const freq=c.freq+df,q=fineScore(a,start,freq,m);if(q>best.q)best={q,start,freq};}}return best;}
function demod(a,sync,m,soft=false){
 const scores=new Float32Array(174),step=12000/m.sps;
 for(let i=0;i<58;i++){
  let sym=i<29?7+i:43+(i-29),p=sync.start+sym*m.sps,pow=[];
  for(let t=0;t<8;t++)pow.push(energy(a,p,m.sps,sync.freq+t*step));
  const avg=pow.reduce((x,y)=>x+y,0)/8+1e-12;
  for(let k=0;k<3;k++){
   let hi=0,lo=0;
   if(soft){
    // Noise-normalized log-sum-exp (soft decision) alternative to max-log.
    const scale=Math.max(1e-12,avg*.55);
    const floor=Math.max(...pow);
    for(let t=0;t<8;t++){
      const v=Math.exp(Math.max(-60,Math.min(0,(pow[t]-floor)/scale)));
      if(t&(1<<(2-k)))hi+=v;else lo+=v;
    }
    scores[(i<29?i*3:87+(i-29)*3)+k]=Math.max(-8,Math.min(8,1.3*Math.log((hi+1e-12)/(lo+1e-12))));
   }else{
    for(let t=0;t<8;t++)if(t&(1<<(2-k)))hi=Math.max(hi,pow[t]);else lo=Math.max(lo,pow[t]);
    scores[(i<29?i*3:87+(i-29)*3)+k]=Math.max(-8,Math.min(8,1.5*(hi-lo)/avg));
   }
  }
 }
 return scores;
}
function createAudio(tones,m,freq){let a=new Float32Array(m.period*12000),phase=0,start=(m.delay*12000)|0;for(let i=0;i<tones.length*m.sps;i++){let tone=tones[Math.floor(i/m.sps)],hz=freq+tone*12000/m.sps;phase+=2*Math.PI*hz/12000;if(phase>=2*Math.PI)phase-=2*Math.PI;let fade=Math.min(1,i/(m.sps*.12),(tones.length*m.sps-i)/(m.sps*.12));a[start+i]=.7*Math.sin(phase)*Math.max(0,fade);}return a;}
function decodeCandidate(e,a,s,m,msg){
 const writable=new Float32Array(e.memory.buffer,e.js8_llr_ptr(),174);
 const primary=demod(a,s,m);
 writable.set(primary);
 let iters=e.js8_decode(),strategy='max-log',combined=0;
 if(iters<0&&msg.enhanced!==false){
  writable.set(demod(a,s,m,true));
  iters=e.js8_decode();strategy='log-sum-exp';
 }
 const hasTime=Number.isFinite(msg.startMs);
 let phase=0,slot=0;
 if(hasTime){
  const candidateMs=msg.startMs+(s.start/12),periodMs=m.period*1000;
  slot=Math.floor(candidateMs/periodMs);
  phase=(candidateMs-slot*periodMs)/1000;
 }
 if(iters<0&&hasTime&&msg.enhanced!==false&&s.q>=.4){
  const cached=combiner.observe({mode:msg.mode,frequency:s.freq,phase,slot,atMs:msg.startMs+s.start/12,llr:primary});
  if(cached.combined){
   writable.set(cached.llr);
   iters=e.js8_decode();strategy='repeat-soft';combined=cached.repeats;
  }
 }
 if(iters<0)return null;
 const raw=new Uint8Array(e.memory.buffer,e.js8_decoded_ptr(),12);
 const text=String.fromCharCode(...raw),type=e.js8_type();
 if(hasTime)combiner.markDecoded({mode:msg.mode,frequency:s.freq,phase});
 return{text,type,iters,sync:s.q,frequency:s.freq,dt:s.start/12000-m.delay,start:s.start,strategy,combined};
}
function cancelCandidate(e,residual,f,m){
 const memory=new Uint8Array(e.memory.buffer),offset=e.js8_input_ptr();
 for(let i=0;i<12;i++)memory[offset+i]=f.text.charCodeAt(i);
 if(e.js8_encode(f.type,m.cos)!==0)return{applied:false,fit:0};
 const tones=Array.from(new Int32Array(e.memory.buffer,e.js8_tones_ptr(),79));
 return subtractDecodedToneSequence(residual,{start:f.start,frequency:f.frequency,sps:m.sps,tones});
}
async function decode(msg){
 const e=await engine(),m=MODES[msg.mode];if(!m)throw Error('Unbekannter Submode');
 const a=msg.synthetic?createAudio(msg.tones,m,msg.freq):resample(msg.samples,msg.sr);
 if(a.length<79*m.sps)throw Error('Nicht genügend Samples für 79 Symbole');
 const auto=msg.auto!==false,focus=Number(msg.freq)||1500,
  lo=auto?300:Math.max(300,focus-30),
  hi=auto?3000:Math.min(3000,focus+30+7*12000/m.sps);
 const scan=search(a,m,lo,hi),found=[];
 let checked=0;
 function checkCandidates(signal,candidates,pass='main'){
  for(const c of candidates){
   const s=refine(signal,c,m);
   if(s.q<.4)continue;
   if(found.some(x=>Math.abs(x.frequency-s.freq)<12&&Math.abs(x.start-s.start)<m.sps))continue;
   checked++;
   const frame=decodeCandidate(e,signal,s,m,msg);
   if(frame){found.push({...frame,pass});if(found.length>=14)break;}
  }
 }
 checkCandidates(a,scan.candidates);
 let cancellations=0;
 // Bounded, localized successive interference cancellation. Only run when
 // a strong waveform is CRC-validated and a second signal could be hidden.
 if(msg.enhanced!==false&&msg.sic!==false&&found.length>0&&found.length<14){
  const residual=a.slice();
  for(const f of found.slice(0,2)){
   const removed=cancelCandidate(e,residual,f,m);
   if(removed.applied&&removed.fit>.15)cancellations++;
  }
  if(cancellations){
   const freqs=found.map(f=>f.frequency),
    bandLo=Math.max(lo,Math.min(...freqs)-135),
    bandHi=Math.min(hi,Math.max(...freqs)+135+7*12000/m.sps);
   if(bandHi-bandLo>25){
    const second=search(residual,m,bandLo,bandHi);
    checkCandidates(residual,second.candidates,'SIC');
   }
  }
 }
 found.sort((a,b)=>b.sync-a.sync);
 if(found.length)return{ok:true,...found[0],results:found,checked,scanPeak:scan.peakFreq,cancellations};
 return{ok:false,reason:'Kein CRC/LDPC-gültiger JS8-Frame ('+scan.candidates.length+' Sync-Kandidaten)',
   q:scan.best,scanPeak:scan.peakFreq,checked};
}
self.onmessage=async ev=>{if(ev.data?.reset){combiner.clear();return;}try{self.postMessage({id:ev.data.id,...await decode(ev.data)});}catch(ex){self.postMessage({id:ev.data.id,ok:false,reason:String(ex.message||ex)});}};