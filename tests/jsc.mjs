import fs from 'node:fs';
import assert from 'node:assert/strict';
import {decodeJscFrame,extractJscPayload,denseWordIndices,MessageAssembler} from '../jsc.js';
const chunks=Array.from({length:8},(_,n)=>JSON.parse(fs.readFileSync(new URL('../jsc-dict/chunk'+n+'.json',import.meta.url),'utf8')));
assert.equal(chunks.reduce((n,x)=>n+x.length,0),262144);
const word=i=>chunks[i>>>15][i&32767];
let n=0;
for(const [frame,expected] of [
 ['wpKlK1tYGr++','NICE DAY HERE, '],
 ['+qxsyDGlB2++','WILL POP IN AND '],
 ['tc4+fKl65A++','OUT WHEN I GET A ']
]){
  const decoded=await decodeJscFrame(frame,0,word);
  assert.equal(decoded?.display,expected,'JSC real field log '+frame);
  assert.ok(decoded.words>=4);
  console.log('[ OK ]',frame,JSON.stringify(decoded.display));n++;
}
assert.equal(extractJscPayload('0123456789AB',0),null);n++;
// Dictionary word #0 is "E". Build 72bit transport-FLAGGED frame from one word.
const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+';
const one='00000'+'0'+'1'.repeat(66); // one terminal JSC codeword + padding.
assert.equal(one.length,72);
let raw='';for(let i=0;i<72;i+=6)raw+=alphabet[parseInt(one.slice(i,i+6),2)];
assert.equal((await decodeJscFrame(raw,4,word))?.display,'E');n++;
const a=new MessageAssembler();
const base={mode:'normal',frequency:1700,period:15};
assert.equal(a.add({...base,frame:'x1',text:'HELLO ',time:'2026-11-04T10:00:00Z',type:1}).complete,false);
assert.equal(a.add({...base,frame:'x2',text:'WORLD',time:'2026-11-04T10:00:15Z',type:2}).display,'HELLO WORLD');n++;
assert.equal(a.add({...base,frame:'x3',text:'ORPHAN',time:'2026-11-04T10:01:00Z',type:2}).display,'ORPHAN');n++;
assert.equal(denseWordIndices('00100').complete,true);n++;
const clearable=new MessageAssembler();
clearable.add({mode:'normal',frequency:1500,time:'2026-11-04T12:00:00Z',period:15,frame:'part1',text:'HELLO ',type:1});
clearable.reset();
assert.equal(clearable.pending.length,0);
assert.equal(clearable.seen.size,0);
console.log('JSC reset clears partial message state');
console.log('JSC / Nachrichtenketten erfolgreich: '+n+' Tests');
