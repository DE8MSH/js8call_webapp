/* JS8Web LAB v1.0 - clock-aligned live multi-submode scheduling.
 * Pure scheduling code, testable without a microphone/browser. GPL-3.0-or-later. */
export const LIVE_PERIODS=Object.freeze({normal:15000,fast:10000,turbo:6000,slow:30000});

/** Collects one complete audio window per UTC slot AND submode.
 * startMs/endMs are in the user's adjusted UTC time domain.
 * Every mode retains its own next-slot counter, independent of others. */
export class LiveSlotPlanner{
 constructor({periods=LIVE_PERIODS,prerollMs=850,postrollMs=1000,settleMs=1000,
   maximumLagMs=45000,maxPerCollect=32}={}){
  this.periods=periods;this.prerollMs=prerollMs;this.postrollMs=postrollMs;
  this.settleMs=settleMs;this.maximumLagMs=maximumLagMs;this.maxPerCollect=maxPerCollect;
  this.reset(0,[]);
 }
 reset(captureStartMs,modeNames){
  if(!Number.isFinite(captureStartMs))throw Error('Live-RX: invalid capture timestamp');
  this.captureStartMs=captureStartMs;
  this.modes=[...new Set(modeNames)];
  this.nextSlots=new Map();
  this.skipped=0;
  for(const mode of this.modes){
   const ms=this.periods[mode];
   if(!Number.isFinite(ms)||ms<1000)throw Error('Live-RX: unknown mode '+mode);
   // Never decode the interrupted slot during which RX was switched on.
   this.nextSlots.set(mode,Math.ceil((captureStartMs+this.prerollMs)/ms));
  }
 }
 collect(audioEndMs){
  if(!Number.isFinite(audioEndMs))throw Error('Live-RX: invalid audio timestamp');
  const jobs=[];
  for(const mode of this.modes){
   const periodMs=this.periods[mode];
   let slot=this.nextSlots.get(mode);
   // complete only after the trailing audio margin has been captured
   const last=Math.floor((audioEndMs-this.settleMs)/periodMs)-1;
   if(last<slot)continue;
   // Skip stale windows after a resumed/suspended browser tab, in O(1).
   const earliest=Math.ceil((audioEndMs-this.maximumLagMs+this.prerollMs)/periodMs);
   if(earliest>slot){this.skipped+=earliest-slot;slot=earliest;}
   for(;slot<=last;slot++){
    const startMs=slot*periodMs-this.prerollMs,endMs=(slot+1)*periodMs+this.postrollMs;
    if(startMs<this.captureStartMs||audioEndMs<endMs){this.skipped++;continue;}
    if(jobs.length>=this.maxPerCollect){this.skipped++;continue;}
    jobs.push({mode,slot,startMs,endMs,periodMs});
   }
   this.nextSlots.set(mode,Math.max(slot,last+1));
  }
  jobs.sort((a,b)=>a.endMs-b.endMs||a.mode.localeCompare(b.mode));
  return jobs;
 }
}

/** Bounded FIFO with two independent DSP lanes, no unbounded WebWorker backlog.
 * decode(job,lane) must settle. A promise rejection does not poison the queue.
 * reset() invalidates all in-flight callbacks; worker termination is external. */
export class BoundedLiveDecoder{
 constructor({decode,onResult=()=>{},onError=()=>{},onDrop=()=>{},now=()=>Date.now(),
   concurrency=2,maxQueued=5,maxAgeMs=30000}={}){
  if(typeof decode!=='function'||!Number.isInteger(concurrency)||concurrency<1||
     !Number.isInteger(maxQueued)||maxQueued<1)throw Error('Live-RX: invalid decoder configuration');
  this.decode=decode;this.onResult=onResult;this.onError=onError;this.onDrop=onDrop;
  this.now=now;this.maxAgeMs=maxAgeMs;this.maxQueued=maxQueued;
  this.lanes=Array.from({length:concurrency},()=>null);
  this.waiting=[];this.generation=0;
  this.dropped=0;this.completed=0;
 }
 get busy(){return this.lanes.filter(Boolean).length;}
 get queued(){return this.waiting.length;}
 submit(job){
  if(!job||typeof job.mode!=='string'||!Number.isFinite(job.endMs))throw Error('Live-RX: invalid job');
  const key=job.mode+'|'+job.slot;
  if(this.waiting.some(j=>j.key===key)||this.lanes.some(l=>l?.key===key))return false;
  if(this.now()-job.endMs>this.maxAgeMs){
   this.dropped++;this.onDrop(job,'stale');return false;
  }
  const item={...job,key};
  if(this.waiting.length>=this.maxQueued){
   // Preserve the latest window from each mode when overloaded.
   const duplicateMode=this.waiting.findIndex(j=>j.mode===item.mode);
   const victim=this.waiting.splice(duplicateMode>=0?duplicateMode:0,1)[0];
   this.dropped++;this.onDrop(victim,'queue-full');
  }
  this.waiting.push(item);
  this.drain();
  return true;
 }
 drain(){
  for(let lane=0;lane<this.lanes.length;lane++){
   if(this.lanes[lane])continue;
   let job;
   while(this.waiting.length){
    job=this.waiting.shift();
    if(this.now()-job.endMs<=this.maxAgeMs)break;
    this.dropped++;this.onDrop(job,'stale');job=null;
   }
   if(!job)break;
   const epoch=this.generation;
   this.lanes[lane]=job;
   Promise.resolve().then(()=>this.decode(job,lane)).then(result=>{
    if(this.generation!==epoch)return;
    this.completed++;this.onResult(result,job);
   }).catch(error=>{
    if(this.generation===epoch)this.onError(error,job);
   }).finally(()=>{
    if(this.generation!==epoch)return;
    this.lanes[lane]=null;this.drain();
   });
  }
 }
 reset(){
  this.generation++;
  this.waiting=[];
  this.lanes.fill(null);
  this.dropped=0;this.completed=0;
 }
}
