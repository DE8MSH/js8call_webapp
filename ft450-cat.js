/* Optional Yaesu FT-450 / FT-450D CAT over WebSerial.
 * Read-only polling unless the operator explicitly confirms a VFO-A set.
 * No CAT PTT or auto transmit. GPL-3.0-or-later.
 * Reference: Yaesu FT-450 CAT Operation Reference Book, FA command.
 */
export function parseFt450Frequency(frame){
  const m=String(frame).trim().match(/^FA([0-9]{8});$/);
  if(!m)return null;
  const hz=Number(m[1]);
  return hz>=30000&&hz<=60000000?hz:null;
}
export function ft450SetFrequency(hz){
  if(!Number.isSafeInteger(hz)||hz<30000||hz>60000000)throw Error('FT-450 CAT Frequenz muss 30 kHz bis 60 MHz betragen');
  return 'FA'+String(hz).padStart(8,'0')+';';
}
export function ft450DialDisplay(hz){
  if(!Number.isSafeInteger(hz)||hz<0)throw Error('Ungültige CAT-Frequenz');
  return (hz/1000000).toFixed(6).replace(/(\.\d{3})(\d{3})$/,'$1 $2');
}
export class Ft450CatSerial{
  constructor(onFrequency,onError){
    this.onFrequency=onFrequency;this.onError=onError;
    this.port=null;this.reader=null;this.task=null;this.timer=null;
    this.writing=Promise.resolve();this.buffer='';this.running=false;
  }
  async connect(baudRate=4800,stopBits=1){
    if(this.port)throw Error('CAT bereits verbunden');
    if(!navigator.serial)throw Error('WebSerial benötigt Chromium/Edge über HTTPS');
    if(![4800,9600,19200,38400].includes(baudRate)||![1,2].includes(stopBits))throw Error('Ungültige serielle Einstellungen');
    const port=await navigator.serial.requestPort();
    try{
      await port.open({baudRate,dataBits:8,stopBits,parity:'none',flowControl:'none'});
      // FT-450 can use RTS for RTTY operation; never raise it for CAT.
      await port.setSignals({requestToSend:false,dataTerminalReady:false});
    }catch(e){try{await port.close();}catch{}throw e;}
    this.port=port;this.running=true;this.buffer='';
    this.task=this.readLoop();
    this.timer=setInterval(()=>this.query().catch(e=>this.onError?.(e)),3000);
    await this.query();
  }
  async readLoop(){
    let reader;
    try{
      reader=this.port.readable.getReader();this.reader=reader;
      while(this.running){
        const {value,done}=await reader.read();
        if(done)break;
        this.buffer+=new TextDecoder('ascii').decode(value);
        if(this.buffer.length>1024)this.buffer=this.buffer.slice(-1024);
        for(let end;(end=this.buffer.indexOf(';'))!==-1;){
          const frame=this.buffer.slice(0,end+1);this.buffer=this.buffer.slice(end+1);
          const hz=parseFt450Frequency(frame);
          if(hz!==null)this.onFrequency?.(hz);
        }
      }
    }catch(e){if(this.running)this.onError?.(e);}
    finally{if(reader){try{reader.releaseLock();}catch{}}if(this.reader===reader)this.reader=null;}
  }
  async send(command){
    if(!this.port?.writable||!this.running)throw Error('CAT nicht verbunden');
    if(!/^FA(?:[0-9]{8})?;$/.test(command))throw Error('CAT: nur FA-Abfrage und explizite FA-Einstellung erlaubt');
    this.writing=this.writing.catch(()=>{}).then(async()=>{
      const writer=this.port.writable.getWriter();
      try{await writer.write(new TextEncoder().encode(command));}
      finally{writer.releaseLock();}
    });
    return this.writing;
  }
  async query(){return this.send('FA;');}
  async setFrequency(hz){return this.send(ft450SetFrequency(hz));}
  async close(){
    this.running=false;clearInterval(this.timer);this.timer=null;
    try{await this.writing;}catch{}
    try{await this.reader?.cancel();}catch{}
    try{await this.task;}catch{}
    const port=this.port;this.port=null;
    if(port)try{await port.close();}catch(e){this.onError?.(e);}
  }
}
export function mountFt450Cat(){
  if(typeof document==='undefined')return;
  const parent=document.querySelector('.settings-drawers')||document.querySelector('main');
  if(!parent)return;
  const details=document.createElement('details');details.className='drawer';
  details.id='ft450CatDrawer';
  const summary=document.createElement('summary');summary.textContent='Funkgerät / CAT · Yaesu FT-450 (WebSerial)';
  details.append(summary);
  const ui=document.createElement('div');ui.className='ft450-cat-controls';
  ui.innerHTML='<p>Optionaler CAT-Port (FT-450/FT-450D). Frequenz wird nur gelesen, bis du „Band am Funkgerät einstellen“ ausdrücklich bestätigst. Keine automatische CAT-PTT.</p>'+
    '<label>CAT-Baudrate<select id="ftCatBaud"><option>4800</option><option>9600</option><option>19200</option><option>38400</option></select></label>'+
    '<label>Stopbits<select id="ftCatStop"><option value="1">1 (üblich)</option><option value="2">2</option></select></label>'+
    '<button type="button" id="ftCatConnect">FT-450 verbinden</button>'+
    '<button type="button" id="ftCatRead" disabled>FA; auslesen</button>'+
    '<button type="button" id="ftCatSet" disabled>Band am Funkgerät einstellen</button>'+
    '<button type="button" id="ftCatDisconnect" disabled>Trennen</button>'+
    '<div id="ftCatState" role="status">CAT nicht verbunden (nur FT-450). Keine PTT.</div>';
  details.append(ui);parent.append(details);
  const $=id=>document.getElementById(id);
  const state=$('ftCatState'),connect=$('ftCatConnect'),read=$('ftCatRead'),set=$('ftCatSet'),disconnect=$('ftCatDisconnect');
  let cat;
  function update(connected){
    connect.disabled=connected;read.disabled=!connected;set.disabled=!connected;disconnect.disabled=!connected;
    $('ftCatBaud').disabled=connected;$('ftCatStop').disabled=connected;
  }
  function status(message){state.textContent=message;}
  function handleFrequency(hz){
    const mhz=ft450DialDisplay(hz);
    const dial=$('dialDisplay');if(dial)dial.textContent=mhz;
    const radio=$('radioStatus');if(radio)radio.textContent='FT-450 CAT · '+mhz+' MHz (VFO A)';
    status('FT-450 VFO A: '+mhz+' MHz · CAT RX aktiv · keine CAT-PTT');
    window.dispatchEvent(new CustomEvent('js8:cat-frequency',{detail:{hz,model:'Yaesu FT-450'}}));
  }
  connect.onclick=async()=>{
    connect.disabled=true;status('FT-450 CAT: USB-Seriell-Port wählen…');
    const instance=new Ft450CatSerial(handleFrequency,e=>status('CAT: '+e.message));cat=instance;
    try{
      await instance.connect(Number($('ftCatBaud').value),Number($('ftCatStop').value));
      update(true);status('FT-450 verbunden · lese VFO A ab…');
    }catch(e){status('FT-450 CAT Fehler: '+e.message);await instance.close();cat=null;update(false);}
  };
  read.onclick=()=>cat?.query().catch(e=>status('CAT-Abfrage: '+e.message));
  set.onclick=async()=>{
    if(!cat)return;
    const khz=Number($('band')?.value),hz=Math.round(khz*1000);
    if(!Number.isSafeInteger(hz))return;
    const freq=ft450DialDisplay(hz);
    if(!window.confirm('FT-450 VFO A auf '+freq+' MHz einstellen? Das ändert die reale Funkgerät-Frequenz.'))return;
    try{await cat.setFrequency(hz);status('CAT: FA'+hz+' gesendet · warte auf Rückmeldung');await cat.query();}
    catch(e){status('CAT-Setzfehler: '+e.message);}
  };
  disconnect.onclick=async()=>{
    disconnect.disabled=true;
    try{await cat?.close();}finally{cat=null;update(false);status('FT-450 CAT getrennt');const radio=$('radioStatus');if(radio)radio.textContent='Audio RX · kein CAT angeschlossen';}
  };
  window.addEventListener('beforeunload',()=>{cat?.close().catch(()=>{});});
  const menu=document.querySelector('.app-menu');
  if(menu){
    const m=[...menu.querySelectorAll('.app-menu-entry')].find(x=>x.querySelector('summary')?.textContent==='Konfiguration');
    if(m){
      const button=document.createElement('button');button.type='button';button.className='app-menu-command';button.textContent='CAT · Yaesu FT-450…';
      button.onclick=()=>{m.open=false;details.open=true;details.scrollIntoView({block:'center',behavior:'smooth'});};
      m.querySelector('.app-menu-list')?.append(button);
    }
  }
}
if(typeof document!=='undefined')mountFt450Cat();
