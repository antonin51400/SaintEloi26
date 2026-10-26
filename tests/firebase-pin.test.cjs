const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
const w=new JSDOM(html,{url:'https://antonin51400.github.io',runScripts:'outside-only'}).window;
const $=id=>w.document.getElementById(id);
w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.confirm=()=>true;

const calls=[];
const auth={
  setPersistence:async mode=>calls.push({persistence:mode}),
  signInWithEmailAndPassword:async(email,pin)=>{
    calls.push({email,pin});
    return {user:{uid:'test-firebase-user',email}};
  },
  signOut:async()=>calls.push({signOut:true})
};
const authFn=()=>auth;
authFn.Auth={Persistence:{SESSION:'session'}};
const makeRef=loc=>({
  child:name=>makeRef(loc+'/'+name),
  on:(type,fn)=>{
    if(loc==='.info/connected')fn({val:()=>true});
    else if(loc.endsWith('/data'))fn({val:()=>({reservations:{},tables:{}})});
  },
  off:()=>{}
});
w.firebase={apps:[{}],auth:authFn,database:()=>({ref:makeRef})};
w.eval(fs.readFileSync(path.resolve(__dirname,'../config.js'),'utf8'));
w.SAINT_ELOI_CONFIG.enabled=true;
w.eval(fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'));

async function login(prefix){
  const pin=prefix+'8'.repeat(8); // PIN fictif uniquement pour le test.
  $('accessCode').value=pin;
  await $('accessForm').onsubmit({preventDefault(){}});
  assert.equal(calls.at(-1)?.email?.startsWith('access'),true);
  assert.equal(calls.at(-1).pin,pin);
  assert.equal($('appWrapper').style.display,'flex');
}
(async()=>{
  assert.equal($('pairDeviceButton'),null);
  assert.equal($('requestAccessForm'),null);
  $('accessCode').value='2002';
  await $('accessForm').onsubmit({preventDefault(){}});
  assert.match($('loginMessage').textContent,/12 chiffres/);
  assert.equal($('appWrapper').style.display,'none');
  await login('2002');
  assert.equal(calls.at(-1).email,'access2002@sainteloi26-371e3.firebaseapp.com');
  assert.notEqual($('newReservation').style.display,'none');
  await $('logoutButton').onclick();
  assert.equal($('appWrapper').style.display,'none');
  assert.ok(calls.some(x=>x.signOut));
  await login('0722');
  assert.equal(calls.at(-1).email,'access0722@sainteloi26-371e3.firebaseapp.com');
  assert.equal($('newReservation').style.display,'none');
  assert.ok($('laneChoice'));
  await $('logoutButton').onclick();
  await login('3186');
  assert.equal(calls.at(-1).email,'access3186@sainteloi26-371e3.firebaseapp.com');
  assert.notEqual($('newReservation').style.display,'none');
  await $('logoutButton').onclick();
  await login('4279');
  assert.equal(calls.at(-1).email,'access4279@sainteloi26-371e3.firebaseapp.com');
  assert.notEqual($('newReservation').style.display,'none');
  w.close();
  console.log('PASS: Connexion code seul via Firebase masqué, rôles serveur et déconnexion.');
})().catch(error=>{console.error(error);process.exitCode=1;});
