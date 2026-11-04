/* Regression checks from a real JS8Web receiver CSV, 2026-11-04. No RF claims from synthetic fixtures. */
import {strict as assert} from 'node:assert';
import {parseFrame,huffmanDecode} from '../protocol.js';
const examples=[
  ['2oaVIlSDOWe8',p=>p.kind==='beacon' && p.call==='MM0ZFG' && p.grid==='IO75' && p.command==='HB'],
  ['OWJuVp6XD4u0',p=>p.kind==='directed' && p.call==='2E0RLZ' && p.to==='MM0ZFG' && p.command==='ACK'],
  ['VinGjp6XD5qP',p=>p.kind==='directed' && p.call==='G5TAR' && p.to==='MM0ZFG' && p.command==='HEARTBEAT SNR' && p.snr===-6],
  ['OWJuVp6XD5qW',p=>p.kind==='directed' && p.call==='2E0RLZ' && p.to==='MM0ZFG' && p.command==='HEARTBEAT SNR' && p.snr===1],
  ['TLlxop6XD5qH',p=>p.kind==='directed' && p.call==='PA3ATX' && p.command==='HEARTBEAT SNR' && p.snr===-14],
  ['Vl3EQp6XD5qV',p=>p.kind==='directed' && p.call==='M6MHG' && p.command==='HEARTBEAT SNR' && p.snr===0],
  ['tc4+fKl65A++',p=>p.kind==='data'],
  ['+qxsyDGlB2++',p=>p.kind==='data']
];
for(const [raw,test] of examples){const out=parseFrame(raw);assert.ok(test(out),raw+' -> '+JSON.stringify(out));console.log('[ OK ] Actual RX record',raw,out.display);}
const bits='1101'+'100'+'10100'+'1101';assert.equal(huffmanDecode(bits),'TEST');console.log('[ OK ] Legacy JS8 Huffman decode');
console.log('Protokoll RX-Regression: '+(examples.length+1)+' Tests bestanden.');
