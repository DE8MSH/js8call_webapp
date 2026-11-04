import assert from 'node:assert/strict';
import {LIVE_PERIODS,LiveSlotPlanner,BoundedLiveDecoder} from '../live-rx.js';

assert.deepEqual(Object.values(LIVE_PERIODS),[15000,10000,6000,30000]);
const modes=['normal','fast','turbo','slow'];
const planner=new LiveSlotPlanner({maximumLagMs:90000});
planner.reset(10300,modes);
const early=planner.collect(19000);
assert.deepEqual(early.map(j=>[j.mode,j.slot]),[['turbo',2]]);
assert.deepEqual(planner.collect(19000),[],'same capture callback cannot duplicate slots');
const next=planner.collect(31000);
assert.deepEqual(next.map(j=>[j.mode,j.slot]),[
  ['turbo',3],['fast',2],['normal',1],['turbo',4]
].sort((a,b)=>{
 const aa=([m,s])=>(s+1)*LIVE_PERIODS[m]+1000;
 return aa(a)-aa(b)||a[0].localeCompare(b[0]);
}));
const later=planner.collect(61000);
assert.ok(later.some(j=>j.mode==='slow'&&j.slot===1),'SLOW decode at 61 s');
assert.equal(new Set([...early,...next,...later].map(j=>j.mode+':'+j.slot)).size,
  early.length+next.length+later.length,'slots never duplicated');
for(const job of [...early,...next,...later]){
 assert.ok(job.startMs>=10300,'no partial RX frame at start');
 assert.ok(job.endMs<=(job.slot+1)*job.periodMs+1000);
}
const stalled=new LiveSlotPlanner({maximumLagMs:40000,maxPerCollect:20});
stalled.reset(0,modes);
const jobs=stalled.collect(240000);
assert.ok(jobs.length<=20,'bounded catch-up');
assert.ok(stalled.skipped>0,'skips obsolete slots after suspended tab');
assert.ok(jobs.every(j=>240000-j.endMs<=40000),'no excessively old job');
stalled.reset(300000,['normal']);
assert.equal(stalled.collect(331000).some(j=>j.mode==='turbo'),false,'mode changes reset the plan');

const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
let now=100000,results=[],errors=[],drops=[],started=[];
const deferred=[];
const q=new BoundedLiveDecoder({
 now:()=>now,concurrency:2,maxQueued:2,maxAgeMs:45000,
 decode:(job,lane)=>new Promise((resolve,reject)=>{started.push([job.mode,job.slot,lane]);deferred.push({resolve,reject,job,lane});}),
 onResult:(result,job)=>results.push([job.mode,result]),
 onError:(error,job)=>errors.push([job.mode,error.message]),
 onDrop:(job,reason)=>drops.push([job.mode,reason])
});
const j=(mode,slot,endMs=99000)=>({mode,slot,endMs});
assert.equal(q.submit(j('normal',1)),true);
assert.equal(q.submit(j('fast',1)),true);
assert.equal(q.submit(j('turbo',1)),true);
assert.equal(q.submit(j('slow',1)),true);
assert.equal(q.queued,2);
assert.equal(q.submit(j('fast',1)),false,'pending duplicate suppressed');
assert.equal(q.submit(j('normal',1)),false,'in-flight duplicate suppressed');
assert.equal(q.submit(j('normal',2)),true);
assert.equal(q.dropped,1,'bounded queue evicts an older job');
assert.equal(q.queued,2);
await flush();
assert.equal(started.length,2);
assert.deepEqual(started.map(x=>x[2]),[0,1],'two physical lanes used');
deferred[0].resolve({ok:true});await flush();
assert.equal(results.length,1);
assert.equal(started.length,3,'queue drains when a lane becomes free');
deferred[1].reject(new Error('DSP worker failed'));await flush();
assert.deepEqual(errors,[['fast','DSP worker failed']]);
assert.equal(started.length,4,'one failed lane does not poison the scheduler');
deferred[2].resolve({ok:true});deferred[3].resolve({ok:true});await flush();
assert.equal(q.busy,0);assert.equal(q.queued,0);
assert.equal(results.length,3);
now=160000;
assert.equal(q.submit(j('turbo',5,100000)),false,'stale job dropped immediately');
assert.ok(drops.some(x=>x[1]==='stale'));
const p=q.submit(j('normal',6,159000));
await flush();assert.equal(p,true);
const before=results.length;
q.reset();
deferred.at(-1).resolve({ok:true});await flush();
assert.equal(results.length,before,'late response after RX stop is ignored');
assert.equal(q.busy,0);

{
 const started=[],tasks=[],output=[];
 const perMode=new BoundedLiveDecoder({
  now:()=>500000,concurrency:2,maxQueued:3,maxAgeMs:30000,
  decode:(job,lane)=>new Promise(resolve=>{started.push([job.mode,job.slot,lane]);tasks.push(resolve);}),
  onResult:(result,job)=>output.push(job.slot)
 });
 perMode.submit({mode:'normal',slot:1,endMs:499000});
 perMode.submit({mode:'normal',slot:2,endMs:499000});
 await flush();
 assert.equal(started.length,1,'two NORMAL slots must not be decoded concurrently');
 perMode.submit({mode:'fast',slot:1,endMs:499000});
 await flush();
 assert.equal(started.length,2,'different submodes may decode concurrently');
 tasks[0]('ok');await flush();
 assert.equal(started.length,3,'next NORMAL slot begins only after older NORMAL completes');
 tasks[1]('ok');tasks[2]('ok');await flush();
 assert.deepEqual(output.sort(),[1,1,2].sort());
}
{
 const seen=[],done=[];
 const decoder=new BoundedLiveDecoder({
  concurrency:2,maxQueued:3,now:()=>600000,maxAgeMs:30000,
  laneForMode:mode=>mode==='normal'||mode==='slow'?0:1,
  decode:(job,lane)=>new Promise(resolve=>{seen.push([job.mode,lane]);done.push(resolve);})
 });
 decoder.submit({mode:'normal',slot:1,endMs:599000});
 decoder.submit({mode:'fast',slot:1,endMs:599000});
 decoder.submit({mode:'slow',slot:1,endMs:599000});
 decoder.submit({mode:'turbo',slot:1,endMs:599000});
 await flush();
 assert.deepEqual(seen,[['normal',0],['fast',1]],
   'worker affinity separates NORMAL/SLOW from FAST/TURBO');
 done[0]('ok');await flush();
 assert.deepEqual(seen[2],['slow',0]);
 done[1]('ok');await flush();
 assert.deepEqual(seen[3],['turbo',1]);
 done[2]('ok');done[3]('ok');await flush();
 assert.equal(decoder.busy,0);
}
console.log('LIVE AUTO4 UTC slot planning and bounded dual-worker queue tests PASS');
