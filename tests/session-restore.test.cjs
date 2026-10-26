const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8'),source=fs.readFileSync('app.js','utf8');
const shared={account:null,logins:0,records:{},persistence:[]};
const windows=[];
const account={uid:'entry-user',email:'entree@example.fr'};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function loadPage({savedLane='',blockedRead=null}={}){
 const w=new JSDOM(html,{url:'https://antonin51400.github.io',runScripts:'outside-only'}).window;
 windows.push(w);
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.confirm=()=>true;
 if(savedLane)w.sessionStorage.setItem('saint-eloi-entry-lane:'+account.uid,savedLane);
 let observer;
 const auth={
  setPersistence:async mode=>shared.persistence.push(mode),
  onAuthStateChanged:fn=>{observer=fn;queueMicrotask(()=>fn(shared.account));return ()=>{};},
  signInWithEmailAndPassword:async()=>{shared.logins++;shared.account=account;queueMicrotask(()=>observer(account));return {user:account};},
  signOut:async()=>{shared.account=null;queueMicrotask(()=>observer(null));}
 };
 const ref=key=>({
  child:name=>ref(key+'/'+name),off(){},
  once:async()=>{if(blockedRead&&key.endsWith('/members/'+account.uid))await blockedRead;return {val:()=>shared.records[key]};},
  on:(event,callback)=>{
   if(key==='.info/connected')callback({val:()=>true});
   else if(key.endsWith('/data'))callback({val:()=>({reservations:{},tables:{}})});
   else callback({val:()=>shared.records[key]});
  }
 });
 const authFn=()=>auth;authFn.Auth={Persistence:{SESSION:'session'}};
 const dbFn=()=>({ref});dbFn.ServerValue={TIMESTAMP:123};
 w.firebase={apps:[{}],auth:authFn,database:dbFn};
 w.SAINT_ELOI_CONFIG={enabled:true,eventPath:'events/saint-eloi-2026',firebase:{databaseURL:'https://test.invalid'}};
 w.eval(source+'\nwindow.sessionTest={get user(){return user;},get role(){return role;},get lane(){return lane;}};');
 return {w,$:id=>w.document.getElementById(id),auth};
}
(async()=>{
 const member='events/saint-eloi-2026/members/'+account.uid,profile='events/saint-eloi-2026/profiles/'+account.uid;
 shared.records[member]={role:'entry',email:account.email};shared.records[profile]={firstName:'Agent',lastName:'Accueil'};
 let page=loadPage();await flush();
 assert.equal(page.w.sessionTest.user,null);assert.notEqual(page.$('appWrapper').style.display,'flex');
 page.$('emailAddress').value=account.email;page.$('emailPassword').value='password';
 await page.$('emailAccessForm').onsubmit({preventDefault(){}});
 assert.equal(shared.logins,1);assert.equal(page.$('appWrapper').style.display,'flex');
 page.w.document.querySelector('[data-lane="right"]').click();
 const savedLane=page.w.sessionStorage.getItem('saint-eloi-entry-lane:'+account.uid);page.w.close();
 // A fresh page restores Firebase's saved account without submitting credentials.
 page=loadPage({savedLane});await flush();
 assert.equal(shared.logins,1,'F5 must not sign in again');
 assert.equal(page.$('appWrapper').style.display,'flex');assert.equal(page.$('firstLoginDialog').open,false);
 assert.equal(page.w.sessionTest.role,'entry');assert.equal(page.w.sessionTest.lane,'right');
 assert.equal(page.$('laneChoice'),null);assert.match(page.$('sessionBadge').textContent,/File 2/);
 assert.ok(shared.persistence.every(mode=>mode==='session'));
 await page.$('logoutButton').onclick();assert.equal(shared.account,null);
 assert.equal(page.w.sessionStorage.getItem('saint-eloi-entry-lane:'+account.uid),null);page.w.close();
 page=loadPage();await flush();assert.equal(page.w.sessionTest.user,null);assert.notEqual(page.$('appWrapper').style.display,'flex');page.w.close();
 // A saved account must re-read current rights rather than trusting old UI state.
 shared.account=account;shared.records[member].role='disabled';page=loadPage();await flush();
 assert.match(page.$('loginMessage').textContent,/suspendu/);assert.equal(shared.account,null);assert.notEqual(page.$('appWrapper').style.display,'flex');page.w.close();
 shared.account=account;shared.records[member].role='entry';delete shared.records[profile];page=loadPage();await flush();
 assert.equal(page.$('firstLoginDialog').open,true);assert.notEqual(page.$('appWrapper').style.display,'flex');page.w.close();
 // Signing out while a delayed profile/rights read is pending must cancel restoration.
 shared.account=account;shared.records[profile]={firstName:'Agent',lastName:'Accueil'};
 let release;const blockedRead=new Promise(resolve=>release=resolve);page=loadPage({blockedRead});await flush();
 await page.$('logoutButton').onclick();release();await flush();
 assert.equal(page.w.sessionTest.user,null);assert.notEqual(page.$('appWrapper').style.display,'flex');page.w.close();
 shared.account=account;page=loadPage();await flush();await page.auth.signOut();await flush();
 assert.equal(page.w.sessionTest.user,null);assert.equal(page.$('appWrapper').style.display,'none');page.w.close();
 console.log('PASS: F5 restores session and lane without password, logout persists, suspended/missing profiles and delayed restoration handled');
})().catch(error=>{console.error(error);windows.forEach(w=>w.close());process.exitCode=1;});
