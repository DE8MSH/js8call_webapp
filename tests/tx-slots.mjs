import assert from 'node:assert/strict';
import {nextUtcSlot,SlotTransmitter} from '../tx-slots.js';

function clock(start=1000){
 let now=start,id=0;
 const tasks=new Map();
 return {
  now:()=>now,
  schedule:(fn,ms)=>{const n=++id;tasks.set(n,{at:now+ms,fn});return n;},
  unschedule:n=>tasks.delete(n),
  advance:to=>{
    now=to;
    for(const [n,t] of [...tasks])if(t.at<=now){tasks.delete(n);t.fn();}
  },
  get count(){return tasks.size;}
 };
}
const flush=async()=>{for(let i=0;i<14;i++)await Promise.resolve();};
function source(trace){
 const listeners=[];
 return {
  addEventListener:(kind,fn)=>{if(kind==='ended')listeners.push(fn);},
  start:at=>trace.push(['audio-start',at]),
  stop:at=>trace.push(['audio-stop',at]),
  finish:()=>listeners.forEach(fn=>fn())
 };
}
const now=1000;
assert.deepEqual(nextUtcSlot(now,15000,0,350),{utcMs:15000,pttAtMs:14650,waitMs:13650});
assert.equal(nextUtcSlot(14800,15000,0,350).utcMs,30000);
assert.equal(nextUtcSlot(1000,15000,1000,350).utcMs,14000);
assert.throws(()=>nextUtcSlot(1000,0));
{
 const c=clock(),trace=[],s=source(trace);
 const tx=new SlotTransmitter({
  now:c.now,schedule:c.schedule,unschedule:c.unschedule,
  ptt:async on=>trace.push(['ptt',on])
 });
 const pending=tx.transmit({periodMs:15000,
  audio:async()=>({currentTime:12}),
  createSource:async()=>s});
 await flush();
 assert.equal(tx.busy,true);
 assert.equal(c.count,1);
 assert.equal(trace.length,0);
 c.advance(14650);
 await flush();
 assert.equal(trace[0][0],'ptt');assert.equal(trace[0][1],true);
 assert.equal(trace[1][0],'audio-start');
 assert.ok(trace[1][1]>12&&trace[1][1]<12.5);
 s.finish();
 const result=await pending;
 assert.equal(result.ok,true);
 assert.equal(trace.at(-1)[0],'ptt');assert.equal(trace.at(-1)[1],false);
 assert.equal(tx.busy,false);
}
{
 const c=clock(),trace=[],s=source(trace);
 const tx=new SlotTransmitter({now:c.now,schedule:c.schedule,unschedule:c.unschedule,ptt:async on=>{
   trace.push(['ptt',on]);if(on)throw Error('USB getrennt');
 }});
 const pending=tx.transmit({periodMs:15000,audio:async()=>({currentTime:0}),createSource:async()=>s});
 await flush();c.advance(14650);
 await assert.rejects(pending,/USB getrennt/);
 assert.equal(trace.some(x=>x[0]==='audio-start'),false);
 assert.deepEqual(trace,[['ptt',true],['ptt',false]]);
}
{
 const c=clock(),trace=[],s=source(trace);
 const tx=new SlotTransmitter({now:c.now,schedule:c.schedule,unschedule:c.unschedule,ptt:async on=>trace.push(['ptt',on])});
 const pending=tx.transmit({periodMs:15000,audio:async()=>({currentTime:0}),createSource:async()=>s});
 await flush();const cancellation=tx.cancel();
 await assert.rejects(pending,{name:'AbortError'});
 await cancellation;
 assert.equal(tx.busy,false);assert.equal(c.count,0);
 assert.equal(trace.some(x=>x[0]==='audio-start'),false);
 assert.ok(trace.some(x=>x[0]==='ptt'&&x[1]===false));
}
{
 const c=clock(),trace=[],s=source(trace);
 const tx=new SlotTransmitter({now:c.now,schedule:c.schedule,unschedule:c.unschedule,ptt:async on=>trace.push(['ptt',on])});
 const pending=tx.transmit({periodMs:15000,audio:async()=>({currentTime:0}),createSource:async()=>s});
 await flush();c.advance(15250);
 await assert.rejects(pending,/verpasst/);
 assert.equal(trace.some(x=>x[0]==='audio-start'),false);
 assert.equal(trace.some(x=>x[0]==='ptt'&&x[1]===true),false);
}
{
 const c=clock(),trace=[],s=source(trace);
 const tx=new SlotTransmitter({now:c.now,schedule:c.schedule,unschedule:c.unschedule,ptt:async on=>trace.push(['ptt',on])});
 const pending=tx.transmit({periodMs:15000,audio:async()=>({currentTime:0}),createSource:async()=>s});
 await flush();c.advance(14650);await flush();
 assert.equal(trace.some(x=>x[0]==='audio-start'),true);
 const cancelled=tx.cancel();
 await assert.rejects(pending,{name:'AbortError'});await cancelled;
 assert.equal(trace.at(-1)[1],false);
}
{
 const c=clock(),trace=[],s=source(trace);
 const tx=new SlotTransmitter({now:c.now,schedule:c.schedule,unschedule:c.unschedule,
  ptt:async on=>{trace.push(['ptt',on]);if(!on)throw Error('USB I/O fehlgeschlagen');}
 });
 const pending=tx.transmit({periodMs:15000,audio:async()=>({currentTime:0}),createSource:async()=>s});
 await flush();c.advance(14650);await flush();s.finish();
 await assert.rejects(pending,/PTT konnte nicht deaktiviert/);
 assert.equal(tx.busy,false);
 assert.equal(trace.some(e=>e[0]==='audio-start'),true);
}
{
 const c=clock(),trace=[],s=source(trace);
 let confirmPtt;
 const tx=new SlotTransmitter({now:c.now,schedule:c.schedule,unschedule:c.unschedule,
  ptt:on=>{
   trace.push(['ptt',on]);
   if(on)return new Promise(resolve=>{confirmPtt=resolve;});
   return Promise.resolve();
  }
 });
 const pending=tx.transmit({periodMs:15000,audio:async()=>({currentTime:0}),createSource:async()=>s});
 await flush();c.advance(14650);await flush();
 assert.equal(typeof confirmPtt,'function');
 const cancelling=tx.cancel();
 confirmPtt();await cancelling;
 await assert.rejects(pending,{name:'AbortError'});
 assert.equal(trace.some(x=>x[0]==='audio-start'),false,'PTT unlock after cancel must not start audio');
 assert.equal(trace.at(-1)[1],false);
}
console.log('SlotTransmitter tests: UTC, serial PTT failure, cancellation, missed slot, audio-ended PTT release PASS');
