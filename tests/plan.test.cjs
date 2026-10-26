const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const w=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://localhost',runScripts:'outside-only'}).window;
w.SAINT_ELOI_CONFIG={enabled:false};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.eval(fs.readFileSync('plan.js','utf8')+'\n'+fs.readFileSync('app.js','utf8')+`\nwindow.planAPI={openPlanEditor,moveDraftTable,validateData,render,capacity,showPlacement,choose,get state(){return state;},get draft(){return planDraft;},setRole(value){role=value;previewRole=null;showApp();},preview(value){role='admin';previewRole=value;showApp();},change(data){state=data;render();}};`);
const $=id=>w.document.getElementById(id),api=w.planAPI;
(async()=>{
 $('demoButton').click();assert.equal(w.document.querySelectorAll('.table-block').length,42);
 api.openPlanEditor();assert.equal(api.draft.tables['t1-1'].name,'Table 1-1');
 $('planCanvas').querySelector('[data-plan-id="t1-1"]').click();$('planTableCapacity').value=8;$('planUpdateTable').click();await $('planSave').onclick();
 assert.equal($('planDialog').open,false,$('planError').textContent);assert.equal(api.capacity('t1-1'),8);
 $('t1-1').click();assert.match($('popupSubtitle').textContent,/0 \/ 8 places/);assert.equal($('popupGuestList').querySelectorAll('.seat').length,8);
 api.state.reservations.r1={reservedBy:'Groupe',status:'accepted',participants:{p1:{name:'Camille',arrived:false,paid:false,tableId:'t1-1',seat:7}}};api.render();api.validateData(api.state);
 api.choose({rid:'r1',pid:'p1'});api.showPlacement('t1-1');
 assert.equal($('placementSeat').querySelectorAll('option').length,8);assert.match($('placementTable').textContent,/sur 8/);$('placementDialog').close();
 api.openPlanEditor();$('planCanvas').querySelector('[data-plan-id="t1-1"]').click();$('planTableCapacity').value=6;$('planUpdateTable').click();assert.match($('planError').textContent,/au-delà/);
 $('planRemoveTable').click();assert.match($('planError').textContent,/encore des invités/);assert.ok(api.draft.tables['t1-1']);
 api.moveDraftTable('t1-1',2,'left',1);await $('planSave').onclick();
 assert.equal(api.state.layout.tables['t1-1'].row,2);assert.equal(api.state.layout.tables['t3-1'].row,1);assert.equal(api.state.reservations.r1.participants.p1.tableId,'t1-1');
 assert.equal(api.capacity('t1-1'),8);
 // Add enough tables for at least 300 guests, retaining existing occupied IDs.
 api.openPlanEditor();$('planRows').value=10;$('planLeft').value=3;$('planRight').value=2;$('planGenerate').click();
 assert.equal(Object.keys(api.draft.tables).length,50,$('planError').textContent);
 const newId=Object.keys(api.draft.tables).find(id=>id.length>20);assert.ok(newId);
 await $('planSave').onclick();assert.equal(w.document.querySelectorAll('.table-block').length,50);assert.equal(api.capacity(newId),6);
 assert.ok(w.document.getElementById(newId));w.document.getElementById(newId).click();assert.match($('popupSubtitle').textContent,/0 \/ 6 places/);
 // Per-row counts, touch movement to an empty cell, and persistence.
 api.openPlanEditor();$('planRowCounts').querySelector('[data-row="1"][data-side="left"]').value=4;$('planApplyRows').click();
 assert.equal(Object.keys(api.draft.tables).length,51);assert.equal(api.draft.leftColumns,4);
 $('planCanvas').querySelector('[data-plan-id="'+newId+'"]').click();
 $('planCanvas').querySelector('[data-plan-row="10"][data-plan-side="left"][data-plan-column="4"]').click();
 assert.equal(api.draft.tables[newId].row,10);assert.equal(api.draft.tables[newId].column,4);
 await $('planSave').onclick();const saved=JSON.parse(JSON.stringify(api.state));api.change({reservations:{},tables:{}});api.change(saved);
 assert.equal(w.document.querySelectorAll('.table-block').length,51);assert.equal(api.capacity('t1-1'),8);
 // Reject stale layouts and guests placed while the editor was open.
 api.openPlanEditor();api.state.layout.revision++;await $('planSave').onclick();assert.match($('planError').textContent,/autre administrateur/);$('planDialog').close();
 api.openPlanEditor();$('planCanvas').querySelector('[data-plan-id="'+newId+'"]').click();$('planRemoveTable').click();
 api.state.reservations.r1.participants.p2={name:'Marie',arrived:false,paid:false,tableId:newId,seat:1};await $('planSave').onclick();assert.match($('planError').textContent,/Un invité occupe/);assert.ok(api.state.layout.tables[newId]);$('planDialog').close();
 for(const role of ['reservations','placement','entry','viewer']){api.setRole(role);assert.equal($('editPlanButton').hidden,true);assert.throws(()=>api.openPlanEditor(),/accréditation/);}
 api.preview('placement');assert.throws(()=>api.openPlanEditor(),/aperçu/);
 api.setRole('admin');assert.equal($('editPlanButton').hidden,false);
 const broken=JSON.parse(JSON.stringify(api.state));broken.tables['t1-1'].capacity=6;assert.throws(()=>api.validateData(broken),/capacité/);
 console.log('PASS: admin layout editing, 50+ tables, stable IDs, per-row counts, movement, variable capacities, occupied-table protection, conflicts and role restrictions');w.close();
})().catch(error=>{console.error(error);w.close();process.exitCode=1;});
