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
    const uid=email.startsWith('access2002@')?'nCNc0JdWznOZ6j4B4GjfvQqWX4K2':'newMember123';
    return {user:{uid,email}};
  },
  sendPasswordResetEmail:async email=>{calls.sent.push(email);},
  signOut:async()=>{}
};
const authFn=()=>auth;
authFn.Auth={Persistence:{SESSION:'session'}};
const makeRef=key=>({
  child:name=>makeRef(key+'/'+name),
  once:async()=>({val:()=>calls.profiles[key]}),
  set:async record=>{calls.profiles[key]={...record};},
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
w.SAINT_ELOI_CONFIG.enabled=true;
w.eval(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8')+
'\nwindow.inspectEmail={get operator(){return operator;},get role(){return role;}};');
(async()=>{
  assert.equal($('emailAccessForm').hidden,true);
  $('useEmailButton').click();
  assert.equal($('accessForm').hidden,true);
  assert.equal($('emailAccessForm').hidden,false);
  $('emailAddress').value='nouvelle.personne@example.fr';
  $('emailPassword').value='mot-de-passe-provisoire';
  await $('emailAccessForm').onsubmit({preventDefault(){}});
  assert.equal(calls.login.length,1);
  assert.equal($('firstLoginDialog').open,true,'first connection requires profile');
  assert.equal($('appWrapper').style.display,'none','no reservation access before profile');
  $('firstName').value='Camille';
  $('lastName').value='Dupont';
  await $('firstLoginForm').onsubmit({preventDefault(){}});
  assert.equal(calls.profiles['events/saint-eloi-2026/profiles/newMember123'].firstName,'Camille');
  assert.equal(w.inspectEmail.operator,'Camille Dupont');
  assert.equal(w.inspectEmail.role,'organizer');
  assert.equal($('appWrapper').style.display,'flex');
  assert.notEqual($('newReservation').style.display,'none');
  assert.equal($('inviteUserButton').hidden,true,'new members cannot use organizer invite panel');
  await $('logoutButton').onclick();
  await $('emailAccessForm').onsubmit({preventDefault(){}});
  assert.equal($('firstLoginDialog').open,false,'second login reuses existing profile');
  assert.equal($('appWrapper').style.display,'flex');
  await $('logoutButton').onclick();
  $('emailAddress').value='camille@example.fr';
  await $('forgotPasswordButton').onclick();
  assert.deepEqual(calls.sent,['camille@example.fr']);
  $('usePinButton').click();
  $('accessCode').value='2002'+'8'.repeat(8);
  await $('accessForm').onsubmit({preventDefault(){}});
  assert.equal($('inviteUserButton').hidden,false);
  $('inviteUserButton').click();
  assert.equal($('inviteUserDialog').open,true);
  $('inviteEmail').value='autre@example.fr';
  await $('inviteUserForm').onsubmit({preventDefault(){}});
  assert.deepEqual(calls.sent,['camille@example.fr','autre@example.fr']);
  w.close();
  console.log('PASS: Email, first profile, reuse, reset email and admin invitation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
