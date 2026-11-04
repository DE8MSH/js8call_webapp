import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMessagePlan,crc16Kermit,packChecksum16,verifyChecksum16,
  MessageSessionTracker,prepareMessageText} from '../js8-messages.js';
import {decodeJscFrame,MessageAssembler} from '../jsc.js';
import {parseFrame} from '../protocol.js';

const dictionary=Array.from({length:8},(_,i)=>JSON.parse(
  fs.readFileSync(new URL('../jsc-dict/chunk'+i+'.json',import.meta.url),'utf8')
)).flat();
assert.equal(dictionary.length,262144);
const word=i=>dictionary[i];
assert.equal(crc16Kermit('123456789'),0x2189,'CRC16 KERMIT reference vector');
assert.equal(packChecksum16('123456789'),'54G','base41 checksum');
assert.equal(verifyChecksum16('123456789','54G'),true);
assert.equal(verifyChecksum16('123456789','54H'),false);
assert.equal(prepareMessageText('Grüße, Hans!'),'GRUESSE, HANS!');
let checked=0;
for(const mode of ['normal','fast','turbo','slow']){
  const body='NICE DAY HERE, WILL POP IN AND OUT WHEN I GET A CHANCE';
  const msg=createMessagePlan({from:'DO7OO',to:'DK4HAA',text:body,mode,kind:'directed'},dictionary);
  assert.equal(msg.kind,'directed');
  assert.equal(msg.frames[0].type&1,1,'message FIRST on header');
  assert.equal(msg.frames[1].type&1,0,'no duplicate FIRST on first data');
  assert.equal(msg.frames.at(-1).type&2,2,'message LAST on last data');
  assert.equal(msg.frames.every(x=>x.frame.length===12),true);
  const parsed=parseFrame(msg.frames[0].frame,msg.frames[0].type);
  assert.equal(parsed.call,'DO7OO');assert.equal(parsed.to,'DK4HAA');
  assert.equal(parsed.command,'MSG','directed command encoded correctly');
  const rest=(await Promise.all(msg.frames.slice(1).map(x=>decodeJscFrame(x.frame,x.type,word)))).map(x=>x.display).join('');
  assert.equal(rest,msg.wireText);
  assert.equal(rest.slice(-3),msg.checksum);
  assert.equal(verifyChecksum16(rest.slice(0,-4),rest.slice(-3)),true);
  const rx=new MessageSessionTracker();
  const base='2026-11-04T12:00:00Z';
  assert.equal(rx.accept({parsed,mode,time:base,frequency:1500}),null);
  assert.equal(rx.accept({parsed:{kind:'text_fragment',display:'NICE DAY HERE,'},mode,time:'2026-11-04T12:00:15Z',frequency:1501}),null);
  const complete=rx.accept({parsed:{kind:'text',display:rest},mode,time:'2026-11-04T12:00:30Z',frequency:1500});
  assert.equal(complete.kind,'directed');assert.equal(complete.from,'DO7OO');assert.equal(complete.to,'DK4HAA');
  assert.equal(complete.text,body);assert.equal(complete.checksum,'valid');
  const corrupt=rx.accept({parsed,mode,time:'2026-11-04T12:01:00Z',frequency:1500});
  assert.equal(corrupt,null);
  const broken=rx.accept({parsed:{kind:'text',display:body+' XXX'},mode,time:'2026-11-04T12:01:15Z',frequency:1500});
  assert.equal(broken.checksum,'invalid');
  checked++;
}
const plain=createMessagePlan({from:'DO7OO',to:'@ALLCALL',text:'CQ CQ CQ',mode:'normal',kind:'plain'},dictionary);
assert.equal(plain.frames[0].type&1,1);
// MSG header carries FIRST: following compressed fragments need to be
// concatenated even if no data frame has the FIRST bit.
const assembly=new MessageAssembler();
const base={mode:'normal',frequency:1500,period:15};
assert.equal(assembly.add({...base,time:'2026-11-04T12:00:15Z',frame:'F1',type:0,text:'HELLO '}).complete,false);
assert.equal(assembly.add({...base,time:'2026-11-04T12:00:30Z',frame:'F2',type:0,text:'FROM '}).complete,false);
const joined=assembly.add({...base,time:'2026-11-04T12:00:45Z',frame:'F3',type:2,text:'DO7OO'});
assert.equal(joined.display,'HELLO FROM DO7OO');
assert.equal(joined.complete,true);
assert.equal(joined.frames,3);
assert.equal(plain.frames[0].type&1,1);
assert.equal(plain.frames.at(-1).type&2,2);
assert.equal((await Promise.all(plain.frames.map(x=>decodeJscFrame(x.frame,x.type,word)))).map(x=>x.display).join(''),plain.wireText);
assert.throws(()=>createMessagePlan({from:'DO7OO',to:'@ALLCALL',text:'HELLO',kind:'directed'},dictionary),/@ALLCALL/);
assert.throws(()=>createMessagePlan({from:'DO7OO',to:'DO7OO',text:'HELLO',kind:'directed'},dictionary));
console.log('JS8 MSG/CRC16/Conversation: '+checked+' mode roundtrips and negative tests passed');
