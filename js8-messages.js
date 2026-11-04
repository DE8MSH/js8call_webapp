/* JS8Web: JS8Call-style directed MSG frames + CRC16-KERMIT.
 * Original rules: JS8_Main/Varicode.cpp (GPL-3.0-or-later).
 * This module does not implement over-the-air Store & Forward.
 */
import {makeDirected} from './protocol.js';
import {encodeJscFrames,getJscDictionary} from './jsc-tx.js';

const CRC_ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?';
const MAX_AGE_MS=10*60*1000;
const MSG_COMMANDS=new Set(['MSG','MSG TO:']);

export function crc16Kermit(input){
  const value=String(input);
  // JS8Call's checksum16 uses toLocal8Bit(); only ASCII is supported here.
  if(/[^\x00-\x7f]/.test(value))throw Error('CRC16: nur ASCII-Zeichen unterstützt');
  let crc=0;
  for(let i=0;i<value.length;i++){
    crc^=value.charCodeAt(i);
    for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0x8408:0);
  }
  return crc&0xffff;
}
export function packChecksum16(text){
  let crc=crc16Kermit(text);
  return CRC_ALPHABET[Math.floor(crc/1681)]+CRC_ALPHABET[Math.floor(crc/41)%41]+CRC_ALPHABET[crc%41];
}
export function verifyChecksum16(text,checksum){
  return /^[0-9A-Z+\-./?]{3}$/.test(checksum)&&packChecksum16(text)===checksum;
}
export function prepareMessageText(input){
  const s=String(input).replace(/\r\n?/g,'\n').trim();
  const ascii=s.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  if(!ascii)throw Error('Nachricht ist leer');
  if(ascii.length>1500)throw Error('Nachricht zu lang (maximal 1500 Zeichen)');
  if(/[^\x20-\x7e\n]/.test(ascii))throw Error('Nachricht enthält nicht unterstützte Zeichen');
  return ascii.replace(/\n/g,' ');
}
export function createMessagePlan({from,to,text,mode='normal',kind='directed'},dictionary){
  const call=String(from||'').toUpperCase().trim();
  const destination=String(to||'@ALLCALL').toUpperCase().trim();
  const body=prepareMessageText(text);
  if(!call)throw Error('Eigenes Rufzeichen fehlt');
  if(!['normal','fast','turbo','slow'].includes(mode))throw Error('Submode unbekannt');
  if(kind==='directed'){
    if(destination==='@ALLCALL')throw Error('Für MSG bitte eine Zielstation auswählen (nicht @ALLCALL).');
    const command=makeDirected(call,destination,'MSG');
    const crc=packChecksum16(body);
    const data=encodeJscFrames(body+' '+crc,mode,dictionary);
    const header={frame:command.frame,type:1,characters:0,kind:'directed-header'};
    const tail=data.frames.map((f,i)=>({...f,type:f.type&(i===0?~1:~0),kind:'jsc-data'}));
    tail.at(-1).type|=2;
    return {text:body,from:call,to:destination,kind,mode,checksum:crc,frames:[header,...tail],characters:body.length,wireText:body+' '+crc};
  }
  if(kind==='plain'){
    const wireText=call+': '+(destination==='@ALLCALL'?'':destination+' ')+body;
    const data=encodeJscFrames(wireText,mode,dictionary);
    return {...data,text:body,from:call,to:destination,kind,mode,wireText};
  }
  throw Error('Unbekannter Nachrichtentyp');
}
export async function prepareMessagePlan(details){
  return createMessagePlan(details,await getJscDictionary());
}

/* Observes decoded JS8 frames. A directed MSG header is associated with the
 * first following complete text chain at the same offset and submode.
 * CRC errors are NOT reported as successfully received messages.
 */
export class MessageSessionTracker{
  constructor(){this.headers=[];this.seen=new Set();}
  accept(event){
    if(!event||!event.parsed)return null;
    const p=event.parsed,frequency=Number(event.frequency)||0;
    const time=Date.parse(event.time)||Date.now();
    this.headers=this.headers.filter(h=>time>=h.time && time-h.time<=MAX_AGE_MS);
    if(p.kind==='directed'&&MSG_COMMANDS.has(p.command)){
      this.headers=this.headers.filter(h=>!(h.mode===event.mode&&Math.abs(h.frequency-frequency)<9));
      this.headers.push({time,mode:event.mode,frequency,from:p.call,to:p.to,command:p.command});
      return null;
    }
    if(p.kind==='text_fragment'||p.kind!=='text')return null;
    const body=String(p.display||event.display||'');
    const id=[event.mode,Math.round(frequency),event.time,body].join('|');
    if(this.seen.has(id))return null;
    this.seen.add(id);if(this.seen.size>500)this.seen.delete(this.seen.values().next().value);
    const matching=this.headers.filter(h=>h.mode===event.mode&&Math.abs(h.frequency-frequency)<9&&time>=h.time&&time-h.time<=MAX_AGE_MS).sort((a,b)=>b.time-a.time)[0];
    if(!matching)return {kind:'plain',from:'',to:'',text:body,checksum:'none',time:event.time,frequency,mode:event.mode};
    this.headers=this.headers.filter(h=>h!==matching);
    const m=body.match(/^(.*) ([0-9A-Z+\-./?]{3})$/s);
    const verified=!!m&&verifyChecksum16(m[1],m[2]);
    return {kind:'directed',from:matching.from,to:matching.to,text:m?m[1]:body,
      checksum:verified?'valid':'invalid',checksumExpected:m?m[2]:'',time:event.time,frequency,mode:event.mode};
  }
}
