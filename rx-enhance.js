/* JS8Web RX enhancements — GPL-3.0-or-later.
 * Soft-combining concept: JS8_Mode/soft_combiner.h in uploaded JS8Call source.
 * Positive LLR means bit 1; combine only independent OTA slots. */
export function llrSignature(llr){
  if(llr.length!==174)throw Error('174 soft bits expected');
  let bits=0,p=0;
  for(let i=0;i<32;i++){p=(p+37)%174;if(llr[p]>=0)bits=(bits|(1<<i));}
  return bits>>>0;
}
export function hamming32(a,b){let n=(a^b)>>>0,count=0;while(n){n&=n-1;count++;}return count;}
export class SoftFrameCombiner {
  constructor({ttlMs=120000,capacity=48,maxRepeats=4}={}){
    this.ttlMs=ttlMs;this.capacity=capacity;this.maxRepeats=maxRepeats;this.entries=[];
  }
  clear(){this.entries.length=0;}
  observe({mode,frequency,phase,slot,atMs=Date.now(),llr}){
    if(!Number.isFinite(frequency)||!Number.isFinite(phase)||!Number.isInteger(slot)||llr?.length!==174)
      return{combined:false,repeats:0,llr};
    this.entries=this.entries.filter(x=>Math.abs(atMs-x.lastSeen)<=this.ttlMs);
    const signature=llrSignature(llr);
    const match=this.entries.find(x=>x.mode===mode && Math.abs(x.frequency-frequency)<=3 &&
      Math.abs(x.phase-phase)<=.18 && hamming32(x.signature,signature)<=4);
    if(!match){
      this.entries.push({mode,frequency,phase,slot,signature,lastSeen:atMs,llr:Float32Array.from(llr),repeats:1,slots:new Set([slot])});
      if(this.entries.length>this.capacity)this.entries.splice(0,this.entries.length-this.capacity);
      return{combined:false,repeats:1,llr};
    }
    // Overlapping RX windows, delayed jobs and duplicate candidates are not
    // independent observations of the same over-the-air transmission.
    if(match.slots.has(slot))return{combined:false,repeats:match.repeats,llr};
    const sums=match.llr;
    for(let i=0;i<174;i++)sums[i]=Math.max(-32,Math.min(32,sums[i]+llr[i]));
    match.slots.add(slot);match.slot=slot;match.lastSeen=atMs;match.repeats=Math.min(this.maxRepeats,match.repeats+1);
    if(match.slots.size>this.maxRepeats){
      this.entries=this.entries.filter(x=>x!==match);
      return{combined:false,repeats:0,llr};
    }
    return{combined:true,repeats:match.repeats,llr:Float32Array.from(sums)};
  }
  markDecoded({mode,frequency,phase}){
    this.entries=this.entries.filter(x=>!(x.mode===mode&&Math.abs(x.frequency-frequency)<=3&&Math.abs(x.phase-phase)<=.18));
  }
}
/* Cancel a decoded 79-symbol signal with a 2-D least-squares sinusoid fit.
 * Never reports a decoded frame without passing the independent WASM CRC/LDPC.
 */
export function subtractDecodedToneSequence(samples,{start,frequency,sps,tones,sampleRate=12000,minFit=.055}){
  if(tones?.length!==79||!Number.isFinite(frequency)||!Number.isFinite(sps)||
     sps<=0||!Number.isInteger(start)||start<0||start+79*sps>samples.length)
    return {applied:false,fit:0,power:0};
  const count=79*sps,step=sampleRate/sps,w=2*Math.PI/sampleRate;
  let phase=0,ss=0,cc=0,sc=0,sy=0,cy=0,yy=0;
  for(let i=0;i<count;i++){
    phase+=w*(frequency+tones[(i/sps)|0]*step);
    if(phase>2*Math.PI)phase-=2*Math.PI;
    const taper=Math.max(0,Math.min(1,i/(sps*.12),(count-i)/(sps*.12)));
    const sn=Math.sin(phase)*taper,cs=Math.cos(phase)*taper,y=samples[start+i];
    ss+=sn*sn;cc+=cs*cs;sc+=sn*cs;sy+=sn*y;cy+=cs*y;yy+=y*y;
  }
  const det=ss*cc-sc*sc;if(det<=1e-7||yy<=1e-10)return{applied:false,fit:0,power:0};
  const a=(cc*sy-sc*cy)/det,b=(ss*cy-sc*sy)/det;
  const fit=Math.max(0,Math.min(1,(a*sy+b*cy)/yy));
  if(fit<minFit)return{applied:false,fit,power:0};
  phase=0;
  for(let i=0;i<count;i++){
    phase+=w*(frequency+tones[(i/sps)|0]*step);
    if(phase>2*Math.PI)phase-=2*Math.PI;
    const taper=Math.max(0,Math.min(1,i/(sps*.12),(count-i)/(sps*.12)));
    samples[start+i]-=(a*Math.sin(phase)+b*Math.cos(phase))*taper;
  }
  return{applied:true,fit,power:a*a+b*b};
}
