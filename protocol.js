/* JS8Web protocol layer – GPL-3.0-or-later
 * Implemented from the public JS8Call varicode.cpp (GPLv3).
 * A deliberately limited subset: heartbeat/CQ and short directed command frames.
 * No chat/text compression, message storage, or automatic responses.
 */
export const FRAME_ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+';
const ALNUM='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ /@';
const MASK28=(1n<<28n)-1n;
const MASK50=(1n<<50n)-1n;
const MASK64=(1n<<64n)-1n;
export const DIRECT_COMMANDS=Object.freeze({
  'SNR?':0,'?':0,'DIT DIT':1,'NACK':2,'HEARING?':3,'GRID?':4,
  'STATUS?':6,'MSG':9,'MSG TO:':10,'QUERY':11,'QUERY MSGS?':12,'QUERY CALL':13,'INFO?':16,'HW CPY?':19,'QSL?':22,'QSL':23,
  'ACK':14,'FB':18,'SK':20,'RR':21,'NO':26,'YES':27,'73':28,'AGN?':30
});
const CMD_LABELS=Object.freeze({0:'SNR?',1:'DIT DIT',2:'NACK',3:'HEARING?',4:'GRID?',6:'STATUS?',14:'ACK',16:'INFO?',18:'FB',19:'HW CPY?',20:'SK',21:'RR',22:'QSL?',23:'QSL',26:'NO',27:'YES',28:'73',30:'AGN?',25:'SNR',29:'HEARTBEAT SNR',5:'RELAY',7:'STATUS',8:'HEARING',9:'MSG',10:'MSG TO:',11:'QUERY',12:'QUERY MSGS',13:'QUERY CALL',15:'GRID',17:'INFO',24:'CMD',27:'YES'});
export const CQ_TYPES=['CQ CQ CQ','CQ DX','CQ QRP','CQ CONTEST','CQ FIELD','CQ FD','CQ CQ','CQ'];
const BASECALLS=['<....>','@ALLCALL','@JS8NET','@DX/NA','@DX/SA','@DX/EU','@DX/AS','@DX/AF','@DX/OC','@DX/AN','@REGION/1','@REGION/2','@REGION/3',...Array.from({length:10},(_,i)=>'@GROUP/'+i),'@COMMAND','@CONTROL','@NET','@NTS',...Array.from({length:5},(_,i)=>'@RESERVE/'+i),'@APRSIS','@RAGCHEW','@JS8','@EMCOMM','@ARES','@MARS','@AMRRON','@RACES','@RAYNET','@RADAR','@SKYWARN','@CQ','@HB','@QSO','@QSOPARTY','@CONTEST','@FIELDDAY','@SOTA','@IOTA','@POTA','@QRP','@QRO'];
const NBASECALL=37*36*10*27*27*27;
function numericFrame(value){let s='';for(let i=11;i>=0;i--)s+=FRAME_ALPHABET[Number((value>>BigInt(i*6))&63n)];return s;}
function readFrame(frame){if(typeof frame!=='string'||frame.length!==12||[...frame].some(c=>!FRAME_ALPHABET.includes(c)))throw Error('Ungültiger JS8-Frame');let result=0n;for(const c of frame)result=(result<<6n)|BigInt(FRAME_ALPHABET.indexOf(c));return result;}
export function packAlphaNumeric50(value){
  let s=String(value).toUpperCase().replace(/[^A-Z0-9 /@]/g,'');
  if(s.length>3&&s[3]!=='/')s=s.slice(0,3)+' '+s.slice(3);
  if(s.length>7&&s[7]!=='/')s=s.slice(0,7)+' '+s.slice(7);
  if(s.length>11)throw Error('Rufzeichen zu lang für einen Compound-Frame');
  s=s.padEnd(11,' ');
  const radices=[39,38,38,2,38,38,38,2,38,38,38];
  let out=0n;
  for(let i=0;i<11;i++){const n=i===3||i===7?(s[i]==='/'?1:0):ALNUM.indexOf(s[i]);if(n<0||n>=radices[i])throw Error('Rufzeichen nicht darstellbar');out=out*BigInt(radices[i])+BigInt(n);}
  if(out>MASK50)throw Error('Compound-Rufzeichen nicht darstellbar');
  return out;
}
export function unpackAlphaNumeric50(num){
  let x=BigInt(num),out=Array(11).fill(' ');
  const radices=[39,38,38,2,38,38,38,2,38,38,38];
  for(let i=10;i>=0;i--){const n=Number(x%BigInt(radices[i]));x/=BigInt(radices[i]);out[i]=(i===3||i===7)?(n?'/':' '):ALNUM[n];}
  return out.join('').replaceAll(' ','');
}
export function packGrid(value){
  const g=String(value).trim().toUpperCase().slice(0,4);
  if(!/^[A-R]{2}[0-9]{2}$/.test(g))return 32767;
  // JS8Call's grid2deg() evaluates a 4-letter grid at its "mm" sub-square,
  // then truncates toward zero before quantization (not normal rounding).
  const dlong=180-20*(g.charCodeAt(0)-65)-2*Number(g[2])-5*12.5/60;
  const dlat=-90+10*(g.charCodeAt(1)-65)+Number(g[3])+2.5*12.5/60;
  const ilong=Math.trunc(dlong),ilat=Math.trunc(dlat+90);
  return Math.trunc((ilong+180)/2)*180+ilat;
}
export function unpackGrid(num){
  if(num>32400||num<0)return '';
  const dlat=(num%180)-90,dlong=Math.floor(num/180)*2-180+2;
  const nlong=Math.trunc(60*(180-dlong)/5),nlat=Math.trunc(60*(dlat+90)/2.5);
  const a=Math.floor(nlong/240),b=Math.floor(nlat/240);
  if(a<0||a>17||b<0||b>17)return '';
  const lonDigit=Math.floor((nlong-a*240)/24),latDigit=Math.floor((nlat-b*240)/24);
  return String.fromCharCode(65+a,65+b,48+lonDigit,48+latDigit);
}
export function packCallsign(call){
  let s=String(call).trim().toUpperCase(),portable=false;
  const k=BASECALLS.indexOf(s);
  if(k>=0)return{value:NBASECALL+k+1,portable:false};
  if(s.endsWith('/P')){portable=true;s=s.slice(0,-2);}
  if(s.startsWith('3DA0'))s='3D0'+s.slice(4);
  if(/^3X[A-Z]/.test(s))s='Q'+s.slice(2);
  if(s.length<2||s.length>6)throw Error('Basisrufzeichen muss 2–6 Zeichen lang sein');
  let candidates=[s];
  if(s.length===2)candidates.push(' '+s+'   ');
  if(s.length===3)candidates.push(' '+s+'  ',s+'   ');
  if(s.length===4)candidates.push(' '+s+' ',s+'  ');
  if(s.length===5)candidates.push(' '+s,s+' ');
  let matched='';
  for(const candidate of candidates){const m=candidate.match(/([0-9A-Z ])([0-9A-Z])([0-9])([A-Z ])([A-Z ])([A-Z ])/);if(m)matched=m[0];}
  if(!matched)throw Error('Rufzeichenformat nicht als 28 Bit packbar');
  const v=ALNUM.indexOf(matched[0])*36*10*27**3
    +ALNUM.indexOf(matched[1])*10*27**3
    +Number(matched[2])*27**3
    +(ALNUM.indexOf(matched[3])-10)*27**2
    +(ALNUM.indexOf(matched[4])-10)*27
    +ALNUM.indexOf(matched[5])-10;
  if(v<0||v>=NBASECALL)throw Error('Basisrufzeichen außerhalb des 28-Bit-Bereichs');
  return{value:v,portable};
}
export function unpackCallsign(packed,portable=false){
  if(packed>NBASECALL){const found=BASECALLS[packed-NBASECALL-1];return found??'<UNKNOWN>';}
  let x=packed;const out=['','','','','',''];
  for(let i=5;i>=3;i--){out[i]=ALNUM[x%27+10];x=Math.floor(x/27);}
  out[2]=ALNUM[x%10];x=Math.floor(x/10);
  out[1]=ALNUM[x%36];x=Math.floor(x/36);
  out[0]=ALNUM[x]??'?';let call=out.join('').trim();
  if(call.startsWith('3D0'))call='3DA0'+call.slice(3);
  if(/^Q[A-Z]/.test(call))call='3X'+call.slice(1);
  return call+(portable?'/P':'');
}
function compound(call,type,num,bits3=0){
  const packed=packAlphaNumeric50(call);
  if(!packed)throw Error('Rufzeichen kann nicht gepackt werden');
  const first64=(BigInt(type&7)<<61n)|(packed<<11n)|BigInt((num>>>5)&2047);
  return numericFrame((first64<<8n)|BigInt(((num&31)<<3)|(bits3&7)));
}
export function makeHeartbeat(call,grid,kind='CQ'){
  if(!String(call).trim())throw Error('Rufzeichen fehlt');
  const cq=String(kind).toUpperCase().startsWith('CQ');
  if(cq&&!CQ_TYPES.includes(kind))throw Error('Unbekannter CQ-Typ');
  const num=packGrid(grid)|(cq?0x8000:0);
  const bits3=cq?CQ_TYPES.indexOf(kind):0;
  return {frame:compound(call,0,num,bits3),type:3,display:(cq?kind:'HB')+' '+String(call).toUpperCase()+' '+String(grid).slice(0,4).toUpperCase()};
}
export function makeDirected(from,to,command){
  const fromPack=packCallsign(from),toPack=packCallsign(to);
  if(!Object.prototype.hasOwnProperty.call(DIRECT_COMMANDS,command))throw Error('Nicht unterstützter Kurz-Befehl');
  if(String(from).toUpperCase()===String(to).toUpperCase())throw Error('Sender und Ziel gleich');
  const cmd=DIRECT_COMMANDS[command],rem=((fromPack.portable?1:0)<<7)|((toPack.portable?1:0)<<6);
  const first64=(3n<<61n)|(BigInt(fromPack.value)<<33n)|(BigInt(toPack.value)<<5n)|BigInt(cmd);
  return {frame:numericFrame((first64<<8n)|BigInt(rem)),type:3,display:String(from).toUpperCase()+': '+String(to).toUpperCase()+' '+command};
}
export function parseFrame(frame,transportType=0){
  const v=readFrame(frame),flag=Number((v>>69n)&7n);
  // Fast/Turbo/SLOW transport frames with JS8CallData (bit 2) use
  // all 72 payload bits; first data bits are NOT a message type.
  if(transportType&4)return{kind:'data',command:'JSC',display:'Komprimierter JSC-Datenframe (Wörterbuch wird geladen)'};
  if(flag===0||flag===1||flag===2){
    const call=unpackAlphaNumeric50((v>>19n)&MASK50);
    const num=(Number((v>>8n)&2047n)<<5)|Number((v>>3n)&31n);
    const bits3=Number(v&7n);
    if(flag===0){const cq=!!(num&0x8000),grid=unpackGrid(num&0x7fff),kind=cq?(CQ_TYPES[bits3]||'CQ'):'HB';return{kind:'beacon',call,grid,command:kind,display:[kind,call,grid].filter(Boolean).join(' ')};}
    return{kind:'compound',call,grid:unpackGrid(num),command:flag===2?'COMPOUND DIRECTED':'COMPOUND',display:call+' '+unpackGrid(num)};
  }
  if(flag===3){
    const first64=v>>8n,rem=Number(v&255n);
    const from=unpackCallsign(Number((first64>>33n)&MASK28),!!(rem&128)),to=unpackCallsign(Number((first64>>5n)&MASK28),!!(rem&64));
    const command=CMD_LABELS[Number(first64&31n)]??'CMD '+Number(first64&31n);
    const value=rem&63;
    const snrCommand=(command==='SNR'||command==='HEARTBEAT SNR');
    const numeric=value?(snrCommand?' '+(value-31>=0?'+':'')+(value-31)+' dB':' '+String(value-31)):'';
    return{kind:'directed',call:from,to,command,number:value,snr:snrCommand&&value?value-31:null,display:from+': '+to+' '+command+numeric};
  }
  const compressed=(flag===6||flag===7),legacy=flag>=4;
  if(legacy){
    const bits=v.toString(2).padStart(72,'0');
    // Original JS8Call 2.2: bit0=data, bit1=0 for legacy Huffman; last 0 is the end marker.
    if(bits[0]==='1'&&bits[1]==='0'){
      const end=bits.lastIndexOf('0'),decoded=huffmanDecode(bits.slice(2,end));
      if(decoded)return{kind:'text',command:'TEXT',display:decoded};
    }
    return{kind:'data',command:'DATA',display:compressed?'Komprimierter JS8-Text (JSC-Wörterbuch nicht enthalten)':'JS8-Datenframe (noch nicht dekomprimiert)'};
  }
  return{kind:'unknown',command:'UNKNOWN',display:'Unbekannter Datenframe'};
}

