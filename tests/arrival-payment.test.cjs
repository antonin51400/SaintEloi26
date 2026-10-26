const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const w=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://localhost',runScripts:'outside-only'}).window;
w.SAINT_ELOI_CONFIG={enabled:false};
w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.confirm=()=>true;
w.eval(fs.readFileSync('app.js','utf8')+`\nwindow.api={setFlag,openPaymentNote,updateCountdown,render,get state(){return state;},setup(value){state=value;},entry(ref){role='entry';lane='right';demo=false;online=true;dataRef=ref;}};`);
const $=id=>w.document.getElementById(id),api=w.api,event={preventDefault(){}};
(async()=>{
 $('demoButton').click();
 const initial={reservations:{r1:{reservedBy:'Groupe',status:'accepted',participants:{p1:{name:'Camille',tableId:'',seat:0,arrived:false,paid:false}}}},tables:{}};
 api.setup(initial);api.render();
 api.updateCountdown(Date.parse('2026-12-05T18:00:00Z'));
 assert.equal($('eventCountdown').textContent,'0 j · 1 h · 0 min · 0 s');
 api.updateCountdown(Date.parse('2026-12-05T19:00:00Z'));
 assert.equal($('eventCountdown').textContent,'La soirée a commencé !');
 api.openPaymentNote('r1','p1');
 $('paymentPayer').value='Alex <script>';$('paymentComment').value='Prévenir Camille';
 await $('paymentForm').onsubmit(event);
 let p=api.state.reservations.r1.participants.p1;
 assert.equal(p.paid,true);assert.equal(p.arrived,false);assert.equal(p.paidForBy,'Alex <script>');
 assert.ok(p.paidAt&&p.paymentRecordedAt&&p.paymentRecordedBy);
 assert.match($('guestList').textContent,/À signaler : payé par Alex <script>/);
 assert.equal($('guestList').querySelector('script'),null);
 const paidAt=p.paidAt;
 // Administrator must choose the actual entrance before confirming arrival.
 $('guestList').querySelector('[data-action="arrived"]').click();
 assert.equal($('arrivalDialog').open,true);
 $('arrivalLane').value='left';await $('arrivalForm').onsubmit(event);
 p=api.state.reservations.r1.participants.p1;
 assert.equal(p.arrivalLane,'left');assert.ok(p.arrivedAt);assert.equal(p.paidAt,paidAt);
 assert.match($('guestList').textContent,/File 1/);assert.match($('guestList').textContent,/Prévenir Camille/);
 await api.setFlag('r1','p1','arrived');p=api.state.reservations.r1.participants.p1;
 assert.equal(p.arrivedAt,'');assert.equal(p.arrivalLane,'');assert.equal(p.paidForBy,'Alex <script>');
 // A stale comment must never overwrite another terminal's payment.
 api.openPaymentNote('r1','p1');p.paidForBy='Autre payeur';
 await $('paymentForm').onsubmit(event);assert.match($('paymentError').textContent,/autre appareil/);
 $('paymentDialog').close();
 // Entrance staff writes one participant atomically, preserving placement.
 const ref={child:()=>ref,transaction:async update=>{
  const next=update(api.state.reservations.r1.participants.p1);
  if(!next)return {committed:false};api.state.reservations.r1.participants.p1=next;return {committed:true};
 }};
 api.entry(ref);await api.setFlag('r1','p1','arrived');
 p=api.state.reservations.r1.participants.p1;assert.equal(p.arrivalLane,'right');assert.equal(p.arrived,true);
 api.openPaymentNote('r1','p1');$('paymentPayer').value='Marie';await $('paymentForm').onsubmit(event);
 p=api.state.reservations.r1.participants.p1;assert.equal(p.paidForBy,'Marie');assert.equal(p.arrivalLane,'right');
 assert.equal(p.paidAt,paidAt);assert.equal($('paymentDialog').open,false);
 console.log('PASS: countdown Paris, timestamped third-party payment, visible alert, arrival lanes, conflicts and entry transaction');
 w.close();
})().catch(error=>{console.error(error);w.close();process.exitCode=1;});
