'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const uid = () => crypto.randomUUID().replaceAll('-','');
const clone = data => JSON.parse(JSON.stringify(data));
const statuses = {pending:'À valider',accepted:'Acceptée',cancelled:'Annulée'};
const tableElements = [...document.querySelectorAll('.table-block')];
const tableNames = Object.fromEntries(tableElements.map(el => [el.id, el.dataset.table]));
let state = {reservations:{},tables:{}};
let user = null, operator = '', role = 'none', lane = '', demo = false, online = false, ready = false, busy = false, loginBusy = false;
let db = null, auth = null, eventRef = null, dataRef = null, memberRef = null, pendingRequestRef = null;
let filter = 'all', editing = null, editVersion = 0, selection = null, popupTable = null;
const ROOT_ADMIN_UIDS=['nCNc0JdWznOZ6j4B4GjfvQqWX4K2','KpFkapZExKcToBcy52YCo6rdwuh2'];
const ROLE_LABELS={admin:'Administrateur',reservations:'Inscriptions et réservations',placement:'Placement des tables',entry:'Accueil des entrées',viewer:'Consultation',disabled:'Suspendu'};
const permissions = {
  admin:['reserve','place','arrival','payment','export','users','dashboard'],
  reservations:['reserve','export'],
  placement:['place'],
  entry:['arrival','payment'],
  viewer:[],
  disabled:[],
  organizer:['reserve','place','arrival','payment','export']
};
const allowed = permission => !!permissions[role]?.includes(permission);
function requireAccess(permission){if(!allowed(permission))throw Error('Cette accréditation ne permet pas cette opération.');}
const rootAdmin=()=>!!user&&ROOT_ADMIN_UIDS.includes(user.uid);
function selectEntryLane() {
  document.getElementById('laneChoice')?.remove();
  if (role !== 'entry') return;
  const panel = document.createElement('section');
  panel.id='laneChoice'; panel.className='lane-modal';
  panel.innerHTML='<h2>Quel poste occupez-vous ?</h2><div class="lane-buttons"><button type="button" class="lane-btn left" data-lane="left"><span class="lane-icon">◀️</span>File 1<span class="lane-sub">Poste 1</span></button><button type="button" class="lane-btn right" data-lane="right"><span class="lane-icon">▶️</span>File 2<span class="lane-sub">Poste 2</span></button></div>';
  panel.querySelectorAll('[data-lane]').forEach(btn => btn.onclick=()=>{
    lane=btn.dataset.lane;
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
function capacity(tableId, data = state) { return Number(data.tables?.[tableId]?.capacity) || 0; }
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
function validateData(data) {
  const seen = new Set();
  for (const p of accepted(data)) {
    if (!p.tableId) continue;
    if (!tableNames[p.tableId] || !Number.isInteger(p.seat) || p.seat<1 || p.seat>capacity(p.tableId,data)) throw Error('Placement invalide : vérifiez la capacité de la table.');
    const key=p.tableId+'/'+p.seat;
    if (seen.has(key)) throw Error('Cette place est déjà occupée. Choisissez une autre place.');
    seen.add(key);
  }
}
function updated(r) { r.version=(r.version||0)+1; r.updatedBy=operator; r.updatedAt=new Date().toISOString(); }
async function mutate(change) {
  if (busy) throw Error('Un enregistrement est déjà en cours.');
  if (!demo && !['reservations','placement','admin','organizer'].includes(role)) throw Error('Cette opération nécessite un accès d’écriture autorisé.');
  if (!ready || !user || (!demo&&!online)) throw Error('Connexion indisponible : aucune modification enregistrée.');
  busy=true; document.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=true);
  try {
    if(demo){
      const next=clone(state);change(next);validateData(next);state=next;render();
    }else if(role==='admin'||role==='organizer'){
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
  $('sessionBadge').textContent=lane?(lane==='left'?'◀ File 1':'▶ File 2'):operator;
  $('sessionBadge').className='lane-badge'+(lane?' '+lane:'');
  $('newReservation').style.display=allowed('reserve')?'':'none';
  $('exportButton').style.display=allowed('export')?'':'none';
  $('inviteUserButton').hidden=demo||!allowed('users');
  $('usersManagerButton').hidden=demo||!allowed('users');
  $('adminDashboardButton').hidden=demo||!allowed('dashboard');
  $('exportButton').hidden=!allowed('export');
  $('sessionBadge').title=ROLE_LABELS[role]||role;
  $('sessionBadge').onclick=()=>{if(role==='entry')selectEntryLane();};
  render();if(role==='entry'&&!lane)selectEntryLane();
}
function stopListeners(){
  if(dataRef)dataRef.off();
  if(db)db.ref('.info/connected').off();
  if(memberRef)memberRef.off();
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
      const next=snap.val()?.role;
      const actual=rootAdmin()?'admin':ROLE_LABELS[next]?next:'reservations';
      if(actual==='disabled'){
        lock('Ton accès a été suspendu par un administrateur.');
        if(auth)auth.signOut().catch(()=>{});
        return;
      }
      if(role!==actual){role=actual;if(ready)showApp();}
    },()=>{lock('Impossible de vérifier les droits de ce compte.');});
  }
  $('loginMessage').textContent='Connexion acceptée. Chargement des réservations…';
  dataRef.on('value',snapshot=>{
    state=snapshot.val()||{reservations:{},tables:{}};
    ready=true;showApp();
  },()=>{
    lock('Accès aux réservations refusé : vérifie que les nouvelles règles Firebase sont publiées et que les inscriptions libres sont désactivées.');
  });
  db.ref('.info/connected').on('value',snapshot=>{
    online=snapshot.val()===true;
    if(ready)render();
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
async function startEmailSession(email,password){
  if(loginBusy)return;
  if(!config.enabled){
    $('loginMessage').textContent='La connexion e-mail nécessite la synchronisation Firebase.';
    return;
  }
  loginBusy=true;$('emailLoginButton').disabled=true;
  stopListeners();
  role='none';operator='';lane='';ready=false;demo=false;
  try{
    initFirebaseAuth();
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const account=(await auth.signInWithEmailAndPassword(email,password)).user;
    if(!account||account.email?.trim().toLowerCase()!==email)throw Error('Identifiants non reconnus.');
    user=account;eventRef=db.ref(config.eventPath);
    memberRef=eventRef.child('members').child(account.uid);
    const membership=(await memberRef.once('value')).val();
    role=rootAdmin()?'admin':ROLE_LABELS[membership?.role]?membership.role:'reservations';
    if(role==='disabled')throw Error('Compte suspendu : contacte un administrateur.');
    $('loginMessage').textContent='Bienvenue ! Vérification du profil…';
    const ownProfile=eventRef.child('profiles').child(account.uid);
    const saved=(await ownProfile.once('value')).val();
    if(saved&&typeof saved.firstName==='string'&&typeof saved.lastName==='string'){
      operator=saved.firstName+' '+saved.lastName;
      connectLiveData();
      return;
    }
    pendingProfileRef=ownProfile;
    $('firstLoginError').textContent='';
    $('firstLoginForm').reset();
    $('firstLoginDialog').showModal();
    $('firstName').focus();
  }catch(error){
    pendingProfileRef=null;
    const err=String(error?.code||'');
    $('loginMessage').textContent=err.startsWith('auth/invalid')||err==='auth/wrong-password'||err==='auth/user-not-found'
      ? 'Adresse e-mail ou mot de passe incorrect.'
      : 'Connexion impossible : '+(error?.message||'vérifie les règles Firebase.');
    role='none';operator='';user=null;
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
function renderMembers(snapshot){
 const rows=Object.entries(snapshot.val()||{});
 $('memberList').innerHTML=rows.length?rows.map(([id,m])=>'<div class="admin-member-row"><strong>'+esc(m.email||id)+'</strong><span>'+esc(ROLE_LABELS[m.role]||'Réservations')+'</span><button class="secondary" data-member-id="'+esc(id)+'">Modifier</button></div>').join(''):'<p class="muted">Aucun accès personnalisé. Par défaut, les nouveaux comptes ont le rôle Réservations.</p>';
 $('memberList').querySelectorAll('[data-member-id]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.memberId,m=snapshot.val()[id];
  $('memberUid').value=id;$('memberEmail').value=m.email||'';$('memberRole').value=m.role||'reservations';
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
$('memberForm').onsubmit=async e=>{
 e.preventDefault();requireAccess('users');
 const id=$('memberUid').value.trim(),email=$('memberEmail').value.trim().toLowerCase(),assigned=$('memberRole').value;
 if(!/^[A-Za-z0-9_-]{8,128}$/.test(id)||!ROLE_LABELS[assigned]){ $('memberFeedback').textContent='UID ou rôle non valide.';return; }
 if(ROOT_ADMIN_UIDS.includes(id)&&assigned!=='admin'){ $('memberFeedback').textContent='Les comptes principaux restent administrateurs.';return; }
 try{
  await eventRef.child('members').child(id).set({email,role:assigned,updatedBy:user.uid,updatedAt:firebase.database.ServerValue.TIMESTAMP});
  $('memberFeedback').textContent='Droits enregistrés.';
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
$('inviteUserForm').onsubmit=async e=>{
  e.preventDefault();
  if(demo||!allowed('users'))return;
  const email=$('inviteEmail').value.trim().toLowerCase();
  if(!$('inviteEmail').checkValidity())return;
  $('sendInviteButton').disabled=true;
  try{
    await sendResetEmail(email);
    $('inviteUserMessage').textContent='Demande d’e-mail de réinitialisation transmise à Firebase. Vérifier la boîte de réception et les spams.';
  }catch(error){
    $('inviteUserMessage').textContent='Envoi impossible : '+(error?.message||'réessaie.');
  }finally{$('sendInviteButton').disabled=false;}
};
$('demoButton').onclick=()=>{
  stopListeners();
  if(auth)auth.signOut().catch(()=>{});
  role='admin';operator='Démonstration';lane='';user={uid:'demo'};
  demo=true;ready=true;online=true;state={reservations:{},tables:{}};showApp();
};
$('logoutButton').onclick=async()=>{
  if(busy)return;
  if(demo&&!confirm('Quitter la démonstration ? Les données de cet onglet seront perdues.'))return;
  const exitingDemo=demo;
  demo=false;user=null;role='none';lane='';
  stopListeners();pendingProfileRef=null;
  if($('firstLoginDialog').open)$('firstLoginDialog').close();
  if(auth&&!exitingDemo)try{await auth.signOut();}catch(error){
    lock('Impossible de fermer la session. Fermez également cet onglet.');return;
  }
  showEmailLogin();
  lock('Déconnecté. Connecte-toi avec ton e-mail pour revenir.');
};
function render(){
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
   <div class="reservation-actions">${allowed('reserve')?`<button class="secondary" data-action="edit" data-rid="${rid}">Modifier</button>`:''}${allowed('reserve')&&r.status==='pending'?`<button class="primary" data-action="accept" data-rid="${rid}">Accepter</button>`:''}${allowed('place')&&r.status==='accepted'?`<button class="secondary" draggable="true" data-action="select" data-rid="${rid}">Placer le groupe →</button>`:''}${allowed('reserve')&&r.status!=='cancelled'?`<button class="secondary" data-action="cancel" data-rid="${rid}">Annuler</button>`:''}</div></div>
   ${matching.map(([pid,p])=>guestCard(rid,pid,p,r)).join('')}</section>`;
 }).join('');
 $('guestList').innerHTML=html||'<div class="empty-state">Aucune réservation pour le moment.<br>Utilisez « + Réservation SMS » pour ajouter un réservant et ses invités.</div>';
 tableElements.forEach(el=>{
   const seated=guests.filter(p=>p.tableId===el.id), cap=capacity(el.id);
   el.querySelector('.t-guests').textContent=cap?`${seated.length} / ${cap} places · ${cap-seated.length} libres`:'Capacité à définir';
   el.querySelector('.t-name').textContent=seated.length?`${seated.filter(p=>p.arrived).length} arrivé(s) · ${seated.filter(p=>p.paid).length} payé(s)`:'Aucun invité placé';
   el.classList.toggle('full',!!cap&&seated.length===cap);el.classList.toggle('highlighted',!!selection);
 });
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
  return '<div class="admin-guest-row"><div><strong>'+esc(p.name)+'</strong><div class="muted">'+esc(p.reservedBy)+' · '+esc(label)+'</div><small>Saisi par '+esc(r?.createdBy||'inconnu')+(p.arrivedBy?' · pointé par '+esc(p.arrivedBy):'')+'</small></div><div class="admin-row-actions"><span>'+ (p.arrived?'✓ Arrivé':'⏳ Attendu')+' · '+(p.paid?'Payé':'Non payé')+'</span><button class="secondary" data-admin-action="edit" data-rid="'+esc(p.rid)+'">Réservation</button><button class="secondary" data-admin-action="arrived" data-rid="'+esc(p.rid)+'" data-pid="'+esc(p.pid)+'">'+(p.arrived?'Annuler arrivée':'Pointer arrivée')+'</button></div></div>';
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
  else if(b.dataset.adminAction==='arrived'){await setFlag(b.dataset.rid,b.dataset.pid,'arrived');renderAdminDashboard();}
 }catch(error){notice(error.message);}
};
function guestCard(rid,pid,p,r){
  const active=r.status==='accepted';
  const place=active&&allowed('place');
  const check=active&&allowed('arrival');
  const pay=active&&allowed('payment');
  return `<div class="guest-card ${p.arrived?'arrived':''}" ${place?'draggable="true"':''} data-rid="${rid}" data-pid="${pid}">
    <div class="guest-info"><div class="guest-name">${esc(p.name)}</div><div class="guest-meta">${p.tableId?esc(tableNames[p.tableId])+' · Place '+p.seat:'À placer'} · ${p.arrived?'✓ Arrivé':'Non arrivé'} · ${p.paid?'✓ Payé':'Non payé'}</div></div>
    ${place?`<button class="place" data-action="select" data-rid="${rid}" data-pid="${pid}">Placer →</button>`:''}
    ${check?`<button class="${p.arrived?'on':''}" aria-pressed="${!!p.arrived}" data-action="arrived" data-rid="${rid}" data-pid="${pid}">${p.arrived?'✓ Arrivé':'Arrivée'}</button>`:''}
    ${pay?`<button class="money ${p.paid?'on':''}" aria-pressed="${!!p.paid}" data-action="paid" data-rid="${rid}" data-pid="${pid}" ${p.arrived?'disabled title="Une personne arrivée reste payée"':''}>${p.paid?'✓ Payé':'Paiement'}</button>`:''}
  </div>`;
}
$('search').oninput=render;
document.querySelectorAll('.filter-btn').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('.filter-btn').forEach(x=>x.classList.toggle('active',x===b));render();});
function addParticipant(p={}){const row=document.createElement('div');row.className='participant-row';row.dataset.pid=p.pid||uid();const input=document.createElement('input');input.required=true;input.maxLength=120;input.placeholder='Nom et prénom de l’invité';input.setAttribute('aria-label','Nom du participant');input.value=p.name||'';const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Retirer';remove.onclick=()=>row.remove();row.append(input,remove);$('participantRows').append(row);return input;}
function editReservation(rid=null){requireAccess('reserve');editing=rid;const r=state.reservations?.[rid];editVersion=r?.version||0;$('reservationForm').reset();$('participantRows').replaceChildren();$('formError').textContent='';$('reservationTitle').textContent=rid?'Modifier la réservation':'Nouvelle réservation SMS';$('reservedBy').value=r?.reservedBy||'';$('phone').value=r?.phone||'';$('contactedOrganizer').value=r?.contactedOrganizer||(role==='organizer'?operator:'');$('reservationNotes').value=r?.notes||'';$('reservationStatus').value=r?.status||'pending';if(r)Object.entries(r.participants||{}).forEach(([pid,p])=>addParticipant({...p,pid}));else addParticipant();$('reservationDialog').showModal();$('reservedBy').focus();}
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
async function setFlag(rid,pid,flag){
  requireAccess(flag==='arrived'?'arrival':'payment');
  if(!ready||!user||(!demo&&!online))throw Error('Connexion indisponible.');
  const expected=!!state.reservations[rid]?.participants?.[pid]?.[flag];
  const applyFlag=p=>{
    if(!p)throw Error('Cet invité est introuvable.');
    if(!!p[flag]!==expected)throw Error('Ce statut a déjà été modifié sur un autre appareil.');
    if(flag==='paid'&&p.arrived&&p.paid)throw Error('Une personne arrivée reste payée. Annulez d’abord son arrivée pour corriger.');
    const now=new Date().toISOString();
    p[flag]=!expected;p[flag+'At']=!expected?now:'';
    p[flag+'By']=operator+(lane?' · File '+(lane==='left'?'Gauche':'Droite'):'');
    if(flag==='arrived'&&!expected){
      p.paid=true;
      if(!p.paidAt)p.paidAt=now;
      if(!p.paidBy)p.paidBy=operator+' · validation à l’entrée';
    }
    return p;
  };
  if(!demo&&role==='entry'){
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
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;try{const {action,rid,pid}=b.dataset;if(action==='edit')editReservation(rid);else if(action==='accept')await setStatus(rid,'accepted');else if(action==='cancel')await setStatus(rid,'cancelled');else if(action==='select')choose({rid,pid});else if(action==='arrived'||action==='paid')await setFlag(rid,pid,action);}catch(err){notice(err.message);}});
document.addEventListener('dragstart',e=>{if(!allowed('place'))return;const el=e.target.closest('[draggable="true"]');if(!el)return;try{selection={rid:el.dataset.rid,pid:el.dataset.pid};membersFor(selection);e.dataTransfer.setData('text/plain',JSON.stringify(selection));e.dataTransfer.effectAllowed='move';$('mapHint').textContent='Déposez sur la table souhaitée';}catch(err){e.preventDefault();notice(err.message);}});
tableElements.forEach(el=>{el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label',el.dataset.table);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTablePopup(el.id);}};el.ondragover=e=>{if(selection){e.preventDefault();e.dataTransfer.dropEffect='move';}};el.ondrop=e=>{e.preventDefault();if(selection)showPlacement(el.id);};});
function openTablePopup(id){if(selection){requireAccess('place');showPlacement(id);return;}popupTable=id;drawTable();$('tablePopupOverlay').classList.add('visible');}
function closeTablePopup(e){if(e&&e.target!==$('tablePopupOverlay'))return;popupTable=null;$('tablePopupOverlay').classList.remove('visible');}
function drawTable(){const id=popupTable,cap=capacity(id),people=accepted().filter(p=>p.tableId===id);$('popupTitle').textContent=tableNames[id];$('popupSubtitle').textContent=cap?`${people.length} places occupées · ${cap-people.length} places libres`:'Définissez le nombre de places pour cette table';$('popupProgressFill').style.width=(cap?people.length/cap*100:0)+'%';$('popupProgressLabel').textContent=`${people.length} / ${cap||'—'} places`;
 $('popupGuestList').innerHTML=`${allowed('place')?`<form class="capacity-control" id="capacityForm"><label for="tableCapacity">Nombre de places</label><input id="tableCapacity" type="number" min="1" max="100" step="1" value="${cap||''}" required><button type="submit" class="secondary">Enregistrer</button></form>`:''}<div class="seat-grid">${Array.from({length:cap},(_,i)=>{const p=people.find(p=>p.seat===i+1);return `<div class="seat ${p?'occupied':''}"><strong>Place ${i+1}</strong>${p?esc(p.name)+'<br><small>'+esc(p.reservedBy)+'</small><br>'+(allowed('place')?`<button class="secondary" data-action="select" data-rid="${p.rid}" data-pid="${p.pid}">Déplacer</button>`:''):'Libre'}</div>`;}).join('')}</div>`;
 if(allowed('place'))$('capacityForm').onsubmit=async e=>{e.preventDefault();requireAccess('place');const n=Number($('tableCapacity').value);try{if(!Number.isInteger(n)||n<1||n>100)throw Error('Choisissez entre 1 et 100 places.');await mutate(data=>{if(accepted(data).some(p=>p.tableId===id&&p.seat>n))throw Error('Déplacez d’abord les invités des places qui seraient supprimées.');data.tables[id]={capacity:n};});}catch(err){notice(err.message);}};
}
function showPlacement(tableId){try{requireAccess('place');const people=membersFor(selection);closeTablePopup();$('placementNames').textContent=people.map(p=>p.name).join(', ');$('placementTable').innerHTML='<option value="">Retirer du plan (à placer)</option>'+tableElements.map(el=>`<option value="${el.id}">${esc(tableNames[el.id])} — ${capacity(el.id)?freeSeats(el.id,selection).length+' places disponibles':'capacité à définir'}</option>`).join('');$('placementTable').value=tableId;$('newCapacity').value='';$('placementError').textContent='';updateSeatOptions();$('placementDialog').showModal();}catch(err){notice(err.message);}}
function updateSeatOptions(){try{const tableId=$('placementTable').value,people=membersFor(selection);$('newCapacityLabel').hidden=!tableId||!!capacity(tableId);const draft=clone(state);if(tableId&&!capacity(tableId)){draft.tables ||= {};draft.tables[tableId]={capacity:Math.min(100,Math.max(0,Math.floor(Number($('newCapacity').value)||0))) };}$('seatLabel').style.display=people.length===1&&tableId?'block':'none';$('placementSeat').innerHTML=tableId?freeSeats(tableId,selection,draft).map(n=>`<option value="${n}">Place ${n}</option>`).join(''):'';const free=tableId?freeSeats(tableId,selection,draft).length:0;$('placementError').textContent=tableId&&!capacity(tableId,draft)?'Indiquez le nombre de places : la table sera configurée en même temps que le placement.':tableId&&free<people.length?`Pas assez de places : ${free} libres pour ${people.length} personnes. Choisissez une autre table ou placez les invités individuellement.`:people.length>1&&tableId?'Le groupe sera affecté aux premières places libres de cette table.':'';}catch(err){$('placementError').textContent=err.message;}}
$('placementTable').onchange=()=>{$('newCapacity').value='';updateSeatOptions();};$('newCapacity').oninput=updateSeatOptions;
$('placementForm').onsubmit=async e=>{e.preventDefault();requireAccess('place');const sel={...selection},tableId=$('placementTable').value,seat=Number($('placementSeat').value),newCap=Number($('newCapacity').value);try{await mutate(data=>{const people=membersFor(sel,data),r=data.reservations[sel.rid];if(tableId){if(!capacity(tableId,data)){if(!Number.isInteger(newCap)||newCap<1||newCap>100)throw Error('Indiquez une capacité entre 1 et 100 places.');data.tables[tableId]={capacity:newCap};}const free=freeSeats(tableId,sel,data);if(free.length<people.length)throw Error('La table ne dispose plus d’assez de places.');const seats=people.length===1?[seat]:free;if(people.length===1&&!free.includes(seat))throw Error('Cette place n’est plus disponible.');people.forEach((p,i)=>{r.participants[p.pid].tableId=tableId;r.participants[p.pid].seat=seats[i];});}else people.forEach(p=>{r.participants[p.pid].tableId='';r.participants[p.pid].seat=0;});updated(r);});selection=null;$('placementDialog').close();render();if(tableId)openTablePopup(tableId);}catch(err){$('placementError').textContent=err.message;}};
$('exportButton').onclick=()=>{requireAccess('export');const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const rows=[['Réservant','Téléphone','Organisateur contacté','Invité','Statut','Table','Place','Arrivé','Payé','Saisi par'],...allGuests().map(p=>[p.reservedBy,state.reservations[p.rid].phone,state.reservations[p.rid].contactedOrganizer||'',p.name,statuses[p.status],tableNames[p.tableId]||'',p.seat||'',p.arrived?'Oui':'Non',p.paid?'Oui':'Non',state.reservations[p.rid].createdBy])];const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Saint-Eloi-2026-reservations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeTablePopup();}});
render();
