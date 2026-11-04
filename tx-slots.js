/* JS8Web v0.9 — UTC-slot TX and fail-closed PTT controller.
 * Browser timing is best-effort, NOT hard real time. GPL-3.0-or-later.
 * Derived from the JS8Call TxLoop scheduling model, but browser-specific. */
export function nextUtcSlot(nowMs, periodMs, utcCorrectionMs=0, leadMs=350, guardMs=100) {
  for(const v of [nowMs,periodMs,utcCorrectionMs,leadMs,guardMs]) {
    if(!Number.isFinite(v)) throw Error('TX timing: invalid numeric argument');
  }
  if(periodMs<1000||periodMs>60000||leadMs<50||leadMs>2000||guardMs<0||guardMs>1000)
    throw Error('TX timing: unsupported period or lead');
  const boundary=Math.ceil((nowMs+utcCorrectionMs+leadMs+guardMs)/periodMs)*periodMs-utcCorrectionMs;
  return {utcMs:boundary,pttAtMs:boundary-leadMs,waitMs:Math.max(0,boundary-leadMs-nowMs)};
}
function aborted() {const e=new Error('TX abgebrochen');e.name='AbortError';return e;}
export class SlotTransmitter {
  constructor({now=()=>Date.now(),schedule=(cb,delay)=>setTimeout(cb,delay),unschedule=clearTimeout,ptt=async()=>{},status=()=>{}}={}){
    this.now=now;this.schedule=schedule;this.unschedule=unschedule;
    this.ptt=ptt;this.status=status;this.active=null;
    this.pttLine=Promise.resolve();
  }
  get busy(){return !!this.active;}
  async setPtt(on){
    // Serial setSignals operations must never overtake each other.
    const work=this.pttLine.catch(()=>{}).then(()=>this.ptt(on));
    this.pttLine=work;
    await work;
  }
  delay(ms,token){
    if(token.cancelled)return Promise.reject(aborted());
    return new Promise((resolve,reject)=>{
      token.rejectDelay=reject;
      token.timer=this.schedule(()=>{token.timer=null;token.rejectDelay=null;resolve();},Math.max(0,ms));
    });
  }
  async transmit({periodMs,utcCorrectionMs=0,leadMs=350,audio,createSource,onSource=()=>{}}){
    if(this.active)throw Error('TX bereits aktiv');
    if(typeof audio!=='function'||typeof createSource!=='function')throw Error('TX-Audioquelle fehlt');
    const token={cancelled:false,timer:null,rejectDelay:null,source:null,audioStarted:false};
    this.active=token;
    try{
      const context=await audio();
      if(token.cancelled)throw aborted();
      const source=await createSource(context);
      if(!source||typeof source.start!=='function'||typeof source.stop!=='function')
        throw Error('Ungültige TX-Audioquelle');
      token.source=source;
      const plan=nextUtcSlot(this.now(),periodMs,utcCorrectionMs,leadMs);
      this.status({state:'armed',utcMs:plan.utcMs});
      await this.delay(plan.waitMs,token);
      if(token.cancelled)throw aborted();
      // A backgrounded tab or slow serial adapter can make us miss the slot.
      if(this.now()>plan.utcMs-50)throw Error('UTC-Zeitschlitz verpasst; nichts gesendet');
      await this.setPtt(true);
      if(token.cancelled)throw aborted();
      const remaining=plan.utcMs-this.now();
      if(remaining<40)throw Error('PTT zu langsam: UTC-Slot verpasst, Audio nicht gestartet');
      const at=context.currentTime+remaining/1000;
      this.status({state:'ptt',utcMs:plan.utcMs});
      const finished=new Promise((resolve,reject)=>{
        source.addEventListener('ended',resolve,{once:true});
        token.rejectEnd=reject;
      });
      onSource(source);
      source.start(at);
      token.audioStarted=true;
      source.stop(at+periodMs/1000);
      this.status({state:'onair',utcMs:plan.utcMs});
      await finished;
      if(token.cancelled)throw aborted();
      this.status({state:'audio-finished',utcMs:plan.utcMs});
      return {ok:true,utcMs:plan.utcMs};
    }catch(error){
      if(token.audioStarted)try{token.source?.stop();}catch{}
      this.status({state:error.name==='AbortError'?'cancelled':'error',error:error.message});
      throw error;
    }finally{
      if(token.timer!==null)this.unschedule(token.timer);
      token.rejectDelay=null;token.rejectEnd=null;
      // This also runs when getAudio / setSignals / AudioBufferSource throws.
      let releaseError=null;
      try{await this.setPtt(false);}
      catch(e){releaseError=e;this.status({state:'ptt-release-error',error:e.message});}
      if(this.active===token)this.active=null;
      this.status({state:'idle'});
      if(releaseError)throw Error('PTT konnte nicht deaktiviert werden: '+releaseError.message);
    }
  }
  async cancel(){
    const token=this.active;
    if(!token){await this.setPtt(false).catch(e=>this.status({state:'ptt-release-error',error:e.message}));return false;}
    token.cancelled=true;
    if(token.timer!==null){this.unschedule(token.timer);token.timer=null;}
    if(token.rejectDelay){const reject=token.rejectDelay;token.rejectDelay=null;reject(aborted());}
    if(token.rejectEnd){const reject=token.rejectEnd;token.rejectEnd=null;reject(aborted());}
    try{token.source?.stop();}catch{}
    // Serial signal assertion and deassertion are serialized.
    await this.setPtt(false).catch(e=>this.status({state:'ptt-release-error',error:e.message}));
    return true;
  }
}