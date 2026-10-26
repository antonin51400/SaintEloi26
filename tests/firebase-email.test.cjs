const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const w=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{url:'https://antonin51400.github.io',runScripts:'outside-only'}).window;
const $=id=>w.document.getElementById(id);
w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.confirm=()=>true;
const calls={login:[],sent:[],profiles:{}};
const auth={
  setPersistence:async()=>{},
  signInWithEmailAndPassword:async(email,password)=>{
    calls.login.push({email,password});
    const uid=email==='ancien@example.fr'?'nCNc0JdWznOZ6j4B4GjfvQqWX4K2':email==='entree@example.fr'?'entreeUID01':email==='lecture@example.fr'?'lectureUID01':email==='place@example.fr'?'placeUID01':'nouveau123';
    return {user:{uid,email}};
  },
  sendPasswordResetEmail:async email=>calls.sent.push(email),
  signOut:async()=>{}
};
const authFn=()=>auth;
authFn.Auth={Persistence:{SESSION:'session'}};
const makeRef=key=>({
  child:name=>makeRef(key+'/'+name),
  once:async()=>({val:()=>calls.profiles[key]}),
  set:async record=>{calls.profiles[key]={...record};},
  transaction:async update=>{const record=update(calls.profiles[key]||null);if(record===undefined)return {committed:false};calls.profiles[key]={...record};return {committed:true,snapshot:{val:()=>record}};},
  on:(name,callback)=>{
    if(key==='.info/connected')callback({val:()=>true});
    else if(key.endsWith('/data'))callback({val:()=>({reservations:{},tables:{}})});
  },
  off:()=>{}
});
const databaseFn=()=>({ref:makeRef});
databaseFn.ServerValue={TIMESTAMP:123456789};
w.firebase={apps:[{}],auth:authFn,database:databaseFn};
w.eval(fs.readFileSync(path.join(__dirname,'../config.js'),'utf8'));
w.eval(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8')+
'\nwindow.inspectEmail={get operator(){return operator;},get role(){return role;},canPlace(){return allowed("place");},guestCard(){return guestCard("reservation-1","guest-1",{name:"Invité Test",tableId:"",seat:0,arrived:false,paid:false},{status:"accepted",reservedBy:"Réservant Test"});}};');
async function login(email,password){
  $('emailAddress').value=email;
  $('emailPassword').value=password;
  await $('emailAccessForm').onsubmit({preventDefault(){}});
}
async function nameProfile(first,last){
  $('firstName').value=first;
  $('lastName').value=last;
  await $('firstLoginForm').onsubmit({preventDefault(){}});
}
(async()=>{
  assert.equal($('accessCode'),null,'PIN entry must not exist');
  assert.equal($('accessForm'),null,'PIN form must not exist');
  assert.equal($('usePinButton'),null,'PIN toggle must not exist');
  assert.equal($('emailAccessForm').hidden,false);
  assert.equal($('firstAccessForm').hidden,true);
  $('showFirstAccess').click();
  assert.equal($('emailAccessForm').hidden,true);
  assert.equal($('firstAccessForm').hidden,false);
  assert.equal($('firstAccessForm').querySelectorAll('input').length,1);
  $('firstAccessEmail').value='nouveau@example.fr';
  await $('firstAccessForm').onsubmit({preventDefault(){}});
  assert.deepEqual(calls.sent,['nouveau@example.fr']);
  assert.match($('loginMessage').textContent,/e-mail/);
  $('backToLogin').click();
  await login('nouveau@example.fr','secret long');
  assert.equal($('firstLoginDialog').open,true,'first connection asks for name');
  assert.equal($('appWrapper').style.display,'none');
  await nameProfile('Camille','Dupont');
  assert.equal(calls.profiles['events/saint-eloi-2026/profiles/nouveau123'].firstName,'Camille');
  assert.equal(w.inspectEmail.operator,'Camille Dupont');
  assert.equal(w.inspectEmail.role,'reservations');
  assert.equal(calls.profiles['events/saint-eloi-2026/members/nouveau123'].role,'reservations');
  assert.equal(w.inspectEmail.canPlace(),false,'reservations cannot place');
  assert.doesNotMatch(w.inspectEmail.guestCard(),/data-action="select"/,'no Placer button on reservations');
  assert.equal($('appWrapper').style.display,'flex');
  assert.notEqual($('newReservation').style.display,'none');
  assert.equal($('inviteUserButton').hidden,true);
  await $('logoutButton').onclick();
  assert.equal($('firstAccessForm').hidden,true);
  await login('nouveau@example.fr','secret long');
  assert.equal($('firstLoginDialog').open,false,'profile reused');
  assert.equal($('appWrapper').style.display,'flex');
  await $('logoutButton').onclick();
  await login('ancien@example.fr','ancien mot de passe');
  assert.equal($('firstLoginDialog').open,true,'legacy account also gets name form');
  await nameProfile('Antonin','Blanckaert');
  assert.equal($('inviteUserButton').hidden,false,'owner can send invite');
  assert.equal($('usersManagerButton').hidden,false,'admin sees user permissions manager');
  assert.equal($('adminDashboardButton').hidden,false,'admin sees private attendance dashboard');
  assert.equal(w.inspectEmail.canPlace(),true,'administrator can place');
  assert.match(w.inspectEmail.guestCard(),/data-action="select"/,'admin sees Placer');
  assert.equal($('adminViewControl').hidden,false,'admin has access to view selector');
  assert.equal($('adminRoleView').value,'admin');
  for(const view of ['reservations','placement','viewer']){
    $('adminRoleView').value=view;
    $('adminRoleView').onchange();
    assert.equal($('appWrapper').dataset.role,view);
    assert.equal(w.inspectEmail.role,'admin','true Firebase role is not changed');
    assert.equal($('adminViewControl').hidden,false,'admin selector remains available');
    assert.equal($('adminDashboardButton').hidden,true,'admin-only functions hidden in preview');
    assert.equal($('usersManagerButton').hidden,true,'user management hidden in preview');
    assert.equal($('adminPreviewNotice').hidden,false,'preview has visible warning');
  }
  $('adminRoleView').value='entry';
  $('adminRoleView').onchange();
  assert.equal($('appWrapper').dataset.role,'entry');
  assert.ok($('laneChoice'),'preview entry includes the lane chooser');
  assert.match($('laneChoice').textContent,/File 1/);
  assert.match($('laneChoice').textContent,/File 2/);
  $('laneChoice').querySelector('[data-lane="right"]').click();
  assert.match($('sessionBadge').textContent,/APERÇU/);
  $('adminRoleView').value='admin';
  $('adminRoleView').onchange();
  assert.equal($('appWrapper').dataset.role,'admin');
  assert.equal($('adminPreviewNotice').hidden,true);
  assert.equal($('adminDashboardButton').hidden,false);
  assert.equal($('usersManagerButton').hidden,false);

  $('adminDashboardButton').click();
  assert.equal($('adminDashboardDialog').open,true);
  assert.match($('adminKpis').textContent,/Invités attendus/);
  $('adminDashboardDialog').close();
  $('inviteUserButton').click();
  $('inviteEmail').value='autre@example.fr';
  await $('inviteUserForm').onsubmit({preventDefault(){}});
  assert.deepEqual(calls.sent,['nouveau@example.fr','autre@example.fr']);
  await $('logoutButton').onclick();
  $('emailAddress').value='nouveau@example.fr';
  $('forgotPasswordButton').click();
  assert.equal($('firstAccessForm').hidden,false);
  assert.equal($('firstAccessEmail').value,'nouveau@example.fr');
  await $('logoutButton').onclick();
  calls.profiles['events/saint-eloi-2026/profiles/entreeUID01']={firstName:'Agent',lastName:'Accueil'};
  calls.profiles['events/saint-eloi-2026/members/entreeUID01']={role:'entry',email:'entree@example.fr'};
  await login('entree@example.fr','secret entrée');
  assert.equal(w.inspectEmail.role,'entry');
  assert.equal(w.inspectEmail.canPlace(),false,'entry cannot place');
  assert.doesNotMatch(w.inspectEmail.guestCard(),/data-action="select"/,'entry has no placement action');
  assert.equal($('newReservation').style.display,'none');
  assert.equal($('adminDashboardButton').hidden,true);
  assert.equal($('usersManagerButton').hidden,true);
  assert.equal($('adminViewControl').hidden,true,'staff cannot access admin preview');
  assert.ok($('laneChoice'),'entry account selects an entrance lane');
  assert.match($('laneChoice').textContent,/File 1/);
  assert.match($('laneChoice').textContent,/File 2/);
  $('laneChoice').querySelector('[data-lane="left"]').click();
  assert.match($('sessionBadge').textContent,/File 1/);
  await $('logoutButton').onclick();
  calls.profiles['events/saint-eloi-2026/profiles/lectureUID01']={firstName:'Vue',lastName:'Consultation'};
  calls.profiles['events/saint-eloi-2026/members/lectureUID01']={role:'viewer',email:'lecture@example.fr'};
  await login('lecture@example.fr','secret lecture');
  assert.equal(w.inspectEmail.role,'viewer');
  assert.equal(w.inspectEmail.canPlace(),false,'viewer cannot place');
  assert.doesNotMatch(w.inspectEmail.guestCard(),/data-action="select"/,'view-only role has no placement action');
  assert.equal($('newReservation').style.display,'none');
  assert.equal($('adminDashboardButton').hidden,true);
  assert.equal($('usersManagerButton').hidden,true);
  assert.equal($('laneChoice'),null);
  await $('logoutButton').onclick();
  calls.profiles['events/saint-eloi-2026/profiles/placeUID01']={firstName:'Equipe',lastName:'Placement'};
  calls.profiles['events/saint-eloi-2026/members/placeUID01']={role:'placement',email:'place@example.fr'};
  await login('place@example.fr','secret placement');
  assert.equal(w.inspectEmail.role,'placement');
  assert.equal(w.inspectEmail.canPlace(),true,'placement accredited users can place');
  assert.match(w.inspectEmail.guestCard(),/data-action="select"/,'placement has Placer button');
  assert.equal($('newReservation').style.display,'none','placement cannot create reservations');
  w.close();
  console.log('PASS: email-only, first connection reset, named profile, legacy UID and invitations');
})().catch(err=>{console.error(err);process.exitCode=1;});
