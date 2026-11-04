/* JS8Web v1.1: Qt UI parity layer (GPL-3.0-or-later).
 * Layout/labels derived from uploaded JS8_UI/mainwindow.ui and WideGraph.ui,
 * with existing JS8Web functions reused rather than imitating unsupported RF.
 * No new automatic transmissions, no unimplemented CAT/Hamlib/APRS claims. */
const $=id=>document.getElementById(id);
const workspace=$('workspace'),menu=document.querySelector('.app-menu');
if(workspace&&menu){
 const band=workspace.querySelector('.band-pane');
 const center=workspace.querySelector('.center-pane');
 const calls=workspace.querySelector('.calls-pane');
 const spectrum=document.querySelector('section.spectrum');
 const uiKey='js8web:qt-layout:v11';
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
 const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
 const settings=read(uiKey,{sizes:[35,40,25],waterfall:true,controls:true});
 const mk=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;};
 const button=(label,fn,tooltip)=>{
  const b=mk('button','qt-button',label);b.type='button';
  if(tooltip)b.title=tooltip;
  if(fn)b.addEventListener('click',fn);
  else{b.disabled=true;b.title=(tooltip||'')+' · Noch nicht vollständig im Browser portiert';}
  return b;
 };
 const selectedCall=()=>($('targetCall')?.value||'').trim().toUpperCase();
 const setRecipient=()=>{
  const call=selectedCall();
  if(call&&$('textRecipient'))$('textRecipient').value=call;
  return call;
 };
 function prepareDirected(command){
  const call=setRecipient();
  if(!call||call==='@ALLCALL'){window.alert('Bitte zuerst eine Gegenstation in Call Activity auswählen.');return;}
  const select=$('directCmd');
  if(![...select.options].some(o=>o.value===command))select.add(new Option(command,command));
  select.value=command;
  $('makeDirected')?.click();
 }
 function beacon(kind){
  if($('beaconKind'))$('beaconKind').value=kind;
  $('makeBeacon')?.click();
 }
 function reply(){
  setRecipient();
  const text=$('textMessage');
  if(!text)return;
  text.focus();text.scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 function openWindow(name){
  const bar=document.querySelector('.message-shortcuts');
  const btn=[...(bar?.querySelectorAll('button')||[])].find(x=>x.textContent.trim().toLowerCase()===name.toLowerCase());
  btn?.click();
 }
 let macros=read('js8web:qt-macros:v11',[
   {name:'73',text:'{TO} DE {CALL} 73'},
   {name:'QTH',text:'{TO} DE {CALL} QTH {GRID}'},
   {name:'TNX',text:'{TO} DE {CALL} TNX FER QSO'}
 ]);
 if(!Array.isArray(macros))macros=[];
 macros=macros.filter(x=>x&&typeof x.name==='string'&&typeof x.text==='string').slice(0,40);
 function expand(text){
  return text.replaceAll('{TO}',setRecipient()||'@ALLCALL')
   .replaceAll('{CALL}',($('call')?.value||'').toUpperCase())
   .replaceAll('{GRID}',($('locator')?.value||'').toUpperCase());
 }
 function savedMacros(){
  const old=$('qtMacroWindow');if(old){old.showModal();return;}
  const dialog=mk('dialog','qt-macro-dialog');dialog.id='qtMacroWindow';
  const title=mk('h3','', 'Saved Messages · JS8Call');
  const note=mk('p','qt-note','Die Auswahl fügt nur Text in den Editor ein. Keine automatische Aussendung.');
  const list=mk('div','qt-saved-list');
  const row=mk('div','qt-macro-form');
  const name=mk('input');name.placeholder='Kurzname';name.maxLength=25;name.setAttribute('aria-label','Makroname');
  const body=mk('textarea');body.placeholder='Text mit {CALL}, {TO}, {GRID}';body.maxLength=600;body.rows=3;
  body.setAttribute('aria-label','Makrotext');
  const save=button('Makro speichern',()=>{
   if(!name.value.trim()||!body.value.trim())return;
   const n=name.value.trim(),entry={name:n,text:body.value.trim()};
   const existing=macros.findIndex(x=>x.name===n);
   if(existing>=0)macros[existing]=entry;else macros.push(entry);
   macros=macros.slice(-40);write('js8web:qt-macros:v11',macros);
   paint();name.value='';body.value='';
  });
  row.append(name,body,save);
  const close=button('Schließen',()=>dialog.close());
  function paint(){
   list.replaceChildren();
   for(const macro of macros){
    const item=mk('div','qt-saved-item');
    const use=button(macro.name,()=>{
      const text=$('textMessage');
      if(!text)return;
      text.value+=(text.value?' ':'')+expand(macro.text);
      text.dispatchEvent(new Event('input',{bubbles:true}));
      dialog.close();text.focus();
    },macro.text);
    const del=button('Löschen',()=>{
      macros=macros.filter(x=>x!==macro);
      write('js8web:qt-macros:v11',macros);paint();
    });
    item.append(use,mk('code','',macro.text),del);list.append(item);
   }
  }
  paint();dialog.append(title,note,list,row,close);document.body.append(dialog);dialog.showModal();
 }
 // Original mainwindow.ui: macroHorizontalWidget.
 const macro=mk('section','qt-macro-toolbar');macro.id='qtMacroToolbar';
 const macroName=mk('span','qt-bar-label','MESSAGES');
 macro.append(macroName);
 for(const [label,action,tip] of [
  ['Directed',()=>prepareDirected('SNR?'),'Gerichteten Kurzframe vorbereiten'],
  ['SNR',()=>prepareDirected('SNR?'),'SNR?-Anfrage vorbereiten'],
  ['HB',()=>beacon('HB'),'Heartbeat-Frame vorbereiten'],
  ['Saved',savedMacros,'Gespeicherte Freitextmakros'],
  ['INFO',()=>prepareDirected('INFO?'),'INFO?-Anfrage vorbereiten'],
  ['CQ',()=>beacon('CQ'),'CQ-Frame vorbereiten'],
  ['Deselect',()=>$('clearSelection')?.click(),'Stationsauswahl aufheben'],
  ['REPLY',reply,'Texteditor auf ausgewählte Station fokussieren'],
  ['Halt',()=>$('cancel')?.click(),'Geplante Audio-/PTT-Aussendung abbrechen'],
  ['STATUS',()=>prepareDirected('STATUS?'),'STATUS?-Anfrage vorbereiten']
 ])macro.append(button(label,action,tip));
 // Original mainwindow.ui: controlHorizontalWidget. Missing functionality is
 // intentionally disabled, never fake enabled toggles.
 const control=mk('section','qt-control-toolbar');control.id='qtControlToolbar';
 control.append(mk('span','qt-bar-label','CONTROL'));
 const modeBadge=button('MODE · '+($('mode')?.value||'NORMAL').toUpperCase(),()=>{
  $('mode')?.focus();$('mode')?.click();
 },'Modus im oberen Auswahlfeld ändern');
 modeBadge.id='qtModeBadge';control.append(modeBadge);
 const rxButton=button('RX · OFF',()=>{
  if($('start')?.disabled)$('stop')?.click();else $('start')?.click();
 },'Empfänger ein-/ausschalten');rxButton.id='qtRxToggle';
 const txButton=button('TX · MANUAL',()=>{
  $('txconfirm')?.scrollIntoView({block:'nearest',behavior:'smooth'});
  $('txconfirm')?.focus();
 },'Eine Aussendung benötigt weiterhin ausdrücklich die manuelle Freigabe');
 control.append(rxButton,txButton);
 control.append(button('AUTO',null,'Automatische Antworten sind nicht implementiert'));
 control.append(button('HB AUTO',null,'Regelmäßige unbeaufsichtigte HB-Aussendungen sind nicht implementiert'));
 control.append(button('HB ACK',null,'Automatische Heartbeat-ACKs sind nicht implementiert'));
 control.append(button('TUNE',null,'Kontinuierlicher Abstimmton mit sicherer PTT-Steuerung fehlt'));
 control.append(button('SPOT',null,'Kein PSKReporter/APRS-Netzwerkzugriff implementiert'));
 control.append(button('LOG QSO',()=>openWindow('Logbuch'),'Lokales QSO-Logbuch öffnen'));
 control.append(button('CAT',()=>{
  const drawer=$('ft450CatDrawer');
  if(drawer){drawer.open=true;drawer.scrollIntoView({block:'center',behavior:'smooth'});}
 },'FT-450-CAT-Einstellungen öffnen'));
 workspace.after(macro,control);
 $('mode')?.addEventListener('change',()=>{modeBadge.textContent='MODE · '+$('mode').value.toUpperCase();});
 function refresh(){
  const on=!!$('start')?.disabled;
  rxButton.textContent=on?'RX · ON':'RX · OFF';rxButton.classList.toggle('qt-on',on);
  txButton.textContent=$('txconfirm')?.checked?'TX · FREIGABE':'TX · MANUAL';
  txButton.classList.toggle('qt-armed',!!$('txconfirm')?.checked);
 }
 for(const node of [$('start'),$('stop'),$('txconfirm')])node?.addEventListener('click',()=>setTimeout(refresh,80));
 $('txconfirm')?.addEventListener('change',refresh);setInterval(refresh,1200);refresh();

 // Original tableWidgetRXAll: column headings and row sorting.
 const log=$('log');
 if(log&&band){
  const heading=mk('div','qt-table-heading');
  for(const [label,sort] of [['UTC','time'],['Mode','mode'],['Offset','offset'],['Message','message']]){
   const b=button(label,()=>{
    const rows=[...log.querySelectorAll('.logrow')];
    rows.sort((a,b)=>{
     const value=row=>sort==='time'?row.querySelector('time')?.textContent:
      sort==='mode'?row.querySelector('strong')?.textContent:
      sort==='offset'?Number((row.querySelector('span')?.textContent||'').match(/([\d.]+)Hz/)?.[1]||0):
      row.querySelector('code')?.textContent;
     const x=value(a),y=value(b);
     return typeof x==='number'?x-y:String(x||'').localeCompare(String(y||''));
    });
    if(heading.dataset.sort===sort){rows.reverse();heading.dataset.sort='';}
    else heading.dataset.sort=sort;
    log.append(...rows);
   });
   b.classList.add('qt-col-label');heading.append(b);
  }
  log.before(heading);
  const title=band.querySelector('.heading h2');
  if(title)title.textContent='Band Activity';
 }
 // Call details: original callDetailTextBrowser, optional when station chosen.
 let selected='';
 const detail=mk('section','qt-call-details');detail.id='qtCallDetails';detail.hidden=true;
 const detailTitle=mk('div','qt-call-title');
 const detailBody=mk('dl','qt-call-info');
 const detailActions=mk('div','qt-call-actions');
 detailActions.append(button('Reply',reply),button('Tune',()=>$('tuneSelected')?.click()));
 detail.append(detailTitle,detailBody,detailActions);
 const callHeader=calls?.querySelector('.heading');
 if(calls&&callHeader)callHeader.after(detail);
 const seenCalls=new Map();
 const logCall=(call,values)=>{
  if(!/^[A-Z0-9/]{3,18}$/.test(call||''))return;
  seenCalls.set(call,{...(seenCalls.get(call)||{}),...values});
  if(selected===call)paintDetail();
 };
 function paintDetail(){
  const entry=seenCalls.get(selected);
  detail.hidden=!selected;
  if(!selected)return;
  detailTitle.textContent=selected+' · Station details';
  detailBody.replaceChildren();
  for(const [label,value] of [
   ['Callsign',selected],['Grid',entry?.grid||'—'],
   ['Audio Offset',Number.isFinite(entry?.frequency)?entry.frequency.toFixed(0)+' Hz':'—'],
   ['Last heard',entry?.time?new Date(entry.time).toISOString().slice(11,19)+' UTC':'—'],
   ['Command',entry?.command||'—'],['Submode',entry?.mode||'—']]){
    const dt=mk('dt','',label),dd=mk('dd','',value);detailBody.append(dt,dd);
   }
 }
 window.addEventListener('js8:station-selected',event=>{
  selected=String(event.detail?.call||'').toUpperCase();paintDetail();
 });
 window.addEventListener('js8:frame',event=>{
  const d=event.detail||{},p=d.parsed||{};
  if(p.call)logCall(p.call,{grid:p.grid||seenCalls.get(p.call)?.grid,
    frequency:d.frequency,time:d.time,command:p.command||p.kind,mode:d.mode});
 });
 window.addEventListener('js8:conversation',event=>{
  const d=event.detail||{};
  if(d.from)logCall(d.from,{frequency:d.frequency,time:d.time,command:'MSG',mode:d.mode});
 });

 // Original WideGraph.ui: waterfall Size / Palette / Scrolling & Averaging.
 if(spectrum){
  const bar=mk('section','qt-waterfall-controls');bar.id='qtWaterfallControls';
  bar.innerHTML='<div class="qt-wf-section"><strong>Offset</strong><button type="button" id="qtOffsetDown" title="Audio-Offset −25 Hz">−25</button><output id="qtAudioOffset">1500 Hz</output><button type="button" id="qtOffsetUp" title="Audio-Offset +25 Hz">+25</button></div>'+
   '<label>Palette<select id="qtWfPalette"><option value="classic">Default</option><option value="heat">Heat</option><option value="gray">Grayscale</option></select></label>'+
   '<label>Gain<input type="range" id="qtWfGain" min="20" max="200" step="5" value="100"/></label>'+
   '<label>Zero<input type="range" id="qtWfZero" min="-40" max="40" value="0"/></label>'+
   '<label>Average<input type="range" id="qtWfAvg" min="0" max="95" value="38"/></label>'+
   '<button type="button" id="qtDriftSettings">Time Drift…</button>';
  const water=spectrum.querySelector('.water');if(water)water.before(bar);
  const wfKey='js8web:qt-widegraph:v11';
  const settings=read(wfKey,{});
  for(const id of ['qtWfPalette','qtWfGain','qtWfZero','qtWfAvg']){
   const node=$(id);if(!node)continue;
   if(settings[id]!==undefined)node.value=String(settings[id]);
   node.addEventListener('input',()=>{
    const state={};for(const k of ['qtWfPalette','qtWfGain','qtWfZero','qtWfAvg'])state[k]=$(k)?.value;
    write(wfKey,state);
   });
  }
  const updateOffset=()=>{$('qtAudioOffset').textContent=($('audioFreq')?.value||'1500')+' Hz';};
  $('audioFreq')?.addEventListener('input',updateOffset);
  $('audioFreq')?.addEventListener('change',updateOffset);updateOffset();
  function adjustOffset(diff){
   const node=$('audioFreq');if(!node)return;
   node.value=String(Math.max(300,Math.min(3000,Number(node.value)+diff)));
   node.dispatchEvent(new Event('input',{bubbles:true}));
   node.dispatchEvent(new Event('change',{bubbles:true}));
  }
  $('qtOffsetDown').onclick=()=>adjustOffset(-25);
  $('qtOffsetUp').onclick=()=>adjustOffset(25);
  $('qtDriftSettings').onclick=()=>{
   const drawer=$('settingsDrawer');if(drawer)drawer.open=true;
   $('offset')?.scrollIntoView({block:'center',behavior:'smooth'});
   $('offset')?.focus();
  };
  const visible=settings.controls!==false;
  bar.hidden=!(settings.controls??true);
  const viewMenu=[...menu.querySelectorAll('details.app-menu-entry')].find(x=>x.querySelector('summary')?.textContent.trim()==='Ansicht');
  function addMenu(label,callback){
   const btn=mk('button','app-menu-command',label);btn.type='button';btn.onclick=()=>{
    callback();if(viewMenu)viewMenu.open=false;
   };viewMenu?.querySelector('.app-menu-list')?.append(btn);
  }
  addMenu('Wasserfall-Regler anzeigen/ausblenden',()=>{bar.hidden=!bar.hidden;write('js8web:qt-wf-controls',!bar.hidden);});
  const storedVisibility=read('js8web:qt-wf-controls',visible);
  bar.hidden=!storedVisibility;
 }

 // Qt textVerticalSplitter: adjust receive transcript vs TX composer height.
 if(center){
  const rxPanel=center.querySelector('.message-pane'),txPanel=center.querySelector('.composer-pane');
  if(rxPanel&&txPanel){
   center.classList.add('qt-vertical-split');
   const key='js8web:qt-text-split:v11';
   let ratio=Number(read(key,43));
   if(!Number.isFinite(ratio)||ratio<25||ratio>75)ratio=43;
   const bar=mk('div','qt-v-grip');
   bar.tabIndex=0;bar.setAttribute('role','separator');
   bar.setAttribute('aria-orientation','horizontal');
   bar.setAttribute('aria-label','Empfangstext und Nachrichteneditor vergrößern');
   function apply(){
    center.style.gridTemplateRows='minmax(160px,'+ratio+'fr) 7px minmax(250px,'+(100-ratio)+'fr)';
    write(key,ratio);
   }
   function adjust(delta){
    ratio=Math.max(25,Math.min(75,ratio+delta));apply();
   }
   let dragging=null;
   bar.addEventListener('pointerdown',e=>{
    if(matchMedia('(max-width:950px)').matches)return;
    dragging=e.clientY;bar.setPointerCapture(e.pointerId);
   });
   bar.addEventListener('pointermove',e=>{
    if(dragging===null)return;
    const height=Math.max(1,center.getBoundingClientRect().height);
    const delta=(e.clientY-dragging)/height*100;
    dragging=e.clientY;adjust(delta);
   });
   bar.addEventListener('pointerup',()=>{dragging=null;});
   bar.addEventListener('pointercancel',()=>{dragging=null;});
   bar.addEventListener('keydown',e=>{
    if(e.key==='ArrowUp'||e.key==='ArrowDown'){
     e.preventDefault();adjust(e.key==='ArrowDown'?3:-3);
    }
   });
   center.insertBefore(bar,txPanel);
   apply();
  }
 }
 // Qt QSplitter topSplitter: draggable, keyboard-accessible station columns.
 if(band&&center&&calls){
  workspace.classList.add('qt-split-workspace');
  let sizes=Array.isArray(settings.sizes)&&settings.sizes.length===3?
    settings.sizes.map(Number):[35,40,25];
  if(sizes.some(x=>!Number.isFinite(x)||x<10)||Math.abs(sizes.reduce((a,b)=>a+b,0)-100)>2)
   sizes=[35,40,25];
  function apply(){
   workspace.style.gridTemplateColumns='minmax(200px,'+sizes[0]+'fr) 7px minmax(300px,'+sizes[1]+'fr) 7px minmax(200px,'+sizes[2]+'fr)';
  }
  function persist(){
   write(uiKey,{...read(uiKey,{}),sizes});apply();
  }
  function grip(which){
   const sep=mk('div','qt-grip');sep.tabIndex=0;sep.setAttribute('role','separator');
   sep.setAttribute('aria-orientation','vertical');sep.setAttribute('aria-label',which===0?'Band/Message panel divider':'Message/Call panel divider');
   let drag=null;
   function shift(delta){
    if(which===0){
     const dx=Math.max(-sizes[0]+15,Math.min(sizes[1]-18,delta));
     sizes[0]+=dx;sizes[1]-=dx;
    }else{
     const dx=Math.max(-sizes[1]+18,Math.min(sizes[2]-15,delta));
     sizes[1]+=dx;sizes[2]-=dx;
    }
    persist();
   }
   sep.addEventListener('pointerdown',e=>{
    if(matchMedia('(max-width:950px)').matches)return;
    drag={x:e.clientX};
    sep.setPointerCapture(e.pointerId);
   });
   sep.addEventListener('pointermove',e=>{
    if(!drag)return;
    const width=Math.max(1,workspace.clientWidth);
    const delta=(e.clientX-drag.x)/width*100;
    drag.x=e.clientX;shift(delta);
   });
   sep.addEventListener('pointerup',()=>{drag=null;});
   sep.addEventListener('pointercancel',()=>{drag=null;});
   sep.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
     e.preventDefault();shift(e.key==='ArrowRight'?2:-2);
    }
   });
   return sep;
  }
  const g0=grip(0),g1=grip(1);
  workspace.insertBefore(g0,center);
  workspace.insertBefore(g1,calls);
  apply();
  const viewMenu=[...menu.querySelectorAll('details.app-menu-entry')].find(x=>x.querySelector('summary')?.textContent.trim()==='Ansicht');
  const list=viewMenu?.querySelector('.app-menu-list');
  if(list){
   const reset=button('Qt-Fensteraufteilung zurücksetzen',()=>{
    sizes=[35,40,25];persist();viewMenu.open=false;
   });
   reset.className='app-menu-command';list.append(reset);
  }
 }
 // QMainWindow focus actions and original F11 fullscreen.
 const view=[...menu.querySelectorAll('details.app-menu-entry')].find(x=>x.querySelector('summary')?.textContent.trim()==='Ansicht');
 if(view){
  const list=view.querySelector('.app-menu-list');
  const full=button('Vollbild (wie Qt F11)',async()=>{
   try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
   }catch(e){window.alert('Vollbild: '+e.message);}
   view.open=false;
  });full.className='app-menu-command';list?.append(full);
 }
 const focusMenu=[...menu.querySelectorAll('details.app-menu-entry')].find(x=>x.querySelector('summary')?.textContent.trim()==='Steuerung');
 if(focusMenu){
  const list=focusMenu.querySelector('.app-menu-list');
  for(const [label,id] of [['Fokus: Nachrichteneditor','textMessage'],['Fokus: Band Activity','log'],['Fokus: Call Activity','callActivity']]){
   const b=button(label,()=>{$(id)?.focus();$(id)?.scrollIntoView({block:'nearest'});focusMenu.open=false;});
   b.className='app-menu-command';list?.append(b);
  }
 }
 document.body.classList.add('js8-qt-parity');
}
