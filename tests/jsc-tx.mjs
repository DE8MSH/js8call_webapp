import fs from 'node:fs';
import assert from 'node:assert/strict';
import {encodeJscFrames} from '../jsc-tx.js';
import {decodeJscFrame} from '../jsc.js';

const chunks=Array.from({length:8},(_,n)=>JSON.parse(fs.readFileSync(new URL('../jsc-dict/chunk'+n+'.json',import.meta.url),'utf8')));
const dictionary=chunks.flat();
assert.equal(dictionary.length,262144);
const lookup=index=>dictionary[index];
let tests=0;
for(const mode of ['normal','fast','slow','turbo']){
 for(const text of [
  'HELLO WORLD',
  'NICE DAY HERE, WILL POP IN AND OUT WHEN I GET A CHANCE',
  'CQ CQ CQ DE DO7OO JO43',
  'TEST TEST THIS IS A VERY LONG MESSAGE WITH A LOT OF WORDS SO THERE SHOULD BE MULTIPLE FRAMES HERE'
 ]){
  const packet=encodeJscFrames(text,mode,dictionary);
  assert.ok(packet.frames.length>=1);
  assert.equal(packet.frames[0].type&1,1,'FIRST');
  assert.equal(packet.frames.at(-1).type&2,2,'LAST');
  assert.equal(packet.frames.every(f=>f.frame.length===12),true);
  const parts=await Promise.all(packet.frames.map(f=>decodeJscFrame(f.frame,f.type,lookup)));
  assert.equal(parts.every(x=>x&&x.complete),true);
  assert.equal(parts.map(x=>x.display).join(''),text,'TX/RX roundtrip in '+mode);
  tests++;
 }
}
for(const bad of ['','   '])assert.throws(()=>encodeJscFrames(bad,'normal',dictionary));
console.log('JS8 JSC TX/RX roundtrip: '+tests+' checks passed across 4 modes');
