/* Browser-native JS8Call JSC (s=7,c=9) dense-word decoder.
 * GPL-3.0-or-later: derived from js8call/js8call jsc.cpp and varicode.cpp.
 * Dictionary from upstream jsc_map.cpp, 8 static chunks, no remote API.
 */
const ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+';
const MAX_WORDS=262144,CHUNK_SIZE=32768,BASE=[0,7,70,637,5740,51667,465010,4185097];
const cachedChunks=new Map(),inflight=new Map();
export function rawFrameBits(frame){
  if(typeof frame!=='string'||frame.length!==12)throw Error('JS8 JSC: ungültige Framelänge');
  let bits='';
  for(const char of frame){const n=ALPHABET.indexOf(char);if(n<0)throw Error('JS8 JSC: ungültiges Zeichen');bits+=n.toString(2).padStart(6,'0');}
  return bits;
}
export function denseWordIndices(bits){
  const bytes=[],separators=new Set();
  for(let i=0;i+4<=bits.length;){
    const value=parseInt(bits.slice(i,i+4),2);i+=4;bytes.push(value);
    if(value<7){if(i<bits.length&&bits[i]==='1')separators.add(bytes.length-1);i++;}
  }
  const words=[];
  for(let start=0;start<bytes.length;){
    let k=0,j=0;
    while(start+k<bytes.length&&bytes[start+k]>=7){
      j=j*9+(bytes[start+k]-7);
      k++;
      if(k>7||j>=MAX_WORDS)return{words,complete:false};
    }
    if(start+k>=bytes.length)return{words,complete:false};
    const index=j*7+bytes[start+k]+BASE[k];
    if(index<0||index>=MAX_WORDS)return{words,complete:false};
    words.push({index,space:separators.has(start+k)});
    start+=k+1;
  }
  return{words,complete:true};
}
export function extractJscPayload(frame,transportType){
  const bits=rawFrameBits(frame);
  // JS8CallData transport flag: full 72 bits of compressed text; normal
  // frames encode data with a [1,1] marker followed by 70 data bits.
  const first=(transportType&4)===4?0:(bits.slice(0,2)==='11'?2:-1);
  if(first<0)return null;
  const end=bits.lastIndexOf('0');
  if(end<first||!/^1*$/.test(bits.slice(end+1)))return null;
  return bits.slice(first,end);
}
async function chunk(n){
  if(cachedChunks.has(n))return cachedChunks.get(n);
  if(inflight.has(n))return inflight.get(n);
  const task=(async()=>{
    const response=await fetch(new URL('./jsc-dict/chunk'+n+'.json',import.meta.url));
    if(!response.ok)throw Error('JS8 JSC Wörterbuch '+n+': HTTP '+response.status);
    const data=await response.json();
    if(!Array.isArray(data)||data.length!==CHUNK_SIZE)throw Error('Ungültiger JSC-Wörterbuchteil '+n);
    cachedChunks.set(n,data);return data;
  })();
  inflight.set(n,task);
  try{return await task}finally{inflight.delete(n)}
}
async function lookup(index){const c=await chunk(index>>>15);return c[index&32767];}
export async function decodeJscFrame(frame,transportType,resolveWord=lookup){
  const payload=extractJscPayload(frame,transportType);
  if(payload===null)return null;
  const {words,complete}=denseWordIndices(payload);
  if(!complete||!words.length)return null;
  const values=await Promise.all(words.map(async ({index,space})=>{
    const word=await resolveWord(index);
    if(typeof word!=='string')throw Error('JSC-Wörterbucheintrag fehlt: '+index);
    return word+(space?' ':'');
  }));
  return{kind:'text',format:'JSC',display:values.join(''),words:words.length,complete:true};
}
/* A packet marked FIRST/LAST is a self-contained or multi-frame message.
   Never concatenate across non-adjacent slots or frequencies. */
export class MessageAssembler{
  constructor(){this.pending=[];this.seen=new Set();}
  add(event){
    const {frame,text,mode,frequency,type,time,period=15}=event;
    const payload=String(text??'');if(!payload)return null;
    const stamp=new Date(time).getTime();
    const key=[mode,Math.round(stamp/1000),Math.round(frequency),frame].join('|');
    if(this.seen.has(key))return null;
    this.seen.add(key);if(this.seen.size>800)this.seen.delete(this.seen.values().next().value);
    const first=!!(type&1),last=!!(type&2);
    const isCompatible=p=>p.mode===mode&&Math.abs(p.frequency-frequency)<9&&stamp>=p.time&&stamp-p.time<=(period+3)*1000;
    this.pending=this.pending.filter(p=>stamp-p.time<=Math.max(35000,period*3000));
    if(first){
      this.pending=this.pending.filter(p=>!(p.mode===mode&&Math.abs(p.frequency-frequency)<9));
      if(last)return{display:payload,complete:true,frames:1};
      this.pending.push({mode,frequency,time:stamp,text:payload,frames:1});
      return{display:payload,complete:false,frames:1};
    }
    const p=this.pending.find(isCompatible);
    if(p){
      p.text+=payload;p.time=stamp;p.frames++;
      if(last){this.pending=this.pending.filter(x=>x!==p);return{display:p.text,complete:true,frames:p.frames};}
      return{display:p.text,complete:false,frames:p.frames};
    }
    return{display:payload,complete:last,orphan:!last,frames:1};
  }
}
