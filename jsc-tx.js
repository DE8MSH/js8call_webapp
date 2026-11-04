/* JS8Call JSC dense-code transmit encoder (GPL-3.0-or-later).
 * Implements JS8_JSC/JSC.cpp and JS8_Main/Varicode.cpp packCompressedMessage.
 */
const ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+';
let dictionaryPromise;
const MAX_FRAMES=64;
async function loadDictionary(){
  if(!dictionaryPromise)dictionaryPromise=Promise.all(Array.from({length:8},async(_,i)=>{
    const response=await fetch(new URL(`./jsc-dict/chunk${i}.json`,import.meta.url));
    if(!response.ok)throw Error(`JSC-Wörterbuch ${i}: HTTP ${response.status}`);
    const chunk=await response.json();
    if(!Array.isArray(chunk)||chunk.length!==32768)throw Error('Ungültiger JSC-Wörterbuchteil');
    return chunk;
  })).then(parts=>parts.flat()).catch(e=>{dictionaryPromise=null;throw e;});
  return dictionaryPromise;
}
function indexDictionary(dict){
  const byFirst=new Map();
  dict.forEach((word,index)=>{
    if(!word)return;
    const lead=word[0];
    if(!byFirst.has(lead))byFirst.set(lead,[]);
    byFirst.get(lead).push({word,index});
  });
  for(const arr of byFirst.values())arr.sort((a,b)=>b.word.length-a.word.length||a.index-b.index);
  return byFirst;
}
function codeword(index,space){
  let value=(index%7)*2+(space?1:0),out=value.toString(2).padStart(5,'0');
  let x=Math.floor(index/7);
  while(x>0){x--;out=(7+(x%9)).toString(2).padStart(4,'0')+out;x=Math.floor(x/9);}
  return out;
}
export function encodeJscFrames(input,submode='normal',dictionary){
  if(!Array.isArray(dictionary)||dictionary.length!==262144)throw Error('JSC Wörterbuch muss 262144 Einträge enthalten');
  const text=String(input).replace(/\r\n?/g,'\n');
  if(!text.trim())throw Error('Keine Nachricht eingegeben');
  if(text.length>1500)throw Error('Nachricht zu lang (max. 1500 Zeichen)');
  const normal=submode==='normal';
  const wordMap=indexDictionary(dictionary);
  const parts=text.split(' '),tokens=[];
  for(let n=0;n<parts.length;n++){
    let remain=parts[n],last=n===parts.length-1,spaceChar=false;
    if(remain===''&&!last){remain=' ';spaceChar=true;}
    while(remain){
      const entries=wordMap.get(remain[0])||[];
      const entry=entries.find(item=>remain.startsWith(item.word));
      if(!entry)throw Error(`JSC: Zeichenfolge nicht im Wörterbuch: ${JSON.stringify(remain.slice(0,15))}`);
      const rest=remain.slice(entry.word.length);
      const trailing=rest.length===0&&!spaceChar&&!last;
      tokens.push({bits:codeword(entry.index,trailing),length:entry.word.length+(trailing?1:0)});
      remain=rest;
    }
  }
  if(!tokens.length)throw Error('Nachricht nicht codierbar');
  const frames=[];let pos=0,used=0;
  while(pos<tokens.length){
    let bits=normal?'11':'',chars=0;
    while(pos<tokens.length&&bits.length+tokens[pos].bits.length<72){
      bits+=tokens[pos].bits;chars+=tokens[pos].length;pos++;
    }
    if(!chars)throw Error('JSC-Codewort größer als ein Frame');
    const padding=72-bits.length;
    bits+='0'+'1'.repeat(padding-1);
    let frame='';for(let i=0;i<72;i+=6)frame+=ALPHABET[parseInt(bits.slice(i,i+6),2)];
    frames.push({frame,type:(normal?0:4),characters:chars});
    used+=chars;
    if(frames.length>MAX_FRAMES)throw Error('Zu viele JS8-Frames (maximal 64)');
  }
  frames[0].type|=1;frames.at(-1).type|=2;
  return {text,frames,characters:used,mode:submode};
}
export async function prepareJscText(input,submode='normal'){
  return encodeJscFrames(input,submode,await loadDictionary());
}
