'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const uid = () => crypto.randomUUID().replaceAll('-','');
const clone = data => JSON.parse(JSON.stringify(data));
const EVENT_START=Date.parse('2026-12-05T20:00:00+01:00');
function updateCountdown(now=Date.now()){
 const seconds=Math.max(0,Math.floor((EVENT_START-now)/1000));
 const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);
 for(const [unit,value] of Object.entries({Days:days,Hours:hours,Minutes:minutes,Seconds:seconds%60})){
  $('countdown'+unit).textContent=String(value).padStart(2,'0');
 }
 $('eventCountdown').setAttribute('aria-label',days+' jours, '+hours+' heures, '+minutes+' minutes et '+seconds%60+' secondes');
 $('countdownFinished').hidden=seconds>0;
}
updateCountdown();setInterval(updateCountdown,1000);
const displayTime=value=>{const date=new Date(value);return value&&!Number.isNaN(date.getTime())?new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(date):'';};
function guestTracking(p){
 const arrival=p.arrived?'<div class="arrival-detail">Entrée '+esc(displayTime(p.arrivedAt)||'heure non renseignée')+' · '+esc(p.arrivalLane==='left'?'File 1':p.arrivalLane==='right'?'File 2':'file non renseignée')+'</div>':'';
 const payment=p.paid&&p.paidForBy?'<div class="payment-alert"><strong>À signaler : payé par '+esc(p.paidForBy)+'</strong><div>Paiement : '+esc(displayTime(p.paidAt)||'heure non renseignée')+'</div><div>Commentaire du '+esc(displayTime(p.paymentRecordedAt||p.paidAt))+(p.paymentComment?' · '+esc(p.paymentComment):'')+'</div></div>':'';
 return arrival+payment;
}
const statuses = {pending:'À valider',accepted:'Acceptée',cancelled:'Annulée'};
let tableElements = [...document.querySelectorAll('.table-block')];
let tableNames = Object.fromEntries(tableElements.map(el => [el.id, el.dataset.table]));
let state = {reservations:{},tables:{}};
let user = null, operator = '', role = 'none', lane = '', demo = false, online = false, ready = false, busy = false, loginBusy = false;
let sessionGeneration=0;
const laneKey=id=>'saint-eloi-entry-lane:'+id;
function forgetEntryLane(){try{if(user)sessionStorage.removeItem(laneKey(user.uid));}catch{}}
let db = null, auth = null, eventRef = null, dataRef = null, memberRef = null, pendingRequestRef = null;
let filter = 'all', editing = null, editVersion = 0, selection = null, popupTable = null;
const ROOT_ADMIN_UIDS=['nCNc0JdWznOZ6j4B4GjfvQqWX4K2','KpFkapZExKcToBcy52YCo6rdwuh2'];
const ROLE_LABELS={admin:'Administrateur',reservations:'Réservations',placement:'Placement',entry:'Entrées',viewer:'Consultation',disabled:'Suspendu'};
const VIEW_ROLES=['reservations','placement','entry','viewer'];
const permissions={
 admin:['layout','reserve','place','arrival','payment','export','users','dashboard'],
 reservations:['reserve','export'],placement:['place'],entry:['arrival','payment'],viewer:[],disabled:[]
};
let grantedRoles=[],activeView='none';
const rootAdmin=()=>!!user&&ROOT_ADMIN_UIDS.includes(user.uid);
function normalizeRoles(member){
 if(rootAdmin())return ['admin'];
 if(!member||member.role==='disabled')return [];
 const raw=member.roles&&typeof member.roles==='object'
 ?Object.keys(member.roles).filter(key=>member.roles[key]===true)
 :ROLE_LABELS[member.role]?[member.role]:[];
 return [...new Set(raw)].filter(key=>key!=='disabled'&&Object.prototype.hasOwnProperty.call(permissions,key));
}
const hasRole=key=>grantedRoles.includes('admin')||grantedRoles.includes(key);
const availableViews=()=>hasRole('admin')?['admin',...VIEW_ROLES]:VIEW_ROLES.filter(v=>grantedRoles.includes(v));
const shownRole=()=>availableViews().includes(activeView)?activeView:(availableViews()[0]||'none');
const allowed=permission=>availableViews().includes(shownRole())&&!!permissions[shownRole()]?.includes(permission);
function requireAccess(permission){
 if(!allowed(permission))throw Error('Cette accréditation ne permet pas cette opération.');
}
function adoptMembership(member){
 const next=normalizeRoles(member);
 if(!next.length)throw Error('Aucun accès actif : contacte un administrateur.');
 grantedRoles=next;role=hasRole('admin')?'admin':grantedRoles[0];
 if(!availableViews().includes(activeView))activeView=availableViews()[0];
}
function selectEntryLane() {
  document.getElementById('laneChoice')?.remove();
  if (shownRole() !== 'entry') return;
  const panel = document.createElement('section');
  panel.id='laneChoice'; panel.className='lane-modal';
  panel.innerHTML='<h2>Quel poste occupez-vous ?</h2><div class="lane-buttons"><button type="button" class="lane-btn left" data-lane="left"><span class="lane-icon">◀️</span>File 1<span class="lane-sub">Poste 1</span></button><button type="button" class="lane-btn right" data-lane="right"><span class="lane-icon">▶️</span>File 2<span class="lane-sub">Poste 2</span></button></div>';
  panel.querySelectorAll('[data-lane]').forEach(btn => btn.onclick=()=>{
    lane=btn.dataset.lane;
    if(!demo&&user)try{sessionStorage.setItem(laneKey(user.uid),lane);}catch{}
    $('sessionBadge').textContent=lane==='left'?'◀ File 1':'▶ File 2';
    $('sessionBadge').className='lane-badge '+lane;
    panel.remove();
  });
  document.body.appendChild(panel);
}
function notice(message) { $('notice').textContent = message; }
function allGuests(data = state) {
  return Object.entries(data.reservations || {}).flatMap(([rid,r]) => Object.entries(r.participants || {}).map(([pid,p]) => ({...p,rid,pid,reservedBy:r.reservedBy,status:r.status})));
}
function accepted(data = state) { return allGuests(data).filter(p => p.status === 'accepted'); }
const DEFAULT_TABLE_CAPACITY=6;
function capacity(tableId,data=state){ return layoutFor(data).tables[tableId] ? Number(data.tables?.[tableId]?.capacity??DEFAULT_TABLE_CAPACITY) : 0; }
function membersFor(sel, data = state) {
  const r = data.reservations?.[sel.rid];
  if (!r || r.status !== 'accepted') throw Error('Acceptez d’abord cette réservation pour placer ses invités.');
  const ids = sel.pid ? [sel.pid] : Object.keys(r.participants || {});
  if (!ids.length || ids.some(id => !r.participants[id])) throw Error('Cette sélection a changé. Sélectionnez à nouveau les invités.');
  return ids.map(pid => ({rid:sel.rid,pid,...r.participants[pid]}));
}
function freeSeats(tableId, sel, data = state) {
  const selected = sel ? new Set(membersFor(sel,data).map(p=>p.rid+'/'+p.pid)) : new Set();
  const used = new Set(accepted(data).filter(p=>p.tableId===tableId&&!selected.has(p.rid+'/'+p.pid)).map(p=>p.seat));
  return Array.from({length:capacity(tableId,data)},(_,i)=>i+1).filter(n=>!used.has(n));
}
let tableCapacitySyncRunning=false;
async function ensureTableCapacities(){
 if(!ready||!online||demo||!hasRole('admin')||shownRole()!=='admin'||!dataRef||tableCapacitySyncRunning)return;
 if(Object.keys(layoutFor(state).tables).every(id=>state.tables?.[id]?.capacity))return;
 tableCapacitySyncRunning=true;
 try{await dataRef.transaction(current=>{
  if(!current)return;
  current.tables ||= {};
  for(const id of Object.keys(layoutFor(current).tables))if(!current.tables[id])current.tables[id]={capacity:DEFAULT_TABLE_CAPACITY};
  return current;
 },undefined,false);}catch(error){notice('Capacités non synchronisées : '+error.message);}
 finally{tableCapacitySyncRunning=false;}
}
function tableMetrics(id, guests=accepted()){
 const list=guests.filter(p=>p.tableId===id);
 const total=list.length,arrived=list.filter(p=>p.arrived).length,cap=capacity(id);
 return {
  tableId:id,name:tableNames[id],people:list,total,arrived,
  capacity:cap,free:Math.max(0,cap-total),
  occupancy:total>cap?'overflow':total===0?'empty':total===cap?'full':'partial',
  arrival:total===0?'empty':arrived===0?'waiting':arrived===total?'complete':'partial'
 };
}
function renderEntryTables(guests){
 const rows=tableElements.map(el=>tableMetrics(el.id,guests));
 const fullyBooked=rows.filter(t=>t.occupancy==='full').length;
 const fullyArrived=rows.filter(t=>t.arrival==='complete').length;
 $('entryTablesTotals').innerHTML='<span>'+rows.length+' tables · '+rows.reduce((sum,t)=>sum+t.capacity,0)+' places</span><span>'+fullyBooked+' complètes</span><span>'+fullyArrived+' avec tous les invités arrivés</span>';
 $('entryTablesGrid').innerHTML=rows.map(t=>{
  const seats=Array.from({length:t.capacity},(_,index)=>{
   const p=t.people.find(person=>person.seat===index+1);
   return '<span class="entry-seat'+(p?(p.arrived?' seat-arrived':' seat-expected'):'')+'" title="'+(p?esc(p.name+(p.arrived?' · arrivé':' · attendu')):'Place libre')+'" aria-label="'+(p?esc('Place '+(index+1)+' : '+p.name+(p.arrived?', arrivé':', attendu')):'Place '+(index+1)+' libre')+'"></span>';
  }).join('');
  const label=t.arrival==='complete'?'Tous arrivés':t.arrival==='partial'?'Arrivées en cours':t.arrival==='waiting'?'En attente':'Aucun invité';
  const excess=t.total>t.capacity?'<div class="entry-card-note">⚠ Surcapacité : placement à corriger</div>':'';
  return '<article class="entry-table-card status-'+t.occupancy+'"><div class="entry-card-heading"><strong>'+esc(t.name)+'</strong><small>'+t.total+'/'+t.capacity+' places</small></div><div class="entry-seats" aria-label="Places : bleu attendu, vert arrivé, gris libre">'+seats+'</div><div class="arrival-status arrival-'+t.arrival+'">'+t.arrived+'/'+t.total+' arrivés · '+label+'</div><div class="entry-card-note">'+t.free+' place'+(t.free>1?'s':'')+' libre'+(t.free>1?'s':'')+'</div>'+excess+'</article>';
 }).join('');
}
function validateData(data) {
  validatePlan(layoutFor(data));
  for(const id of Object.keys(layoutFor(data).tables)){const cap=capacity(id,data);if(!Number.isInteger(cap)||cap<1||cap>50)throw Error('Capacité invalide : 1 à 50 personnes.');}
  const seen = new Set();
  for (const p of accepted(data)) {
    if (!p.tableId) continue;
    if (!layoutFor(data).tables[p.tableId] || !Number.isInteger(p.seat) || p.seat<1 || p.seat>capacity(p.tableId,data)) throw Error('Placement invalide : vérifiez la capacité de la table.');
    const key=p.tableId+'/'+p.seat;
    if (seen.has(key)) throw Error('Cette place est déjà occupée. Choisissez une autre place.');
    seen.add(key);
  }
}
function updated(r) { r.version=(r.version||0)+1; r.updatedBy=operator; r.updatedAt=new Date().toISOString(); }
async function mutate(change) {
  if (busy) throw Error('Un enregistrement est déjà en cours.');
  if (!demo && !hasRole('admin') && !['reservations','placement'].includes(shownRole())) throw Error('Cette opération nécessite un accès d’écriture autorisé.');
  if (!ready || !user || (!demo&&!online)) throw Error('Connexion indisponible : aucune modification enregistrée.');
  busy=true; document.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=true);
  try {
    if(demo){
      const next=clone(state);change(next);validateData(next);state=next;render();
    }else if(hasRole('admin')){
      // Opération globale atomique : seuls les administrateurs peuvent écrire à la racine data.
      let conflict='';
      const result=await dataRef.transaction(current=>{
        try{
          const next=current||{reservations:{},tables:{}};
          next.reservations ||= {};next.tables ||= {};
          change(next);validateData(next);conflict='';return next;
        }catch(error){conflict=error.message;return;}
      },undefined,false);
      if(!result.committed)throw Error(conflict||'Enregistrement non effectué.');
    }else{
      // Droits limités : transaction sur UNE réservation pour que Firebase
      // vérifie la modification et non l'ensemble de la base.
      const draft=clone(state);change(draft);validateData(draft);
      if(JSON.stringify(draft.tables||{})!==JSON.stringify(state.tables||{}))
        throw Error('La capacité des tables est réservée aux administrateurs.');
      const ids=new Set([...Object.keys(state.reservations||{}),...Object.keys(draft.reservations||{})]);
      const changed=[...ids].filter(id=>JSON.stringify(state.reservations?.[id])!==JSON.stringify(draft.reservations?.[id]));
      if(changed.length!==1)throw Error('Une seule réservation peut être modifiée à la fois avec ce rôle.');
      const reservationId=changed[0];
      let conflict='';
      const result=await dataRef.child('reservations').child(reservationId).transaction(current=>{
        try{
          const live=clone(state);
          live.reservations ||= {};
          if(current)live.reservations[reservationId]=current;
          else delete live.reservations[reservationId];
          change(live);validateData(live);conflict='';
          return live.reservations[reservationId]||null;
        }catch(error){conflict=error.message;return;}
      },undefined,false);
      if(!result.committed)throw Error(conflict||'Modification refusée par les droits Firebase.');
    }
    notice(demo?'Modification effectuée en démonstration — non sauvegardée.':'Modification enregistrée et partagée.');
  } finally {busy=false;document.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=false);}
}
function showApp(){
 $('loginPanel').style.display='none';$('appWrapper').style.display='flex';
 const view=shownRole(),views=availableViews();
 $('appWrapper').dataset.role=view;
 $('sessionBadge').textContent=view==='admin'?'★ ADMIN · '+operator:
   view==='entry'&&lane?(lane==='left'?'◀ File 1':'▶ File 2'):operator;
 $('sessionBadge').className='lane-badge'+(lane&&view==='entry'?' '+lane:'');
 $('editPlanButton').hidden=!allowed('layout');
 $('newReservation').style.display=allowed('reserve')?'':'none';
 $('exportButton').hidden=!allowed('export');
 $('inviteUserButton').hidden=demo||!allowed('users');
 $('usersManagerButton').hidden=demo||!allowed('users');
 $('adminDashboardButton').hidden=demo||!allowed('dashboard');
 $('adminViewControl').hidden=views.length<2;
 $('adminRoleView').innerHTML=views.map(v=>'<option value="'+v+'">'+(v==='admin'?'★ ':'')+ROLE_LABELS[v]+'</option>').join('');
 $('adminRoleView').value=view;
 $('adminPreviewNotice').hidden=view==='admin'||views.length<2;
 $('adminPreviewNotice').textContent=view==='admin'?'':'Espace '+ROLE_LABELS[view]+' actif : modifications enregistrées et synchronisées.';
 $('sessionBadge').title=ROLE_LABELS[view]||view;
 $('sessionBadge').onclick=()=>{if(view==='entry')selectEntryLane();};
 render();if(view==='entry'&&!lane)selectEntryLane();
}
$('adminRoleView').onchange=()=>{
 const target=$('adminRoleView').value;
 if(!availableViews().includes(target)){$('adminRoleView').value=shownRole();return;}
 activeView=target;selection=null;
 document.getElementById('laneChoice')?.remove();
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());
 closeTablePopup();showApp();
};
function stopListeners(){
  if(dataRef)dataRef.off();
  if(db)db.ref('.info/connected').off();
  if(memberRef)memberRef.off();
  if(adminMembersRef){adminMembersRef.off();adminMembersRef=null;}
  $('memberList').replaceChildren();
  dataRef=null;memberRef=null;pendingRequestRef=null;ready=false;online=false;
}
function lock(message){
  stopListeners();state={reservations:{},tables:{}};selection=null;popupTable=null;
  document.getElementById('laneChoice')?.remove();
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  closeTablePopup();
  $('appWrapper').style.display='none';$('loginPanel').style.display='flex';
  $('loginMessage').textContent=message;render();
}
const config=window.SAINT_ELOI_CONFIG||{};
$('loginMessage').textContent=config.enabled
  ? 'Identifie-toi avec ton e-mail, ou active ton compte lors de ta première connexion.'
  : 'Le mode démonstration ne sauvegarde pas les réservations.';
