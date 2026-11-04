/* JS8Web LAB: WASM encoder/decoder and synthetic 12 kHz channel test. */
import fs from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const binary=fs.readFileSync(resolve(root,'js8-core.wasm'));
const {instance}=await WebAssembly.instantiate(binary);
const e=instance.exports,bytes=new Uint8Array(e.memory.buffer);
let tests=0;
function check(v,what){if(!v)throw Error('FAIL '+what);console.log('[ OK ] '+what);tests++;}
const msg='0123456789AB';
bytes.set(Buffer.from(msg),e.js8_input_ptr());
check(e.js8_encode(4,0)===0,'JS8 normal encode, 79 symbols');
let tones=Array.from(new Int32Array(e.memory.buffer,e.js8_tones_ptr(),79));
check(tones.length===79 && tones.slice(0,7).join(',')==='4,2,5,6,1,3,0','Original Costas');
const llr=new Float32Array(e.memory.buffer,e.js8_llr_ptr(),174);
for(let i=0;i<58;i++){const t=tones[i<29?7+i:43+i-29],off=i<29?i*3:87+(i-29)*3;for(let b=0;b<3;b++)llr[off+b]=t&(1<<(2-b))?4:-4;}
check(e.js8_decode()===0 && e.js8_type()===4 && Buffer.from(bytes.slice(e.js8_decoded_ptr(),e.js8_decoded_ptr()+12)).toString()===msg,'CRC12 + LDPC RX');
const orig=Float32Array.from(llr);llr[11]*=-.25;check(e.js8_decode()>=0 && e.js8_type()===4,'1 soft error');llr.set(orig);
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response(binary,{status:200});
const replies=[];
globalThis.self={postMessage:x=>replies.push(x)};
await import('../rx-worker.js');
for(const mode of ['normal','fast','turbo','slow']){
 const cos=mode==='normal'?0:1;
 check(e.js8_encode(4,cos)===0,'encode '+mode);
 const t=Array.from(new Int32Array(e.memory.buffer,e.js8_tones_ptr(),79));
 const before=replies.length;
 self.onmessage({data:{id:before+1,synthetic:true,tones:t,freq:1500,mode}});
 for(let n=0;replies.length===before&&n<250;n++)await new Promise(r=>setTimeout(r,25));
 const result=replies.at(-1);
 check(replies.length>before&&result.ok&&result.text===msg&&result.type===4,mode+' 12 kHz audio roundtrip');
}
globalThis.fetch=originalFetch;
console.log('Alle '+tests+' Tests erfolgreich.');


const {makeHeartbeat,makeDirected,parseFrame,packGrid,unpackGrid,packCallsign,unpackCallsign} = await import('../protocol.js');
const cq=makeHeartbeat('DO7OO','JO43','CQ');
check(cq.type===3 && cq.frame.length===12,'CQ transport type is FIRST|LAST (3)');
const cqRx=parseFrame(cq.frame);
check(cqRx.kind==='beacon' && cqRx.command==='CQ' && cqRx.call==='DO7OO' && cqRx.grid==='JO43','JS8Call varicode CQ/locator roundtrip');
const hb=parseFrame(makeHeartbeat('DO7OO','JO43','HB').frame);
check(hb.command==='HB' && hb.call==='DO7OO' && hb.grid==='JO43','JS8Call heartbeat roundtrip');
check(unpackGrid(packGrid('JO43'))==='JO43','Maidenhead grid packing');
const packed=packCallsign('DO7OO');
check(unpackCallsign(packed.value,packed.portable)==='DO7OO','28-bit base callsign roundtrip');
const directed=makeDirected('DO7OO','DK4HAA','GRID?');
const directedRx=parseFrame(directed.frame);
check(directed.type===3 && directedRx.kind==='directed' && directedRx.call==='DO7OO' && directedRx.to==='DK4HAA' && directedRx.command==='GRID?','Directed GRID? protocol frame roundtrip');
{
  const pkt=makeHeartbeat('DO7OO','JO43','CQ');
  bytes.set(Buffer.from(pkt.frame),e.js8_input_ptr());
  check(e.js8_encode(pkt.type,0)===0,'Protocol CQ to native WASM encoder');
  const t=Array.from(new Int32Array(e.memory.buffer,e.js8_tones_ptr(),79));
  const n=replies.length;
  self.onmessage({data:{id:1001,synthetic:true,tones:t,freq:1500,mode:'normal'}});
  for(let i=0;i<200&&replies.length===n;i++)await new Promise(r=>setTimeout(r,25));
  const rx=replies.at(-1);
  check(rx?.ok && parseFrame(rx.text).command==='CQ' && rx.type===3,'Native WASM JS8 transport -> browser protocol CQ');
}
console.log('JS8-Protokoll-Tests abgeschlossen: '+tests);
