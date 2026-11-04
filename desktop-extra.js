/* JS8Web 0.6 workstation: free-text composer, inbox/outbox and logbook.
 * Browser-local data; GPL-3.0-or-later. No automatic RF TX. */
const $=id=>document.getElementById(id);
const root=document.querySelector('.js8-desktop .workspace');
if(root){
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
 const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
 const key='js8web:messages:v06',records=read(key,{inbox:[],outbox:[],logbook:[]});
 for(const name of ['inbox','outbox','logbook'])if(!Array.isArray(records[name]))records[name]=[];
 const store=()=>save(key,records);
 let current=null,topZ=400;
 const composer=$('message')?.closest('.composer-pane');
 if(composer){
  const legacy=document.createElement('details');legacy.className='legacy-frame-editor';
  const summary=document.createElement('summary');summary.textContent='Erweitert: Rohframes, Audio und serielle PTT';legacy.append(summary);
  while(composer.firstChild)legacy.append(composer.firstChild);
  const form=document.createElement('div');form.className='text-composer';
  form.innerHTML='<div class="heading"><h2>Nachricht senden · JSC</h2><span>JS8Call-Datenframes</span></div>'+
    '<div class="compose-target"><label>Empfänger / Ziel<input id="textRecipient" value="@ALLCALL" maxlength="18" spellcheck="false"></label><button id="copySelection" type="button">Aus Call Activity übernehmen</button></div>'+
    '<label>Nachrichtenmodus<select id="textKind"><option value="plain">Freitext · JSC</option><option value="directed">Gerichtete MSG · JS8Call + CRC16</option></select></label>'+
    '<label>Freitext (max. 1500 Zeichen)<textarea id="textMessage" rows="4" maxlength="1500" spellcheck="false" placeholder="Deine Nachricht ..."></textarea></label>'+
    '<div class="tx-macros"><button type="button" data-macro="CQ CQ CQ DE {CALL} {GRID}">CQ</button><button type="button" data-macro="{TO} DE {CALL} SNR?">SNR?</button><button type="button" data-macro="{TO} DE {CALL} R R 73">73</button><button type="button" data-macro="{TO} DE {CALL} TNX FER QSO">TNX</button></div>'+
    '<div class="row actions"><button id="encodeText" class="primary" type="button">JSC-Frames vorbereiten</button><button id="sendText" type="button" disabled>▶ Alle Frames senden</button><button id="clearTextQueue" type="button">Queue löschen</button></div>'+
    '<div id="textQueueStatus" class="queue-status" role="status">Noch keine Freitextframes vorbereitet.</div><div id="textQueue" class="text-queue" role="list"></div>'+
    '<p class="composer-warning">Vor jeder Aussendung TX freigeben. Ein verpasster UTC-Slot führt zum sicheren Abbruch. Bei Browser-Wechsel in den Hintergrund wird TX abgebrochen. PTT ist nur über den gewählten RTS/DTR-Ausgang steuerbar; Funkgerät überwachen.</p>';
  composer.append(form);
  const ack=$('txconfirm')?.closest('label');if(ack){form.insertBefore(ack,$('textQueueStatus'));ack.classList.add('tx-confirm');}
  const cancel=$('cancel');if(cancel)form.querySelector('.actions').append(cancel);
  composer.append(legacy);
  const message=$('textMessage');message.value=read('js8web:draft:v06','');
  message.addEventListener('input',()=>save('js8web:draft:v06',message.value));
  const recipient=()=>($('textRecipient').value||'@ALLCALL').trim().toUpperCase();
  $('copySelection').onclick=()=>{$('textRecipient').value=($('targetCall').value||'@ALLCALL').toUpperCase();};
  for(const btn of form.querySelectorAll('[data-macro]'))btn.onclick=()=>{
   const phrase=btn.dataset.macro.replaceAll('{TO}',recipient()).replaceAll('{CALL}',($('call').value||'NOCALL').toUpperCase()).replaceAll('{GRID}',($('locator').value||'').toUpperCase());
   message.value+=(message.value?' ':'')+phrase;message.dispatchEvent(new Event('input'));message.focus();
  };
  function updateQueue(){
   const box=$('textQueue');box.replaceChildren();
   if(!current)return;
   current.frames.forEach((f,i)=>{
    const line=document.createElement('div');line.className='queued-frame';line.setAttribute('role','listitem');
    for(const [tag,val] of [['strong',String(i+1).padStart(2,'0')],['code',f.frame],['small','T'+f.type+' · '+f.characters+' Zeichen']]){
     const child=document.createElement(tag);child.textContent=val;line.append(child);
    }
    box.append(line);
   });
  }
  $('encodeText').onclick=()=>{
   if(!message.value.trim()){$('textQueueStatus').textContent='Bitte Nachricht eingeben.';return;}
   current=null;$('sendText').disabled=true;$('textQueueStatus').textContent='JSC-Wörterbuch wird geladen / Frames werden codiert…';
   window.dispatchEvent(new CustomEvent('js8:prepare-text',{detail:{text:message.value}}));
  };
  $('sendText').onclick=()=>{
   if(!current)return;
   if(!$('txconfirm').checked){$('textQueueStatus').textContent='TX-Freigabe fehlt.';return;}
   window.dispatchEvent(new Event('js8:send-queue'));
  };
  $('clearTextQueue').onclick=()=>{current=null;$('sendText').disabled=true;$('textQueue').replaceChildren();$('textQueueStatus').textContent='Queue gelöscht.';window.dispatchEvent(new Event('js8:clear-txqueue'));};
  $('txconfirm').addEventListener('change',()=>{if(current)$('sendText').disabled=!$('txconfirm').checked;});
  window.addEventListener('js8:txstate',({detail:d})=>{
    const output=$('textQueueStatus');
    if(!output||!current||!d)return;
    if(d.state==='armed')output.textContent='TX wartet auf UTC-Slot '+new Date(d.utcMs).toISOString().slice(11,19)+' · PTT noch aus';
    else if(d.state==='ptt')output.textContent='PTT bestätigt · warte auf zeitgenauen Audio-Beginn';
    else if(d.state==='onair')output.textContent='TX-Audio läuft · PTT aktiv';
    else if(d.state==='ptt-release-error')output.textContent='WARNUNG: PTT konnte nicht ausgeschaltet werden · Funkgerät sofort prüfen!';
  });
  window.addEventListener('js8:txqueue',({detail:d})=>{
   if(d.state==='ready'){current=d.packet;$('sendText').disabled=!$('txconfirm').checked;updateQueue();$('textQueueStatus').textContent=d.packet.frames.length+' JS8-Frames · '+d.packet.characters+' Zeichen · '+d.packet.mode.toUpperCase()+(d.packet.kind==='directed'?' · MSG CRC16 '+d.packet.checksum:' · JSC-Freitext');}
   else if(d.state==='error'){$('textQueueStatus').textContent='Fehler: '+d.error;$('sendText').disabled=true;}
   else if(d.state==='sending'){$('textQueueStatus').textContent='Audio TX: Frame '+(d.index+1)+' / '+d.total+' UTC-slotweise geplant';$('sendText').disabled=true;}
   else if(d.state==='complete'){
    $('textQueueStatus').textContent=d.total+' JS8-Frames ausgegeben. Funkempfang nicht bestätigt.';$('sendText').disabled=true;
    records.outbox.unshift({time:new Date().toISOString(),to:recipient(),text:current?.text||'',status:'Audio ausgegeben',frames:d.total});records.outbox.length=Math.min(records.outbox.length,250);store();renderWindow('outbox');
   }else if(d.state==='cancelled'){$('textQueueStatus').textContent='TX-Queue abgebrochen.';$('sendText').disabled=!current||!$('txconfirm').checked;}
  });
  ['mode','audioFreq','call','textRecipient','textKind'].forEach(id=>$(id)?.addEventListener('change',()=>{
   if(current){current=null;$('sendText').disabled=true;$('textQueue').replaceChildren();$('textQueueStatus').textContent='Einstellungen geändert: erneut vorbereiten.';}
  }));
 }
 const definitions={
  inbox:{title:'Inbox · Empfangene Nachrichten',items:records.inbox},
  outbox:{title:'Outbox · Sendeprotokoll',items:records.outbox},
  logbook:{title:'Logbuch · QSOs',items:records.logbook}
 };
 const windows=new Map();
 function renderWindow(type){
  const panel=windows.get(type);if(!panel)return;
  const body=panel.querySelector('.window-body');body.replaceChildren();
  const head=document.createElement('div');head.className='msg-table-head';
  for(const name of ['UTC',type==='inbox'?'Absender':type==='outbox'?'Ziel':'Rufzeichen',type==='logbook'?'Notiz':'Nachricht']){
   const h=document.createElement('b');h.textContent=name;head.append(h);
  }
  body.append(head);
  if(!records[type].length){const p=document.createElement('p');p.className='empty';p.textContent='Noch keine Einträge.';body.append(p);}
  for(const record of records[type].slice(0,250)){
   const row=document.createElement('div');row.className='msg-table-row';
   for(const value of [String(record.time||'').slice(0,19).replace('T',' '),record.from||record.to||record.call||'',(record.checksum==='invalid'?'[CRC FEHLER] ':'')+(record.text||record.note||'')]){
    const span=document.createElement('span');span.textContent=String(value);row.append(span);
   }
   body.append(row);
  }
 }
 function showWindow(type){
  if(windows.has(type)){const win=windows.get(type);win.hidden=false;win.style.zIndex=String(++topZ);renderWindow(type);return;}
  const panel=document.createElement('section');panel.className='js8-window';panel.id='window-'+type;panel.setAttribute('role','dialog');panel.setAttribute('aria-label',definitions[type].title);
  const bar=document.createElement('div');bar.className='window-titlebar';
  const title=document.createElement('strong');title.textContent=definitions[type].title;
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Fenster schließen');close.onclick=()=>{panel.hidden=true;};
  bar.append(title,close);
  const body=document.createElement('div');body.className='window-body';
  const tools=document.createElement('div');tools.className='window-tools';
  if(type==='logbook'){
   const call=document.createElement('input');call.placeholder='Rufzeichen';call.maxLength=16;
   const note=document.createElement('input');note.placeholder='Notiz';note.maxLength=150;
   const add=document.createElement('button');add.textContent='QSO eintragen';add.onclick=()=>{
    if(!/^[A-Z0-9/]{3,16}$/.test(call.value.toUpperCase())){alert('Gültiges Rufzeichen eingeben.');return;}
    records.logbook.unshift({time:new Date().toISOString(),call:call.value.toUpperCase(),note:note.value});records.logbook.length=Math.min(250,records.logbook.length);store();renderWindow('logbook');call.value='';note.value='';
   };
   const exportBtn=document.createElement('button');exportBtn.textContent='ADIF exportieren';exportBtn.onclick=()=>{
    const entries=records.logbook.map(x=>{
     const t=new Date(x.time),v=x.call,comment=x.note||'';
     return '<CALL:'+v.length+'>'+v+'<QSO_DATE:8>'+t.toISOString().slice(0,10).replaceAll('-','')+'<TIME_ON:6>'+t.toISOString().slice(11,19).replaceAll(':','')+'<MODE:3>JS8<COMMENT:'+comment.length+'>'+comment+'<EOR>\n';
    }).join('');
    const url=URL.createObjectURL(new Blob(['ADIF JS8Web\n<EOH>\n'+entries],{type:'text/plain'}));
    const a=document.createElement('a');a.href=url;a.download='js8web-logbook.adi';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
   };
   tools.append(call,note,add,exportBtn);
  }
  const clear=document.createElement('button');clear.textContent='Liste leeren';clear.onclick=()=>{if(confirm('Einträge lokal löschen?')){records[type].length=0;store();renderWindow(type);}};tools.append(clear);
  panel.append(bar,body,tools);document.body.append(panel);windows.set(type,panel);
  const pos=read('js8web:position:'+type,{left:Math.max(20,innerWidth/2-340),top:115});
  panel.style.left=Math.min(pos.left,innerWidth-120)+'px';panel.style.top=Math.min(pos.top,innerHeight-50)+'px';panel.style.zIndex=String(++topZ);
  let drag=null;
  bar.addEventListener('pointerdown',event=>{
   if(event.target.closest('button'))return;
   drag={x:event.clientX,y:event.clientY,l:panel.offsetLeft,t:panel.offsetTop};bar.setPointerCapture(event.pointerId);
  });
  bar.addEventListener('pointermove',event=>{
   if(!drag)return;
   panel.style.left=Math.max(0,Math.min(innerWidth-80,drag.l+event.clientX-drag.x))+'px';
   panel.style.top=Math.max(0,Math.min(innerHeight-35,drag.t+event.clientY-drag.y))+'px';
  });
  bar.addEventListener('pointerup',()=>{
   if(drag){save('js8web:position:'+type,{left:panel.offsetLeft,top:panel.offsetTop});drag=null;}
  });
  panel.addEventListener('pointerdown',()=>{panel.style.zIndex=String(++topZ);});
  renderWindow(type);
 }
 const menu=document.querySelector('.app-menu');
 if(menu){
  const entry=document.createElement('details');entry.className='app-menu-entry';
  const summary=document.createElement('summary');summary.textContent='Fenster';
  const list=document.createElement('div');list.className='app-menu-list';
  for(const [type,label] of [['inbox','Inbox'],['outbox','Outbox'],['logbook','Logbuch']]){
   const btn=document.createElement('button');btn.className='app-menu-command';btn.type='button';btn.textContent=label;btn.onclick=()=>{entry.open=false;showWindow(type);};list.append(btn);
  }
  entry.append(summary,list);menu.insertBefore(entry,menu.querySelector('.app-menu-separator'));
 }
 const bar=document.createElement('div');bar.className='message-shortcuts';
 for(const [type,label] of [['inbox','Inbox'],['outbox','Outbox'],['logbook','Logbuch']]){
  const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.onclick=()=>showWindow(type);bar.append(btn);
 }
 root.parentElement.insertBefore(bar,root);
 const seen=new Set();
 window.addEventListener('js8:conversation',e=>{
  const d=e.detail||{};
  if(!d.text)return;
  records.inbox.unshift({
    time:d.time,from:d.from||'RX',to:d.to||'',text:d.text,
    checksum:d.checksum||'none',frequency:d.frequency,mode:d.mode,kind:d.kind
  });
  records.inbox.length=Math.min(250,records.inbox.length);
  store();renderWindow('inbox');
 });
 window.addEventListener('js8:frame',e=>{
  const d=e.detail,p=d.parsed||{};
  // Decoded text appears in the conversation event after the message is
  // assembled. Never log an incomplete MSG header as a delivered message.
  if(['data','unknown','text_fragment','text'].includes(p.kind)||(p.kind==='directed'&&p.command==='MSG'))return;
  const id=[d.time,d.text].join('|');if(seen.has(id))return;seen.add(id);if(seen.size>1000)seen.delete(seen.values().next().value);
  records.inbox.unshift({time:d.time,from:p.call||'RX',text:d.display||p.display||'',raw:d.text,frequency:d.frequency});records.inbox.length=Math.min(250,records.inbox.length);store();renderWindow('inbox');
 });
}