const PRIMARY_ADMIN_UID='nCNc0JdWznOZ6j4B4GjfvQqWX4K2';
const GLOBAL_ADMIN_UID='KpFkapZExKcToBcy52YCo6rdwuh2';
function initFirebaseAuth(){
  if(!window.firebase||!config.firebase?.databaseURL)throw Error('Firebase non disponible.');
  if(!firebase.apps.length)firebase.initializeApp(config.firebase);
  auth=firebase.auth();
  db=firebase.database();
  auth.languageCode='fr';
}
function connectLiveData(){
  if(!eventRef||!user)throw Error('Compte Firebase absent.');
  dataRef=eventRef.child('data');
  if(!demo&&memberRef){
   memberRef.on('value',snap=>{
    try{
     const before=shownRole();adoptMembership(snap.val());
     if(before!==shownRole())lane='';
     if(ready)showApp();
    }catch(error){lock('Accès retiré ou suspendu.');if(auth)auth.signOut().catch(()=>{});}
   },()=>lock('Impossible de vérifier les droits de ce compte.'));
  }
  $('loginMessage').textContent='Connexion acceptée. Chargement des réservations…';
  dataRef.on('value',snapshot=>{
    state=snapshot.val()||{reservations:{},tables:{}};
    ready=true;showApp();
    void ensureTableCapacities();
  },()=>{
    lock('Accès aux réservations refusé : vérifie que les nouvelles règles Firebase sont publiées et que les inscriptions libres sont désactivées.');
  });
  db.ref('.info/connected').on('value',snapshot=>{
    online=snapshot.val()===true;
    if(ready)render();
    if(online)void ensureTableCapacities();
  });
}
// La connexion se fait exclusivement par e-mail/mot de passe Firebase.
// Aucun code à 4 ou 12 chiffres n'est publié, saisi ou conservé côté client.
function showFirstAccess(prefill=''){
  $('emailAccessForm').hidden=true;
  $('firstAccessForm').hidden=false;
  $('showFirstAccess').hidden=true;
  $('firstAccessEmail').value=prefill;
  $('loginMessage').textContent='';
  $('firstAccessEmail').focus();
}
function showEmailLogin(){
  $('firstAccessForm').hidden=true;
  $('emailAccessForm').hidden=false;
  $('showFirstAccess').hidden=false;
  $('loginMessage').textContent='';
  $('emailAddress').focus();
}
$('showFirstAccess').onclick=()=>showFirstAccess($('emailAddress').value.trim());
$('backToLogin').onclick=showEmailLogin;
async function ensureDefaultMembership(){
 if(rootAdmin()||demo)return;
 const member=(await memberRef.once('value')).val();
 if(!member||!normalizeRoles(member).length)throw Error('Accès non attribué : contacte un administrateur.');
}
let pendingProfileRef=null;
$('firstLoginForm').onsubmit=async e=>{
  e.preventDefault();
  if(loginBusy||!pendingProfileRef||!user)return;
  const firstName=$('firstName').value.trim().replace(/\s+/g,' ');
  const lastName=$('lastName').value.trim().replace(/\s+/g,' ');
  if(firstName.length<2||lastName.length<2||firstName.length>80||lastName.length>80){
    $('firstLoginError').textContent='Indique un prénom et un nom de 2 à 80 caractères.';
    return;
  }
  $('saveProfileButton').disabled=true;
  try{
    const firstProfile={
      firstName,lastName,
      createdAt:firebase.database.ServerValue.TIMESTAMP
    };
    await pendingProfileRef.set(firstProfile);
    await ensureDefaultMembership();
    operator=firstName+' '+lastName;
    pendingProfileRef=null;
    $('firstLoginDialog').close();
    connectLiveData();
  }catch(error){
    $('firstLoginError').textContent='Enregistrement du profil refusé : '+(error?.message||'contacte l’organisateur.');
  }finally{
    $('saveProfileButton').disabled=false;
  }
};
async function startEmailSession(email,password,restoredAccount=null){
  if(loginBusy)return;
  if(!config.enabled){
    $('loginMessage').textContent='La connexion e-mail nécessite la synchronisation Firebase.';
    return;
  }
  loginBusy=true;$('emailLoginButton').disabled=true;
  const attempt=++sessionGeneration;
  const checkAttempt=()=>{if(attempt!==sessionGeneration)throw Error('Connexion interrompue.');};
  stopListeners();
  role='none';grantedRoles=[];activeView='none';operator='';lane='';ready=false;demo=false;
  try{
    initFirebaseAuth();
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    checkAttempt();
    const account=restoredAccount||(await auth.signInWithEmailAndPassword(email,password)).user;
    checkAttempt();
    if(!account||account.email?.trim().toLowerCase()!==email)throw Error('Identifiants non reconnus.');
    user=account;eventRef=db.ref(config.eventPath);
    memberRef=eventRef.child('members').child(account.uid);
    const membership=(await memberRef.once('value')).val();
    checkAttempt();
    adoptMembership(membership);
    if(hasRole('entry'))try{const savedLane=sessionStorage.getItem(laneKey(account.uid));if(['left','right'].includes(savedLane))lane=savedLane;}catch{}
    $('loginMessage').textContent='Bienvenue ! Vérification du profil…';
    const ownProfile=eventRef.child('profiles').child(account.uid);
    const saved=(await ownProfile.once('value')).val();
    checkAttempt();
    if(saved&&typeof saved.firstName==='string'&&typeof saved.lastName==='string'){
      operator=saved.firstName+' '+saved.lastName;
      await ensureDefaultMembership();
      checkAttempt();
      connectLiveData();
      return;
    }
    pendingProfileRef=ownProfile;
    $('firstLoginError').textContent='';
    $('firstLoginForm').reset();
    $('firstLoginDialog').showModal();
    $('firstName').focus();
  }catch(error){
    if(attempt!==sessionGeneration)return;
    pendingProfileRef=null;
    const err=String(error?.code||'');
    $('loginMessage').textContent=err.startsWith('auth/invalid')||err==='auth/wrong-password'||err==='auth/user-not-found'
      ? 'Adresse e-mail ou mot de passe incorrect.'
      : 'Connexion impossible : '+(error?.message||'vérifie les règles Firebase.');
    role='none';grantedRoles=[];activeView='none';operator='';user=null;
    if(auth)try{await auth.signOut();}catch(_){}
  }finally{
    loginBusy=false;$('emailLoginButton').disabled=false;
  }
}
$('emailAccessForm').onsubmit=async e=>{
  e.preventDefault();
  const email=$('emailAddress').value.trim().toLowerCase();
  const password=$('emailPassword').value;
  if(!email||!password)return;
  $('emailPassword').value='';
  await startEmailSession(email,password);
};
async function sendResetEmail(email){
  if(!config.enabled)throw Error('Connexion Firebase indisponible.');
  initFirebaseAuth();
  await auth.sendPasswordResetEmail(email);
}
$('forgotPasswordButton').onclick=()=>{
  const email=$('emailAddress').value.trim().toLowerCase();
  showFirstAccess(email);
};
$('firstAccessForm').onsubmit=async e=>{
  e.preventDefault();
  const email=$('firstAccessEmail').value.trim().toLowerCase();
  if(!email||!$('firstAccessEmail').checkValidity()){
    $('loginMessage').textContent='Renseigne une adresse e-mail valide.';
    return;
  }
  $('firstAccessSendButton').disabled=true;
  try{
    await sendResetEmail(email);
    $('loginMessage').textContent='Si ton compte existe, un e-mail vient d’être demandé pour choisir ton mot de passe. Vérifie aussi les spams.';
  }catch(error){
    const code=String(error?.code||'');
    $('loginMessage').textContent=code==='auth/too-many-requests'
      ? 'Trop de demandes : réessaie plus tard.'
      : 'Envoi impossible : '+(error?.message||'réessaie.');
  }finally{
    $('firstAccessSendButton').disabled=false;
  }
};
let adminMembersRef=null;
function selectedRoles(container){
 return [...document.querySelectorAll(container+' input[data-access-role]:checked')].map(el=>el.value);
}
function markRoles(container,roles){
 document.querySelectorAll(container+' input[data-access-role]').forEach(el=>el.checked=roles.includes(el.value));
}
function memberRoles(member){
 const assigned=member.roles&&typeof member.roles==='object'
  ?Object.keys(member.roles).filter(key=>member.roles[key]===true)
  :member.role?[member.role]:[];
 return [...new Set(assigned)].filter(x=>ROLE_LABELS[x]);
}
function renderMembers(snapshot){
 const members=snapshot.val()||{},rows=Object.entries(members);
 $('memberList').innerHTML=rows.length?rows.map(([id,m])=>
  '<div class="admin-member-row"><strong>'+esc(m.email||id)+'</strong><span>'+
   esc(memberRoles(m).map(x=>ROLE_LABELS[x]).join(' · ')||'Aucun accès')+
   '</span><button class="secondary" data-member-id="'+esc(id)+'">Modifier</button></div>').join('')
  :'<p class="muted">Aucun utilisateur accrédité. Ajoutez un compte dans Firebase puis attribuez ses droits.</p>';
 $('memberList').querySelectorAll('[data-member-id]').forEach(button=>button.onclick=()=>{
  const id=button.dataset.memberId,m=members[id];
  $('memberUid').value=id;$('memberEmail').value=m.email||'';
  markRoles('#memberForm',memberRoles(m));
 });
}
$('usersManagerButton').onclick=()=>{
 requireAccess('users');
 $('memberForm').reset();$('memberFeedback').textContent='';
 $('usersManagerDialog').showModal();
 if(adminMembersRef)adminMembersRef.off();
 adminMembersRef=eventRef.child('members');
 adminMembersRef.on('value',renderMembers,()=>{$('memberFeedback').textContent='Liste inaccessible. Vérifier les règles Firebase.';});
};
async function writeMembership(id,email,roles){
 requireAccess('users');
 if(!/^[A-Za-z0-9_-]{8,128}$/.test(id)||!email||!roles.length||
   roles.some(x=>!ROLE_LABELS[x]||x==='disabled'))
   throw Error('UID, adresse e-mail ou droits invalides.');
 if(roles.includes('admin')&&roles.length>1)throw Error('Administrateur inclut déjà toutes les vues. Cochez uniquement Administrateur.');
 if(ROOT_ADMIN_UIDS.includes(id)&&!roles.includes('admin'))throw Error('Le compte administrateur principal ne peut pas être rétrogradé.');
 const current=(await eventRef.child('members').child(id).once('value')).val();
 if(current?.email&&current.email!==email)throw Error('Cet UID est associé à un autre e-mail : vérifiez le compte Firebase.');
 await eventRef.child('members').child(id).set({
  email,role:roles.includes('admin')?'admin':roles[0],
  roles:Object.fromEntries(roles.map(x=>[x,true])),
  updatedBy:user.uid,updatedAt:firebase.database.ServerValue.TIMESTAMP
 });
}
$('memberForm').onsubmit=async e=>{
 e.preventDefault();
 try{
  await writeMembership($('memberUid').value.trim(),$('memberEmail').value.trim().toLowerCase(),selectedRoles('#memberForm'));
  $('memberFeedback').textContent='Droits enregistrés. Les vues disponibles se mettent à jour automatiquement.';
 }catch(error){$('memberFeedback').textContent=error.message;}
};
$('resetMemberPasswordButton').onclick=async()=>{
 requireAccess('users');
 const email=$('memberEmail').value.trim().toLowerCase();
 if(!email||!$('memberEmail').checkValidity()){$('memberFeedback').textContent='Indique une adresse e-mail valide.';return;}
 $('resetMemberPasswordButton').disabled=true;
 try{await sendResetEmail(email);$('memberFeedback').textContent='Lien de mot de passe demandé via Firebase.';}
 catch(error){$('memberFeedback').textContent=error?.message||'Envoi impossible';}
 finally{$('resetMemberPasswordButton').disabled=false;}
};
$('openFirebaseUsersButton').onclick=()=>window.open('https://console.firebase.google.com/project/sainteloi26-371e3/authentication/users','_blank','noopener');
$('inviteUserButton').onclick=()=>{
  if(demo||!allowed('users'))return;
  $('inviteUserForm').reset();
  $('inviteUserMessage').textContent='';
  $('inviteUserDialog').showModal();
};
$('createInviteAccountButton').onclick=()=>{requireAccess('users');window.open('https://console.firebase.google.com/project/sainteloi26-371e3/authentication/users','_blank','noopener');};
$('inviteUserForm').onsubmit=async e=>{
  e.preventDefault();
  if(demo||!allowed('users'))return;
  const email=$('inviteEmail').value.trim().toLowerCase(),inviteUid=$('inviteUid').value.trim(),inviteRoles=selectedRoles('#inviteUserForm');
  if(!$('inviteEmail').checkValidity())return;
  if(!$('inviteAccountCreated').checked){$('inviteUserMessage').textContent='Crée d’abord le compte dans Firebase, puis coche la confirmation.';return;}
  $('sendInviteButton').disabled=true;
  try{
    requireAccess('users');
    await writeMembership(inviteUid,email,inviteRoles);
    try{
      await sendResetEmail(email);
      $('inviteUserMessage').textContent='Accès attribués. Lien de création de mot de passe demandé : vérifie la boîte e-mail et les spams.';
    }catch(mailError){$('inviteUserMessage').textContent='Accès enregistrés, mais lien e-mail non envoyé : '+mailError.message;}
  }catch(error){
    $('inviteUserMessage').textContent='Envoi impossible : '+(error?.message||'réessaie.');
  }finally{$('sendInviteButton').disabled=false;}
};
$('demoButton').onclick=()=>{
  sessionGeneration++;forgetEntryLane();
  stopListeners();
  if(auth)auth.signOut().catch(()=>{});
  role='admin';grantedRoles=['admin'];activeView='admin';operator='Démonstration';lane='';user={uid:'demo'};
  demo=true;ready=true;online=true;state={reservations:{},tables:{}};showApp();
};
$('logoutButton').onclick=async()=>{
  if(busy)return;
  if(demo&&!confirm('Quitter la démonstration ? Les données de cet onglet seront perdues.'))return;
  const exitingDemo=demo;
  sessionGeneration++;forgetEntryLane();
  demo=false;user=null;role='none';grantedRoles=[];activeView='none';lane='';
  stopListeners();pendingProfileRef=null;
  if($('firstLoginDialog').open)$('firstLoginDialog').close();
  if(auth&&!exitingDemo)try{await auth.signOut();}catch(error){
    lock('Impossible de fermer la session. Fermez également cet onglet.');return;
  }
  showEmailLogin();
  lock('Déconnecté. Connecte-toi avec ton e-mail pour revenir.');
};
function render(){
 syncPlanFromState();
 const guests=accepted(), rs=Object.entries(state.reservations||{}), query=normal($('search').value);
 const arrived=guests.filter(p=>p.arrived).length;
 $('statTotal').textContent=guests.length;$('statArrived').textContent=arrived;$('statRemaining').textContent=guests.length-arrived;$('statPaid').textContent=guests.filter(p=>p.paid).length;
 $('progressFill').style.width=(guests.length?100*arrived/guests.length:0)+'%';
 $('reservationSummary').innerHTML=`<span><strong>${rs.filter(([,r])=>r.status==='pending').length}</strong> réservations à valider</span><span><strong>${guests.filter(p=>!p.tableId).length}</strong> invités à placer</span><span><strong>${guests.filter(p=>!p.paid).length}</strong> invités non payés</span>`;
 $('connectionStatus').textContent=demo?'DÉMONSTRATION · rien n’est sauvegardé':ready?(online?'Synchronisation active':'Hors connexion · modifications bloquées'):'Connexion en cours…';
 const html=rs.sort((a,b)=>(a[1].createdAt||'').localeCompare(b[1].createdAt||'')).map(([rid,r])=>{
  const parts=Object.entries(r.participants||{});
  const matching=parts.filter(([pid,p])=>{
   if(filter==='pending'&&r.status!=='pending'||filter==='accepted'&&r.status!=='accepted'||filter==='cancelled'&&r.status!=='cancelled')return false;
   if(['unplaced','arrived','unpaid'].includes(filter)&&r.status!=='accepted')return false;
   if(filter==='unplaced'&&p.tableId||filter==='arrived'&&!p.arrived||filter==='unpaid'&&p.paid)return false;
   return !query||normal([r.reservedBy,r.phone,r.contactedOrganizer,p.name,tableNames[p.tableId]].join(' ')).includes(query);
  });if(!matching.length)return '';
  return `<section><div class="group-header"><strong>${esc(r.reservedBy)}</strong> · ${parts.length} personne${parts.length>1?'s':''} · ${statuses[r.status]||'À vérifier'}
   <div class="group-note">${esc(r.phone||'')} ${r.phone?' · ':''}Contacté : ${esc(r.contactedOrganizer||'Non renseigné')} · Saisie : ${esc(r.createdBy||'')}${r.notes?'\n'+esc(r.notes):''}</div>
   <div class="reservation-actions">${allowed('reserve')?`<button class="secondary" data-action="edit" data-rid="${rid}">Modifier</button>`:''}${allowed('reserve')&&r.status==='pending'?`<button class="primary" data-action="accept" data-rid="${rid}">Accepter</button>`:''}${allowed('place')&&shownRole()!=='placement'&&r.status==='accepted'?`<button class="secondary" draggable="true" data-action="select" data-rid="${rid}">Placer le groupe →</button>`:''}${allowed('reserve')&&r.status!=='cancelled'?`<button class="secondary" data-action="cancel" data-rid="${rid}">Annuler</button>`:''}</div></div>
   ${matching.map(([pid,p])=>guestCard(rid,pid,p,r)).join('')}</section>`;
 }).join('');
 $('guestList').innerHTML=html||'<div class="empty-state">Aucune réservation pour le moment.<br>Utilisez « + Réservation SMS » pour ajouter un réservant et ses invités.</div>';
 tableElements.forEach(el=>{
   const m=tableMetrics(el.id,guests);
   el.querySelector('.t-guests').textContent=m.total+' / '+m.capacity+' places · '+m.free+' libres';
   el.querySelector('.t-name').textContent=m.total
     ? m.arrived+' / '+m.total+' arrivés · '+m.people.filter(p=>p.paid).length+' payé(s)'
     : 'Aucun invité placé';
   el.classList.toggle('full',m.occupancy==='full');
   el.classList.toggle('highlighted',!!selection);
   for(const status of ['empty','partial','full','overflow'])
     el.classList.toggle('capacity-'+status,m.occupancy===status);
   for(const status of ['empty','waiting','partial','complete'])
     el.classList.toggle('arrival-'+status,m.arrival===status);
   const fill=el.querySelector('.t-progress-fill'),label=el.querySelector('.t-progress-label');
   if(fill)fill.style.width=(m.total?m.arrived/m.total*100:0)+'%';
   if(label)label.textContent=m.arrived+'/'+m.total+' arrivés';
   el.setAttribute('aria-label',m.name+' : '+m.total+' sur '+m.capacity+' places, '+m.arrived+' arrivés');
 });
 renderEntryTables(guests);
 if(selection){try{const people=membersFor(selection);$('mapHint').textContent=`${people.length} personne(s) sélectionnée(s) : cliquez sur une table`;$('bannerName').textContent=selection.pid?people[0].name:state.reservations[selection.rid].reservedBy;$('bannerDetail').textContent='Cliquez sur une table, ou glissez la sélection sur le plan.';$('bannerTable').textContent=people.length+' personne(s)';$('guestBanner').classList.add('visible');}catch(e){selection=null;}}
 if(!selection){$('guestBanner').classList.remove('visible');$('mapHint').textContent='Sélectionnez une personne ou un groupe, puis cliquez sur sa table';}
 if(popupTable)drawTable();
 if($('adminDashboardDialog').open)renderAdminDashboard();
}
function renderAdminDashboard(){
 if(!allowed('dashboard')||!ready)return;
 const guests=accepted(),arrived=guests.filter(p=>p.arrived),toCome=guests.filter(p=>!p.arrived);
 const sums=[
 ['Invités attendus',guests.length],['Présents',arrived.length],['Encore attendus',toCome.length],
 ['Payés',guests.filter(p=>p.paid).length],['À placer',guests.filter(p=>!p.tableId).length],
 ['Réservations à valider',Object.values(state.reservations||{}).filter(r=>r.status==='pending').length]
 ];
 $('adminKpis').innerHTML=sums.map(([label,n])=>'<div class="admin-kpi"><strong>'+n+'</strong><span>'+esc(label)+'</span></div>').join('');
 const q=normal($('adminGuestSearch').value), f=$('adminGuestFilter').value;
 const selected=guests.filter(p=>{
  if(f==='not-arrived'&&p.arrived||f==='arrived'&&!p.arrived||f==='unplaced'&&p.tableId||f==='unpaid'&&p.paid)return false;
  const r=state.reservations[p.rid];
  return !q||normal([p.name,p.reservedBy,r?.createdBy,r?.contactedOrganizer,tableNames[p.tableId]].join(' ')).includes(q);
 });
 $('adminGuestResults').innerHTML=selected.length?selected.map(p=>{
  const r=state.reservations[p.rid],label=p.tableId?(tableNames[p.tableId]+' · place '+p.seat):'Non placé';
  return '<div class="admin-guest-row"><div><strong>'+esc(p.name)+'</strong><div class="muted">'+esc(p.reservedBy)+' · '+esc(label)+'</div><small>Saisi par '+esc(r?.createdBy||'inconnu')+(p.arrivedBy?' · pointé par '+esc(p.arrivedBy):'')+'</small>'+guestTracking(p)+'</div><div class="admin-row-actions"><span>'+ (p.arrived?'✓ Arrivé':'⏳ Attendu')+' · '+(p.paid?'Payé':'Non payé')+'</span><button class="secondary" data-admin-action="edit" data-rid="'+esc(p.rid)+'">Réservation</button><button class="secondary" data-admin-action="arrived" data-rid="'+esc(p.rid)+'" data-pid="'+esc(p.pid)+'">'+(p.arrived?'Annuler arrivée':'Pointer arrivée')+'</button></div></div>';
 }).join(''):'<p class="muted">Aucun invité pour ce filtre.</p>';
}
$('adminDashboardButton').onclick=()=>{
 requireAccess('dashboard');
 $('adminGuestFilter').value='not-arrived';
 $('adminGuestSearch').value='';
 renderAdminDashboard();
 $('adminDashboardDialog').showModal();
};
$('adminGuestFilter').onchange=renderAdminDashboard;
$('adminGuestSearch').oninput=renderAdminDashboard;
$('adminGuestResults').onclick=async e=>{
 const b=e.target.closest('[data-admin-action]');
 if(!b)return;
 try{
  requireAccess('dashboard');
  if(b.dataset.adminAction==='edit'){ $('adminDashboardDialog').close();editReservation(b.dataset.rid); }
  else if(b.dataset.adminAction==='arrived'){const {rid,pid}=b.dataset;if(!state.reservations[rid]?.participants[pid]?.arrived&&!lane){arrivalTarget={rid,pid};$('arrivalLane').value='';$('arrivalError').textContent='';$('arrivalDialog').showModal();}else await setFlag(rid,pid,'arrived');renderAdminDashboard();}
 }catch(error){notice(error.message);}
};
function guestCard(rid,pid,p,r){
  const active=r.status==='accepted';
  const place=active&&allowed('place');
  const check=active&&allowed('arrival');
  const pay=active&&allowed('payment');
  return `<div class="guest-card ${p.arrived?'arrived':''}" ${place?'draggable="true"':''} data-rid="${rid}" data-pid="${pid}">
    <div class="guest-info"><div class="guest-name">${esc(p.name)}</div><div class="guest-meta">${p.tableId?esc(tableNames[p.tableId])+' · Place '+p.seat:'À placer'} · ${p.arrived?'✓ Arrivé':'Non arrivé'} · ${p.paid?'✓ Payé':'Non payé'}</div>${guestTracking(p)}</div>
    ${place?`<button class="place" data-action="select" data-rid="${rid}" data-pid="${pid}">Placer →</button>`:''}
    ${check?`<button class="${p.arrived?'on':''}" aria-pressed="${!!p.arrived}" data-action="arrived" data-rid="${rid}" data-pid="${pid}">${p.arrived?'✓ Arrivé':'Arrivée'}</button>`:''}
    ${pay?`<button class="secondary" data-action="payment-note" data-rid="${rid}" data-pid="${pid}">${p.paidForBy?'Modifier le commentaire':'Payé par un tiers / commentaire'}</button>`:''}
    ${pay?`<button class="money ${p.paid?'on':''}" aria-pressed="${!!p.paid}" data-action="paid" data-rid="${rid}" data-pid="${pid}" ${p.arrived?'disabled title="Une personne arrivée reste payée"':''}>${p.paid?'✓ Payé':'Paiement'}</button>`:''}
  </div>`;
}
$('search').oninput=render;
document.querySelectorAll('.filter-btn').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('.filter-btn').forEach(x=>x.classList.toggle('active',x===b));render();});
function addParticipant(p={}){const row=document.createElement('div');row.className='participant-row';row.dataset.pid=p.pid||uid();const input=document.createElement('input');input.required=true;input.maxLength=120;input.placeholder='Nom et prénom de l’invité';input.setAttribute('aria-label','Nom du participant');input.value=p.name||'';const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Retirer';remove.onclick=()=>row.remove();row.append(input,remove);$('participantRows').append(row);return input;}
function editReservation(rid=null){requireAccess('reserve');editing=rid;const r=state.reservations?.[rid];editVersion=r?.version||0;$('reservationForm').reset();$('participantRows').replaceChildren();$('formError').textContent='';$('reservationTitle').textContent=rid?'Modifier la réservation':'Nouvelle réservation SMS';$('reservedBy').value=r?.reservedBy||'';$('phone').value=r?.phone||'';$('contactedOrganizer').value=r?.contactedOrganizer||(allowed('reserve')?operator:'');$('reservationNotes').value=r?.notes||'';$('reservationStatus').value=r?.status||'pending';if(r)Object.entries(r.participants||{}).forEach(([pid,p])=>addParticipant({...p,pid}));else addParticipant();$('reservationDialog').showModal();$('reservedBy').focus();}
$('newReservation').onclick=()=>{requireAccess('reserve');editReservation();};$('addParticipant').onclick=()=>addParticipant().focus();
$('reservedBy').addEventListener('change',()=>{const rows=$('participantRows').children;if(!editing&&rows.length===1&&!rows[0].querySelector('input').value)rows[0].querySelector('input').value=$('reservedBy').value.trim();});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(!busy)$(b.dataset.close).close();});
$('reservationForm').onsubmit=async e=>{
 e.preventDefault();requireAccess('reserve');const rid=editing||uid(), rows=[...$('participantRows').children].map(row=>({pid:row.dataset.pid,name:row.querySelector('input').value.trim()}));
 const by=$('reservedBy').value.trim(), phone=$('phone').value.trim(), contactedOrganizer=$('contactedOrganizer').value, notes=$('reservationNotes').value.trim(), status=$('reservationStatus').value;
 try {
  if(!by||!rows.length||rows.some(p=>!p.name))throw Error('Renseignez le réservant et au moins un participant.');
  if(contactedOrganizer.length<2||contactedOrganizer.length>120)throw Error('Indiquez quel organisateur le réservant a contacté.');
  if(new Set(rows.map(p=>normal(p.name))).size!==rows.length)throw Error('Deux invités ont le même nom. Ajoutez une précision pour les distinguer.');
  const old=state.reservations?.[rid];
  if(old&&(Object.keys(old.participants||{}).some(id=>!rows.some(p=>p.pid===id))||(old.status==='accepted'&&status!=='accepted'))&&!confirm('Les participants retirés ou la réservation désactivée perdront leur placement. Confirmer ?'))return;
  await mutate(data=>{
   const prev=data.reservations[rid];if(editing&&(!prev||(prev.version||0)!==editVersion))throw Error('Cette réservation a été modifiée par l’autre organisateur. Fermez puis rouvrez le formulaire.');
   const participants={};rows.forEach(p=>{participants[p.pid]={...(prev?.participants?.[p.pid]||{tableId:'',seat:0,arrived:false,paid:false}),name:p.name};if(status!=='accepted'){participants[p.pid].tableId='';participants[p.pid].seat=0;participants[p.pid].arrived=false;}});
   const next={reservedBy:by,phone,contactedOrganizer,notes,status,participants,createdAt:prev?.createdAt||new Date().toISOString(),createdBy:prev?.createdBy||operator,version:prev?.version||0};updated(next);data.reservations[rid]=next;
  });$('reservationDialog').close();
 }catch(err){$('formError').textContent=err.message;}
};
async function setStatus(rid,status){requireAccess('reserve');if(status==='cancelled'&&!confirm('Annuler cette réservation et libérer ses places ? Les informations de paiement seront conservées.'))return;await mutate(data=>{const r=data.reservations[rid];if(!r)throw Error('Réservation introuvable.');r.status=status;if(status!=='accepted')Object.values(r.participants||{}).forEach(p=>{p.tableId='';p.seat=0;p.arrived=false;});updated(r);});}
async function setFlag(rid,pid,flag,arrivalLane=lane){
  requireAccess(flag==='arrived'?'arrival':'payment');
  if(shownRole()==='entry'&&!lane)throw Error('Sélectionne d’abord la File 1 ou la File 2.');
  if(!ready||!user||(!demo&&!online))throw Error('Connexion indisponible.');
  const expected=!!state.reservations[rid]?.participants?.[pid]?.[flag];
  const applyFlag=p=>{
    if(!p)throw Error('Cet invité est introuvable.');
    if(!!p[flag]!==expected)throw Error('Ce statut a déjà été modifié sur un autre appareil.');
    if(flag==='paid'&&p.arrived&&p.paid)throw Error('Une personne arrivée reste payée. Annulez d’abord son arrivée pour corriger.');
    const now=new Date().toISOString();
    p[flag]=!expected;p[flag+'At']=!expected?now:'';
    p[flag+'By']=operator+(lane?' · File '+(lane==='left'?'1':'2'):'');
    if(flag==='arrived')p.arrivalLane=!expected?arrivalLane:'';
    if(flag==='paid'&&expected){p.paidForBy='';p.paymentComment='';p.paymentRecordedAt='';p.paymentRecordedBy='';}
    if(flag==='arrived'&&!expected){
      p.paid=true;
      if(!p.paidAt)p.paidAt=now;
      if(!p.paidBy)p.paidBy=operator+' · validation à l’entrée';
    }
    return p;
  };
  if(!demo&&!hasRole('admin')){
    // Une écriture directe sous l'invité permet aux règles Firebase d'autoriser
    // uniquement l'arrivée et le paiement, et rien d'autre.
    if(state.reservations[rid]?.status!=='accepted')throw Error('Réservation non acceptée.');
    if(busy)throw Error('Un enregistrement est déjà en cours.');
    busy=true;
    try{
      const ref=dataRef.child('reservations').child(rid).child('participants').child(pid);
      let conflict='';
      const result=await ref.transaction(current=>{
        try{
          const next=applyFlag(current?{...current}:null);
          conflict='';return next;
        }catch(error){conflict=error.message;return;}
      },undefined,false);
      if(!result.committed)throw Error(conflict||'Modification refusée. Vérifiez les droits Firebase.');
      notice('Arrivée et paiement mis à jour pour tous les appareils.');
    }finally{busy=false;}
    return;
  }
  await mutate(data=>{
    const r=data.reservations[rid],p=r?.participants?.[pid];
    if(!p||r.status!=='accepted')throw Error('Cet invité ne fait pas partie d’une réservation acceptée.');
    applyFlag(p);updated(r);
  });
}
function choose(sel){requireAccess('place');membersFor(sel);closeTablePopup();selection=sel;render();document.querySelector('.panel-right').scrollIntoView({behavior:'smooth',block:'start'});}
function clearSelection(){selection=null;render();}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;try{const {action,rid,pid}=b.dataset;if(action==='edit')editReservation(rid);else if(action==='accept')await setStatus(rid,'accepted');else if(action==='cancel')await setStatus(rid,'cancelled');else if(action==='select')choose({rid,pid});else if(action==='payment-note')openPaymentNote(rid,pid);else if(action==='arrived'&&!state.reservations[rid]?.participants[pid]?.arrived&&!lane){requireAccess('arrival');arrivalTarget={rid,pid};$('arrivalLane').value='';$('arrivalError').textContent='';$('arrivalDialog').showModal();}else if(action==='arrived'||action==='paid')await setFlag(rid,pid,action);}catch(err){notice(err.message);}});
document.addEventListener('dragstart',e=>{if(!allowed('place'))return;const el=e.target.closest('[draggable="true"]');if(!el)return;try{selection={rid:el.dataset.rid,pid:el.dataset.pid};membersFor(selection);e.dataTransfer.setData('text/plain',JSON.stringify(selection));e.dataTransfer.effectAllowed='move';$('mapHint').textContent='Déposez sur la table souhaitée';}catch(err){e.preventDefault();notice(err.message);}});
function bindTableElement(el){el.onclick=()=>openTablePopup(el.id);el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label',el.dataset.table);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTablePopup(el.id);}};el.ondragover=e=>{if(selection){e.preventDefault();e.dataTransfer.dropEffect='move';}};el.ondrop=e=>{e.preventDefault();if(selection)showPlacement(el.id);};}
tableElements.forEach(bindTableElement);
function openTablePopup(id){if(selection){requireAccess('place');showPlacement(id);return;}popupTable=id;drawTable();$('tablePopupOverlay').classList.add('visible');}
function closeTablePopup(e){if(e&&e.target!==$('tablePopupOverlay'))return;popupTable=null;$('tablePopupOverlay').classList.remove('visible');}
function drawTable(){
 const id=popupTable,m=tableMetrics(id),people=m.people,cap=m.capacity;
 $('popupTitle').textContent=tableNames[id];
 $('popupSubtitle').textContent=m.total+' / '+cap+' places occupées · '+m.free+' libres · '+m.arrived+' arrivés';
 $('popupProgressFill').style.width=(m.total?100*m.arrived/m.total:0)+'%';
 $('popupProgressLabel').textContent=m.arrived+' / '+m.total+' arrivés';
 $('popupGuestList').innerHTML='<p class="fixed-capacity">'+cap+' places à cette table · bleu : attendu · vert : arrivé</p><div class="seat-grid">'+Array.from({length:cap},(_,i)=>{
  const p=people.find(p=>p.seat===i+1);
  const status=p?(p.arrived?'seat-arrived':'seat-expected'):'';
  return '<div class="seat '+status+'"><strong>Place '+(i+1)+'</strong>'+ (p?esc(p.name)+'<small>'+esc(p.reservedBy)+'</small>'+guestTracking(p)+(allowed('place')?'<button class="secondary" data-action="select" data-rid="'+esc(p.rid)+'" data-pid="'+esc(p.pid)+'">Déplacer</button>':''):'Libre')+'</div>';
 }).join('')+'</div>';
}
function showPlacement(tableId){
 try{
  requireAccess('place');
  if(shownRole()==='placement'&&!selection?.pid)throw Error('Pour cette accréditation, sélectionnez un invité à la fois.');
  const people=membersFor(selection);
  closeTablePopup();
  $('placementNames').textContent=people.map(p=>p.name).join(', ');
  $('placementTable').innerHTML='<option value="">Retirer du plan (à placer)</option>'+tableElements.map(el=>'<option value="'+el.id+'">'+esc(tableNames[el.id])+' — '+freeSeats(el.id,selection).length+' places libres sur '+capacity(el.id)+'</option>').join('');
  $('placementTable').value=tableId;
  $('placementError').textContent='';
  updateSeatOptions();
  $('placementDialog').showModal();
 }catch(error){notice(error.message);}
}
function updateSeatOptions(){
 try{
  const tableId=$('placementTable').value,people=membersFor(selection);
  $('seatLabel').style.display=people.length===1&&tableId?'block':'none';
  $('placementSeat').innerHTML=tableId?freeSeats(tableId,selection).map(n=>'<option value="'+n+'">Place '+n+'</option>').join(''):'';
  const free=tableId?freeSeats(tableId,selection).length:0;
  $('placementError').textContent=tableId&&free<people.length
   ?'Pas assez de places : '+free+' libres sur '+capacity(tableId)+' pour '+people.length+' personnes.'
   :people.length>1&&tableId?'Le groupe sera affecté aux premières places libres de cette table.':'';
 }catch(error){$('placementError').textContent=error.message;}
}
$('placementTable').onchange=updateSeatOptions;
async function placeSingleRestricted(sel,tableId,seat){
 if(!ready||!user||!online)throw Error('Connexion indisponible.');
 const reservation=state.reservations?.[sel.rid],expected=reservation?.participants?.[sel.pid];
 if(reservation?.status!=='accepted'||!expected)throw Error('Invité indisponible pour le placement.');
 if(tableId&&(!capacity(tableId)||!freeSeats(tableId,sel).includes(seat)))
   throw Error('Place indisponible ou capacité non définie.');
 if(busy)throw Error('Une modification est déjà en cours.');
 busy=true;
 try{
  const ref=dataRef.child('reservations').child(sel.rid).child('participants').child(sel.pid);
  const result=await ref.transaction(current=>{
   if(!current||current.tableId!==expected.tableId||current.seat!==expected.seat||
     current.arrived!==expected.arrived||current.paid!==expected.paid)return;
   return {...current,tableId:tableId||'',seat:tableId?seat:0};
  },undefined,false);
  if(!result.committed)throw Error('Cet invité a été modifié ailleurs. Recharge et réessaie.');
  notice('Placement enregistré pour cet invité.');
 }finally{busy=false;}
}
$('placementForm').onsubmit=async e=>{e.preventDefault();requireAccess('place');const sel={...selection},tableId=$('placementTable').value,seat=Number($('placementSeat').value);try{
 if(!demo&&!hasRole('admin')){
  if(!sel.pid)throw Error('Sélectionne un invité.');
  await placeSingleRestricted(sel,tableId,seat);
  selection=null;$('placementDialog').close();render();
  if(tableId)openTablePopup(tableId);
  return;
 }
 await mutate(data=>{const people=membersFor(sel,data),r=data.reservations[sel.rid];if(tableId){const free=freeSeats(tableId,sel,data);if(free.length<people.length)throw Error('La table ne dispose plus d’assez de places.');const seats=people.length===1?[seat]:free;if(people.length===1&&!free.includes(seat))throw Error('Cette place n’est plus disponible.');people.forEach((p,i)=>{r.participants[p.pid].tableId=tableId;r.participants[p.pid].seat=seats[i];});}else people.forEach(p=>{r.participants[p.pid].tableId='';r.participants[p.pid].seat=0;});updated(r);});selection=null;$('placementDialog').close();render();if(tableId)openTablePopup(tableId);}catch(err){$('placementError').textContent=err.message;}};
$('exportButton').onclick=()=>{requireAccess('export');const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const rows=[['Réservant','Téléphone','Organisateur contacté','Invité','Statut','Table','Place','Arrivé','Payé','Saisi par','Heure arrivée','File','Payé par un tiers','Commentaire paiement','Commentaire enregistré le','Enregistré par'],...allGuests().map(p=>[p.reservedBy,state.reservations[p.rid].phone,state.reservations[p.rid].contactedOrganizer||'',p.name,statuses[p.status],tableNames[p.tableId]||'',p.seat||'',p.arrived?'Oui':'Non',p.paid?'Oui':'Non',state.reservations[p.rid].createdBy,p.arrivedAt||'',p.arrivalLane==='left'?'File 1':p.arrivalLane==='right'?'File 2':'',p.paidForBy||'',p.paymentComment||'',p.paymentRecordedAt||'',p.paymentRecordedBy||''])];const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Saint-Eloi-2026-reservations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeTablePopup();}});
render();