/* Original JS8Call legacy Huffman dictionary; current 2.2+ sends normally JSC frames. */
const HUFFMAN=Object.freeze({
' ':'01',E:'100',T:'1101',A:'0011',O:'11111',I:'11100',N:'10111',S:'10100',
H:'00011',R:'00000',D:'111011',L:'110011',C:'110001',U:'101101',M:'101011',W:'001011',
F:'001001',G:'000101',Y:'000011',P:'1111011',B:'1111001','.':'1110100',V:'1100101',
K:'1100100','-':'1100001','+':'1100000','?':'1011001','!':'1011000','"':'1010101',
X:'1010100','0':'0010101',J:'0010100','1':'0010001',Q:'0010000','2':'0001001',
Z:'0001000','3':'0000101','5':'0000100','4':'11110101','9':'11110100',
'8':'11110001','6':'11110000','7':'11101011','/':'11101010'
});
const HUFF_TREE=(()=>{let root={};for(const [letter,bits] of Object.entries(HUFFMAN)){let q=root;for(const bit of bits)q=q[bit]??={};q.char=letter;}return root;})();
export function huffmanDecode(bits){
  let result='',q=HUFF_TREE;for(const bit of bits){q=q[bit];if(!q)return '';if(q.char!==undefined){result+=q.char;q=HUFF_TREE;}}
  return q===HUFF_TREE?result:'';
}
