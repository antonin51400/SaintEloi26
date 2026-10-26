const {JSDOM}=require('jsdom');const path=require('node:path');const fs=require('fs');const assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{url:'http://localhost',runScripts:'outside-only'});const w=dom.window,d=w.document;w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.confirm=()=>true;w.SAINT_ELOI_CONFIG={enabled:false};w.SAINT_ELOI_ACCESS_CODES={'0722':{name:'Accueil',role:'entry'},'7890':{name:'Placement',role:'placement'},'2002':{name:'Blanckaert',role:'organizer'}};
w.eval(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8')+'\nwindow.testAPI={editReservation,choose,showPlacement,openTablePopup,closeTablePopup,clearSelection,setStatus,setFlag,mutate,validateData,render,allGuests,get state(){return state;},set state(v){state=v;},get busy(){return busy;}}');
const app=w.testAPI,$=id=>d.getElementById(id),e={preventDefault(){}};
async function create(by,names,status='accepted',contacted='Antonin Blanckaert'){app.editReservation();$('reservedBy').value=by;$('contactedOrganizer').value=contacted;$('reservationStatus').value=status;$('participantRows').querySelector('input').value=names[0];for(const name of names.slice(1)){$('addParticipant').click();$('participantRows').lastChild.querySelector('input').value=name;}await $('reservationForm').onsubmit(e);assert.equal($('reservationDialog').open,false,$('formError').textContent);return Object.keys(app.state.reservations).at(-1);}
(async()=>{
 // Accueil public : uniquement le code PIN ; les commandes Firebase sont dans les options discrètes.
 assert.equal($('accessForm').querySelectorAll('[required]').length,1);
 assert.equal($('accessForm').querySelector('input[required]').id,'accessCode');
 assert.equal($('accessOptions').open,false);
 assert.ok($('requestAccessForm').closest('#pairingPanel'));
 assert.equal($('requestAccessForm').hidden,true);
 $('demoButton').click();assert.equal($('statTotal').textContent,'0');assert.equal(app.allGuests().length,0);
 const a=await create('Famille Test',['Alice Test','Bob Test'],'pending','Antonin Bassut');
 assert.equal(app.state.reservations[a].contactedOrganizer,'Antonin Bassut');
 assert.match($('guestList').textContent,/Contacté : Antonin Bassut/);
 $('search').value='Antonin Bassut';$('search').oninput();assert.match($('guestList').textContent,/Famille Test/);$('search').value='';$('search').oninput();
 assert.equal($('statTotal').textContent,'0');await app.setStatus(a,'accepted');assert.equal($('statTotal').textContent,'2');
 app.choose({rid:a});app.showPlacement('t1-1');$('newCapacity').value=2;$('newCapacity').oninput();await $('placementForm').onsubmit(e);assert.equal($('placementDialog').open,false,$('placementError').textContent);assert.match($('popupSubtitle').textContent,/2 places occupées/);app.closeTablePopup();
 const ids=Object.keys(app.state.reservations[a].participants);await app.setFlag(a,ids[0],'arrived');assert.equal($('statPaid').textContent,'1');assert.equal($('statArrived').textContent,'1');await assert.rejects(()=>app.setFlag(a,ids[0],'paid'),/personne arrivée/);await app.setFlag(a,ids[1],'paid');assert.equal($('statPaid').textContent,'2');assert.equal(app.state.reservations[a].participants[ids[1]].arrived,false);
 const b=await create('<img src=x onerror=alert(1)>',['Charlie Test'],'accepted','Antonin Blanckaert');assert.equal($('guestList').querySelectorAll('img').length,0);
 app.choose({rid:b,pid:Object.keys(app.state.reservations[b].participants)[0]});app.showPlacement('t1-1');await $('placementForm').onsubmit(e);assert.match($('placementError').textContent,/plus d’assez de places/);
 $('placementTable').value='t1-2';$('placementTable').onchange();$('newCapacity').value=3;$('newCapacity').oninput();await $('placementForm').onsubmit(e);assert.equal($('placementDialog').open,false,$('placementError').textContent);app.closeTablePopup();
 app.choose({rid:a});app.showPlacement('t1-2');await $('placementForm').onsubmit(e);assert.match($('popupSubtitle').textContent,/3 places occupées/);assert.match($('occ-t1-1').textContent,/0 \/ 2 places/);app.closeTablePopup();
 app.editReservation(a);assert.equal($('contactedOrganizer').value,'Antonin Bassut');$('participantRows').querySelector('input').value='Alice Corrigée';await $('reservationForm').onsubmit(e);assert.equal($('statPaid').textContent,'2');assert.equal($('statArrived').textContent,'1');assert.equal(app.state.reservations[a].participants[ids[0]].tableId,'t1-2');assert.equal(app.state.reservations[a].contactedOrganizer,'Antonin Bassut');
 app.editReservation(a);app.state.reservations[a].version++;await $('reservationForm').onsubmit(e);assert.match($('formError').textContent,/autre organisateur/);$('reservationDialog').close();
 app.clearSelection();app.openTablePopup('t1-2');$('tableCapacity').value=1;await $('capacityForm').onsubmit(e);assert.match($('notice').textContent,/Déplacez d’abord/);app.closeTablePopup();
 await app.setStatus(a,'cancelled');assert.equal($('statTotal').textContent,'1');assert.match($('occ-t1-2').textContent,/1 \/ 3 places/);assert.equal(app.state.reservations[a].participants[ids[0]].paid,true);
 const broken=JSON.parse(JSON.stringify(app.state));broken.reservations[a].status='accepted';broken.reservations[a].participants[ids[0]].tableId='t1-2';broken.reservations[a].participants[ids[0]].seat=1;assert.throws(()=>app.validateData(broken),/déjà occupée/);
 await app.setStatus(a,'accepted');app.choose({rid:a,pid:ids[0]});app.showPlacement('t1-1');await $('placementForm').onsubmit(e);assert.equal($('placementDialog').open,false);app.closeTablePopup();app.choose({rid:a,pid:ids[0]});app.showPlacement('t1-1');$('placementTable').value='';$('placementTable').onchange();await $('placementForm').onsubmit(e);assert.equal(app.state.reservations[a].participants[ids[0]].tableId,'');
 // L'accès par code pilote les écrans du mode démonstration, sans constituer une authentification serveur.
$('logoutButton').click();$('accessCode').value='0722';await $('accessForm').onsubmit(e);
assert.ok($('laneChoice'));assert.equal($('newReservation').style.display,'none');
$('laneChoice').querySelector('[data-lane="left"]').click();assert.match($('sessionBadge').textContent,/File Gauche/);
$('logoutButton').click();$('accessCode').value='7890';await $('accessForm').onsubmit(e);
assert.equal($('newReservation').style.display,'');assert.equal($('exportButton').style.display,'none');
console.log('PASS: contacté enregistré et conservé, réservations, placement, arrivée = payé, paiement anticipé, accès et file.');dom.window.close();
})().catch(e=>{console.error(e);process.exit(1)});
