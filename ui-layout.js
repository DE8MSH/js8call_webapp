/* JS8Web v0.4 workstation UI – browser-native layout based on JS8Call's three-pane workflow.
   GPL-3.0-or-later. Reuses existing controls rather than cloning their IDs. */
const $=id=>document.getElementById(id);
const sectionBy=(term)=>[...document.querySelectorAll('main > section.panel')].find(s=>s.querySelector('h2')?.textContent.includes(term));
const main=document.querySelector('main'),header=document.querySelector('header.top');
const station=sectionBy('Station & Modem'),spectrum=sectionBy('Spektrum'),protocol=sectionBy('JS8Call-Protokoll'),diagnosis=sectionBy('Status / Diagnose');
const cols=main.querySelector('section.cols');
const bandPane=cols?.children[0],txPane=cols?.children[1];
if(main&&station&&spectrum&&protocol&&bandPane&&txPane&&diagnosis){
  document.body.classList.add('js8-desktop');
  const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!==undefined)e.innerHTML=html;return e;};
  const menubar=el('nav','app-menu');
  menubar.setAttribute('aria-label','JS8Web Menüleiste');
  const menuDefinitions=[
    ['Datei',[['WAV-Datei öffnen','wav'],['RX-Log als CSV speichern','csv'],['Stationseinstellungen speichern','save'],['Band Activity leeren','clear']]],
    ['Konfiguration',[['Station und Funkgerät…','settings'],['Audioeingang auswählen…','settings'],['Serielle PTT…','ptt'],['Uhrzeitkorrektur…','settings']]],
    ['Modus',[['NORMAL · 15 s','mode:normal'],['FAST · 10 s','mode:fast'],['TURBO · 6 s','mode:turbo'],['SLOW · 30 s','mode:slow'],['Auto-RX (breitbandig)','auto']]],
    ['Log',[['CSV exportieren','csv'],['Empfangsfenster leeren','clear'],['Nachrichtenfenster leeren','clear-messages']]],
    ['Ansicht',[['Band Activity ein-/ausblenden','toggle-band'],['Call Activity ein-/ausblenden','toggle-calls'],['Wasserfall ein-/ausblenden','toggle-waterfall'],['Status/Diagnose anzeigen','diagnosis'],['Fensteraufteilung zurücksetzen','reset']]],
    ['Steuerung',[['RX starten','rx'],['RX stoppen','stop'],['CQ vorbereiten','cq'],['Heartbeat vorbereiten','hb'],['Einzelrahmen testen','test'],['TX stoppen','halt']]],
    ['Hilfe',[['Projekt und Funktionsumfang','help'],['JS8Call-Original','original']]]
  ];
  for(const [title,entries] of menuDefinitions){
    const details=el('details','app-menu-entry'),summary=el('summary','',title),list=el('div','app-menu-list');
    details.append(summary,list);
    for(const [label,action] of entries){
      const btn=el('button','app-menu-command',label);btn.type='button';btn.dataset.action=action;list.append(btn);
    }
    details.addEventListener('toggle',()=>{if(details.open)[...menubar.querySelectorAll('details')].filter(e=>e!==details).forEach(e=>e.open=false);});
    menubar.append(details);
  }
  const version=el('span','app-version','JS8Web LAB 0.8 · RX/TX'),menutop=el('span','app-menu-separator');
  menubar.append(menutop,version);
  document.body.insertBefore(menubar,header);
  const toolbar=el('section','rig-toolbar');
  toolbar.innerHTML='<div class="rig-dial"><div class="rig-label">DIAL · USB</div><output id="dialDisplay">7.078 000</output><div id="radioStatus">Audio RX · kein CAT angeschlossen</div></div><div class="rig-settings" id="rigSettings"></div><div class="rig-control"><button type="button" id="quickRX" class="primary">RX START</button><button type="button" id="quickCQ">CQ</button><button type="button" id="quickHB">HB</button><button type="button" id="quickHalt">HALT</button></div><div class="rig-time"><span id="displayCall"></span><span id="rigUtc"></span><span id="rigSlot"></span></div>';
  main.insertBefore(toolbar,main.firstChild);
  for(const id of ['band','mode','audioFreq']){
    const label=$(id)?.closest('label');if(label)$('#rigSettings').append(label);
  }
  station.classList.add('advanced-pane');
  protocol.classList.add('advanced-pane');
  station.hidden=true;protocol.hidden=true;
  const drawers=el('div','settings-drawers');
  const settingsDetail=el('details','drawer');settingsDetail.id='settingsDrawer';
  settingsDetail.innerHTML='<summary>Station / Audio / Geräteeinstellungen</summary>';
  settingsDetail.append(station);
  const protocolDetail=el('details','drawer');protocolDetail.id='protocolDrawer';
  protocolDetail.innerHTML='<summary>CQ, Heartbeat und gerichtete Kurzbefehle</summary>';
  protocolDetail.append(protocol);
  station.hidden=false;protocol.hidden=false;
  drawers.append(settingsDetail,protocolDetail);
  const notice=main.querySelector('.notice');if(notice){notice.classList.add('compact-disclaimer');main.append(notice);}
  const workspace=el('section','workspace');
  workspace.id='workspace';
  bandPane.classList.add('band-pane');
  const center=el('div','center-pane');
  const receive=el('section','panel message-pane');
  receive.innerHTML='<div class="heading"><h2>Empfangene Nachrichten</h2><span id="rxMessageCount">0 Nachrichten</span></div><div id="rxMessages" class="message-history" role="log" aria-live="polite"><div class="empty">Hier erscheinen Heartbeats, CQ, gerichtete Rufzeichen und erkennbare Textframes.</div></div><div class="message-focus"><span id="selectedStation">Empfänger: @ALLCALL</span><button id="clearSelection" type="button">Auswahl aufheben</button></div>';
  center.append(receive,txPane);
  txPane.classList.add('composer-pane');
  const calls=el('section','panel calls-pane');
  calls.innerHTML='<div class="heading"><h2>Call Activity <span id="callCount">(0)</span></h2><button type="button" id="clearCalls">Leeren</button></div><div class="calls-filter"><input id="stationFilter" type="search" placeholder="Rufzeichen suchen…" aria-label="Rufzeichenfilter"/><label><input type="checkbox" id="onlyCQ"/> CQ/HB</label></div><div class="calls-head"><span>Call</span><span>Alter</span><span>Hz</span><span>Info</span></div><div id="callActivity" class="calls-list"><div class="empty">Noch keine Rufzeichen empfangen.</div></div><div class="calls-actions"><button type="button" id="tuneSelected">Auf Station abstimmen</button><button type="button" id="replySelected">SNR? vorbereiten</button></div>';
  workspace.append(bandPane,center,calls);
  main.insertBefore(workspace,spectrum);
  main.append(spectrum,drawers,diagnosis);
  const statusline=el('div','application-status');
  statusline.innerHTML='<span id="rxState">Empfang bereit</span><span id="lastCall">Keine Aktivität</span><span id="stationStatus">JS8 · NORMAL</span>';
  main.append(statusline);
  const bandLog=$('log');if(bandLog)bandLog.setAttribute('aria-label','Band Activity');
  const topText=document.createElement('div');topText.className='window-label';topText.textContent='JS8Call · WebAssembly RX';header.prepend(topText);
  const oldHeaderClock=$('utc'),oldStatus=$('clockStatus'),clockText=$('rigUtc'),slotText=$('rigSlot');
  function clock(){clockText.textContent=oldHeaderClock?.textContent||'--:--:-- UTC';slotText.textContent=oldStatus?.textContent||'';}
  setInterval(clock,400);clock();
  function setDial(){
    const mhz=Number($('band')?.value||7078)/1000;
    $('dialDisplay').textContent=mhz.toFixed(6).replace('.', '.').replace(/(\.\d{3})(\d{3})$/,'$1 $2');
    $('displayCall').textContent=($('call')?.value||'STATION').toUpperCase();
    $('stationStatus').textContent='JS8 · '+($('mode')?.value||'normal').toUpperCase();
  }
  ['band','call','mode'].forEach(id=>$(id)?.addEventListener('change',setDial));$('call')?.addEventListener('input',setDial);setDial();
  const callbook=new Map(),messages=[];
  let selected='',selectedFreq=0;
  function selectStation(call){
    selected=call;$('selectedStation').textContent='Empfänger: '+(call||'@ALLCALL');
    if(call){$('targetCall').value=call;if($('textRecipient'))$('textRecipient').value=call;const entry=callbook.get(call);selectedFreq=entry?.freq||0;}
    paintCalls();paintMessages();
  }
  function paintCalls(){
    const box=$('callActivity');box.replaceChildren();
    const needle=($('stationFilter').value||'').trim().toUpperCase(),only=$('onlyCQ').checked;
    const entries=[...callbook.values()].filter(c=>(!needle||c.call.includes(needle))&&(!only||c.kind==='beacon')).sort((a,b)=>b.when-a.when);
    $('callCount').textContent='('+callbook.size+')';
    if(!entries.length){const empty=el('div','empty','Keine passenden Stationen.');box.append(empty);return;}
    for(const c of entries){
      const btn=el('button','call-row'+(selected===c.call?' selected':''));
      btn.type='button';btn.dataset.call=c.call;btn.title='Klicken: Station auswählen · Doppelklicken: Audiofrequenz übernehmen';
      const mins=Math.max(0,Math.floor((Date.now()-c.when)/60000));
      for(const [val,cls] of [[c.call,'call-name'],[mins+'m','call-age'],[c.freq.toFixed(0),'call-hz'],[c.kind==='beacon'?'CQ/HB':c.command||'RX','call-info']]){
        const span=el('span',cls);span.textContent=val;btn.append(span);
      }
      btn.addEventListener('click',()=>selectStation(c.call));
      btn.addEventListener('dblclick',()=>{selectStation(c.call);tuneStation();});
      btn.addEventListener('contextmenu',event=>{event.preventDefault();selectStation(c.call);openStationMenu(event,c);});
      box.append(btn);
    }
  }
  function openStationMenu(event,station){
    document.getElementById('stationContextMenu')?.remove();
    const menu=el('div','station-context');menu.id='stationContextMenu';
    const actions=[
      ['Offset '+Math.round(station.freq)+' Hz wählen',()=>tuneStation()],
      ['SNR? an '+station.call+' vorbereiten',()=>quickCommand(station.call,'SNR?')],
      ['GRID? an '+station.call+' vorbereiten',()=>quickCommand(station.call,'GRID?')],
      ['INFO? an '+station.call+' vorbereiten',()=>quickCommand(station.call,'INFO?')],
      ['Rufzeichen kopieren',()=>navigator.clipboard?.writeText(station.call)],
      ['Station aus Liste entfernen',()=>{callbook.delete(station.call);if(selected===station.call)selectStation('');paintCalls();}]
    ];
    function quickCommand(call,cmd){$('targetCall').value=call;$('directCmd').value=cmd;$('makeDirected').click();}
    for(const [label,callback] of actions){const button=el('button','',label);button.type='button';button.onclick=()=>{menu.remove();callback();};menu.append(button);}
    document.body.append(menu);
    menu.style.left=Math.min(event.clientX,Math.max(0,innerWidth-270))+'px';
    menu.style.top=Math.min(event.clientY,Math.max(0,innerHeight-265))+'px';
    setTimeout(()=>document.addEventListener('pointerdown',function close(e){if(!menu.contains(e.target)){menu.remove();document.removeEventListener('pointerdown',close);}},true),0);
  }
  function paintMessages(){
    const box=$('rxMessages');box.replaceChildren();
    const arr=messages.filter(m=>!selected||m.call===selected||m.to===selected);
    if(!arr.length){box.append(el('div','empty','Keine Nachrichten für diese Auswahl.'));return;}
    for(const m of arr.slice(-180)){
      const div=el('div','message-item '+m.kind);
      const t=el('time');t.textContent=new Date(m.time).toISOString().slice(11,19)+' · '+m.frequency.toFixed(0)+' Hz';
      const p=el('div','message-text');p.textContent=m.display;
      div.append(t,p);box.append(div);
    }
    box.scrollTop=box.scrollHeight;
  }
  window.addEventListener('js8:frame',e=>{
    const d=e.detail||{},p=d.parsed||{},when=Date.parse(d.time)||Date.now();
    if(p.call&&!p.call.startsWith('<')&&!p.call.startsWith('@')){
      callbook.set(p.call,{call:p.call,when,freq:d.frequency||0,kind:p.kind,command:p.command||'',grid:p.grid||''});
      paintCalls();
    }
    if(p.kind!=='data'&&p.kind!=='unknown'&&p.kind!=='text'&&p.kind!=='text_fragment'&&!(p.kind==='directed'&&p.command==='MSG')){
      messages.push({...d,...p,time:new Date(when).toISOString()});
      if(messages.length>300)messages.shift();paintMessages();$('rxMessageCount').textContent=messages.length+' Nachrichten';
    }
    $('lastCall').textContent=(p.call||'RX')+' · '+Number(d.frequency||0).toFixed(0)+' Hz';
    $('rxState').textContent='Frame empfangen · '+new Date(when).toISOString().slice(11,19)+' UTC';
  });
  window.addEventListener('js8:conversation',e=>{
    const d=e.detail||{},now=Date.parse(d.time)||Date.now();
    const from=String(d.from||'').toUpperCase();
    const to=String(d.to||'').toUpperCase();
    const display=(d.checksum==='invalid'?'[CRC FEHLER] ':'')+String(d.text||'');
    messages.push({kind:d.kind==='directed'?'directed':'text',display,call:from,to,
      time:new Date(now).toISOString(),frequency:Number(d.frequency)||0});
    if(messages.length>300)messages.shift();
    if(from&&/^[A-Z0-9/]{3,15}$/.test(from)){
      const old=callbook.get(from);
      callbook.set(from,{call:from,when:now,freq:Number(d.frequency)||0,
        kind:'directed',command:'MSG',grid:old?.grid||''});
      paintCalls();
    }
    paintMessages();$('rxMessageCount').textContent=messages.length+' Nachrichten';
  });
  window.addEventListener('js8:clear',()=>{messages.length=0;paintMessages();$('rxMessageCount').textContent='0 Nachrichten';});
  function tuneStation(){
    if(!selected||!selectedFreq)return;
    $('audioFreq').value=String(Math.round(selectedFreq));$('audioFreq').dispatchEvent(new Event('change',{bubbles:true}));
    $('rxState').textContent='Audiofrequenz '+Math.round(selectedFreq)+' Hz gewählt';
  }
  function beacon(kind){$('beaconKind').value=kind;$('makeBeacon').click();}
  const primary={
    rx:()=>$('#start').click(),stop:()=>$('#stop').click(),wav:()=>$('#wav').click(),
    csv:()=>$('#csv').click(),clear:()=>$('#clear').click(),
    'clear-messages':()=>{messages.length=0;paintMessages();$('#rxMessageCount').textContent='0 Nachrichten';},
    cq:()=>beacon('CQ'),hb:()=>beacon('HB'),test:()=>$('#synthetic').click(),
    halt:()=>$('#cancel').click(),
    settings:()=>{$('#settingsDrawer').open=true;$('#settingsDrawer').scrollIntoView({behavior:'smooth',block:'nearest'});},
    ptt:()=>{$('#settingsDrawer').open=true;$('#pttLine').scrollIntoView({behavior:'smooth',block:'center'});},
    diagnosis:()=>diagnosis.scrollIntoView({behavior:'smooth',block:'start'}),
    original:()=>window.open('https://github.com/js8call/js8call','_blank','noopener'),
    help:()=>window.alert('JS8Web LAB 0.6 · Browser-Teilport. Empfang und CQ/HB-Kurzbefehle verfügbar; JSC-Freitext-Dekompression ist implementiert; Inbox und vollständige QSO-Steuerung fehlen noch. Keine vollständige JS8Call-Desktop-Emulation.'),
    save:()=>{saveSettings();window.alert('Stations-/Anzeigeeinstellungen lokal im Browser gespeichert.');},
    auto:()=>{$('scanAuto').checked=!$('scanAuto').checked;saveSettings();},
    'toggle-band':()=>{bandPane.classList.toggle('pane-hidden');saveSettings();},
    'toggle-calls':()=>{calls.classList.toggle('pane-hidden');saveSettings();},
    'toggle-waterfall':()=>{spectrum.classList.toggle('pane-hidden');saveSettings();},
    reset:()=>{[bandPane,calls,spectrum].forEach(x=>x.classList.remove('pane-hidden'));saveSettings();}
  };
  menubar.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-action]');if(!btn)return;
    const a=btn.dataset.action;
    if(a.startsWith('mode:')){
      if($('#mode').disabled){window.alert('Moduswechsel erst nach RX Stop.');return;}
      $('#mode').value=a.split(':')[1];$('#mode').dispatchEvent(new Event('change',{bubbles:true}));setDial();saveSettings();
    }else primary[a]?.();
    btn.closest('details').open=false;
  });
  document.addEventListener('pointerdown',e=>{if(!menubar.contains(e.target))menubar.querySelectorAll('details').forEach(x=>x.open=false);});
  $('quickRX').onclick=()=>$('#start').click();
  $('quickCQ').onclick=()=>beacon('CQ');
  $('quickHB').onclick=()=>beacon('HB');
  $('quickHalt').onclick=()=>$('#cancel').click();
  $('clearCalls').onclick=()=>{callbook.clear();selectStation('');};
  $('clearSelection').onclick=()=>selectStation('');
  $('tuneSelected').onclick=tuneStation;
  $('replySelected').onclick=()=>{if(!selected){window.alert('Zuerst Rufzeichen auswählen.');return;}$('#targetCall').value=selected;$('#directCmd').value='SNR?';$('#makeDirected').click();};
  $('stationFilter').addEventListener('input',paintCalls);
  $('onlyCQ').addEventListener('change',paintCalls);
  setInterval(paintCalls,15000);
  const prefIds=['call','locator','band','mode','audioFreq','offset','pttLead','scanAuto','enhancedRx'];
  function saveSettings(){
    const prefs={};for(const id of prefIds){const v=$(id);if(v)prefs[id]=v.type==='checkbox'?v.checked:v.value;}
    prefs.showBand=!bandPane.classList.contains('pane-hidden');
    prefs.showCalls=!calls.classList.contains('pane-hidden');
    prefs.showWaterfall=!spectrum.classList.contains('pane-hidden');
    try{localStorage.setItem('js8web:station:v04',JSON.stringify(prefs));}catch{}
  }
  try{
    const prefs=JSON.parse(localStorage.getItem('js8web:station:v04')||'null');
    if(prefs){for(const id of prefIds){const v=$(id);if(!v||!(id in prefs))continue;if(v.type==='checkbox')v.checked=!!prefs[id];else v.value=String(prefs[id]);}
      if(prefs.showBand===false)bandPane.classList.add('pane-hidden');
      if(prefs.showCalls===false)calls.classList.add('pane-hidden');
      if(prefs.showWaterfall===false)spectrum.classList.add('pane-hidden');
      $('#protocolCall').value=$('#call').value.toUpperCase();
      setDial();
    }
  }catch{}
  for(const id of prefIds){$(id)?.addEventListener('change',saveSettings);}
  const rxButton=$('start'),stopButton=$('stop');
  function stateButtons(){const on=rxButton.disabled;$('#quickRX').disabled=on;$('#quickRX').textContent=on?'RX AKTIV':'RX START';}
  for(const b of [rxButton,stopButton])b.addEventListener('click',()=>setTimeout(stateButtons,700));
  setInterval(stateButtons,1500);
}