let arrivalTarget=null,paymentTarget=null;
$('arrivalForm').onsubmit=async e=>{
 e.preventDefault();const selected=$('arrivalLane').value;if(!['left','right'].includes(selected))return;
 try{await setFlag(arrivalTarget.rid,arrivalTarget.pid,'arrived',selected);$('arrivalDialog').close();}
 catch(error){$('arrivalError').textContent=error.message;}
};
function openPaymentNote(rid,pid){
 requireAccess('payment');const p=state.reservations[rid]?.participants[pid];if(!p)return;
 paymentTarget={rid,pid,expected:JSON.stringify(p)};
 $('paymentGuest').textContent=p.name;$('paymentPayer').value=p.paidForBy||'';$('paymentComment').value=p.paymentComment||'';
 $('paymentError').textContent='';$('paymentDialog').showModal();
}
$('paymentForm').onsubmit=async e=>{
 e.preventDefault();
 try{
  requireAccess('payment');if(!ready||!user||(!demo&&!online))throw Error('Connexion indisponible.');
  const payer=$('paymentPayer').value.trim(),comment=$('paymentComment').value.trim();
  if(!payer||payer.length>120||comment.length>1000)throw Error('Indique le nom de la personne qui a payé (120 caractères maximum).');
  const {rid,pid,expected}=paymentTarget;
  const apply=p=>{
   if(!p||JSON.stringify(p)!==expected)throw Error('Cet invité a changé sur un autre appareil. Ferme et rouvre le commentaire.');
   const now=new Date().toISOString();
   return {...p,paid:true,paidAt:p.paidAt||now,paidBy:p.paidBy||operator,paidForBy:payer,paymentComment:comment,paymentRecordedAt:now,paymentRecordedBy:operator};
  };
  if(!demo&&!hasRole('admin')){
   if(busy)throw Error('Un enregistrement est déjà en cours.');busy=true;
   try{
    let conflict='';const result=await dataRef.child('reservations').child(rid).child('participants').child(pid).transaction(current=>{
     try{return apply(current);}catch(error){conflict=error.message;return;}
    },undefined,false);
    if(!result.committed)throw Error(conflict||'Paiement refusé. Vérifiez les règles Firebase.');
   }finally{busy=false;}
  }else await mutate(data=>{const r=data.reservations[rid];if(r?.status!=='accepted')throw Error('Réservation non acceptée.');r.participants[pid]=apply(r.participants[pid]);updated(r);});
  $('paymentDialog').close();notice('Paiement et commentaire enregistrés. Prévenir la personne à son arrivée.');
 }catch(error){$('paymentError').textContent=error.message;}
};

// Firebase restores the tab's authenticated session after F5. Re-read the
// profile and accreditation instead of requiring the password again.
if(config.enabled){
 try{
  initFirebaseAuth();
  auth.onAuthStateChanged(account=>{
   if(demo||loginBusy)return;
   if(account){
    if(user?.uid!==account.uid)void startEmailSession(account.email||'','',account);
   }else if(user){
    sessionGeneration++;forgetEntryLane();user=null;role='none';grantedRoles=[];activeView='none';operator='';lane='';pendingProfileRef=null;
    lock('Session terminée. Connecte-toi pour revenir.');
   }
  },()=>{if(!demo)lock('Impossible de restaurer la session. Reconnecte-toi.');});
 }catch(error){$('loginMessage').textContent='Connexion Firebase indisponible : '+error.message;}
}
