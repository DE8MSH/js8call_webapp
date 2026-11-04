import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const html=read('index.html'),ui=read('original-ui.js'),css=read('original-ui.css');
const layout=read('ui-layout.js'),app=read('app.js'),sw=read('sw.js');
const doc=read('docs/qt-ui-parity.md');
assert.match(html,/original-ui\.js\?v=1\.1/);
assert.match(html,/original-ui\.css\?v=1\.1/);
assert.match(sw,/js8web-static-v11/);
for(const path of ['original-ui.js','original-ui.css']){
 assert.ok(sw.includes("'./"+path+"'"),'offline core caches '+path);
}
for(const token of ['macroHorizontalWidget','controlHorizontalWidget',
  'tableWidgetRXAll','textEditRX','callDetailTextBrowser','callsVerticalSplitter',
  'WideGraph.ui','QSplitter']){
 assert.ok(doc.includes(token),'documented original Qt source mapping: '+token);
}
for(const id of ['qtMacroToolbar','qtControlToolbar','qtCallDetails',
  'qtWaterfallControls','qtWfPalette','qtWfGain','qtWfZero','qtWfAvg',
  'qtOffsetDown','qtOffsetUp','qtMacroWindow']){
 assert.ok(ui.includes(id),'Qt UI control exists: '+id);
}
for(const label of ['Directed','SNR','HB','Saved','INFO','CQ','Deselect','REPLY','Halt','STATUS']){
 assert.ok(ui.includes("['"+label+"'"),'Qt macro action '+label);
}
for(const label of ['AUTO','HB AUTO','HB ACK','TUNE','SPOT']){
 assert.ok(ui.includes("button('"+label+"',null"),label+' remains disabled without supporting RF implementation');
}
for(const id of ['qtWfPalette','qtWfGain','qtWfZero','qtWfAvg']){
 assert.ok(app.includes("$('"+id+"')"),'spectrogram reads '+id);
}
assert.ok(layout.includes('js8:station-selected'),'selection event emitted to station details');
assert.ok(ui.includes("addEventListener('js8:station-selected'"),'station details subscribed');
assert.ok(css.includes('@media(max-width:950px)'),'mobile layout fallback exists');
assert.ok(ui.includes('pointercancel'),'splitters support cancelled pointer gestures');
assert.ok(ui.includes('ArrowLeft')&&ui.includes('ArrowRight'),'keyboard accessible splitters');
assert.ok(ui.includes('msg')===false||ui.includes('makeDirected'),'directed RF action uses existing encoder');
console.log('Qt UI parity source/controls/cache integration checks PASS');
