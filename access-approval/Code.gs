/**
 * Saint Éloi 2026 — approbation des accès (Google Apps Script, sans Cloud Functions).
 *
 * Copiez ce fichier dans https://script.google.com/ (un projet Apps Script privé).
 * Renseignez les propriétés de script :
 * - ADMIN_EMAIL : votre adresse recevant les notifications.
 * - SERVICE_ACCOUNT_JSON : JSON de la clé privée d'un compte de service Firebase,
 *   créé dans la console Firebase et gardé SEULEMENT dans les propriétés Apps Script.
 * - WEB_APP_URL : l'URL /exec de votre déploiement Apps Script.
 *
 * Ne JAMAIS mettre SERVICE_ACCOUNT_JSON dans GitHub, dans le site, ni dans ChatGPT.
 * Déployez en application Web « Exécuter en tant que moi », accès « Tout le monde ».
 * Exécutez installApprovalNotifications() une seule fois : vérification toutes les 5 min.
 *
 * NB : L'email est envoyé par MailApp (compte Google propriétaire du script),
 * pas directement par Firebase Spark. La validation par lien HMAC est à usage unique.
 */
'use strict';

var SAINT_ELOI_DB = 'https://sainteloi26-371e3-default-rtdb.europe-west1.firebasedatabase.app';
var SAINT_ELOI_PATH = '/events/saint-eloi-2026';
var SAINT_ELOI_PROFILES = {
  'Antonin Blanckaert': 'organizer',
  'Antonin Bassut': 'organizer',
  'Placement des invités': 'placement',
  'Administration': 'admin',
  'Consultation du plan': 'view',
  'Accueil des entrées': 'entry'
};

function setting_(key) {
  var v=PropertiesService.getScriptProperties().getProperty(key);
  if(!v)throw new Error('Propriété manquante : '+key);
  return v;
}
function b64url_(input) {
  return Utilities.base64EncodeWebSafe(input).replace(/=+$/,'');
}
function serviceToken_() {
  var cache=CacheService.getScriptCache(), cached=cache.get('firebaseAdminToken');
  if(cached)return cached;
  var service=JSON.parse(setting_('SERVICE_ACCOUNT_JSON'));
  if(!service.client_email||!service.private_key)throw new Error('Compte de service invalide.');
  var now=Math.floor(Date.now()/1000);
  var header=b64url_(JSON.stringify({alg:'RS256',typ:'JWT'}));
  var claims=b64url_(JSON.stringify({
    iss:service.client_email,
    scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud:'https://oauth2.googleapis.com/token',
    iat:now,
    exp:now+3500
  }));
  var unsigned=header+'.'+claims;
  var signed=b64url_(Utilities.computeRsaSha256Signature(unsigned,service.private_key));
  var response=UrlFetchApp.fetch('https://oauth2.googleapis.com/token',{
    method:'post',
    payload:{grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signed},
    muteHttpExceptions:true
  });
  if(response.getResponseCode()!==200)throw new Error('Autorisation compte de service impossible ('+response.getResponseCode()+').');
  var token=JSON.parse(response.getContentText()).access_token;
  if(!token)throw new Error('Jeton de service Firebase absent.');
  cache.put('firebaseAdminToken',token,3000);
  return token;
}
function db_(relative,method,value) {
  if(!/^\/[A-Za-z0-9_\/-]*$/.test(relative))throw new Error('Chemin Firebase invalide.');
  var options={
    method:method||'get',
    headers:{Authorization:'Bearer '+serviceToken_()},
    muteHttpExceptions:true
  };
  if(method==='put'||method==='patch'){
    options.contentType='application/json';
    options.payload=JSON.stringify(value);
  }
  var response=UrlFetchApp.fetch(SAINT_ELOI_DB+SAINT_ELOI_PATH+relative+'.json',options);
  if(response.getResponseCode()<200||response.getResponseCode()>299){
    throw new Error('Firebase '+response.getResponseCode()+' : '+response.getContentText().slice(0,150));
  }
  var body=response.getContentText();
  return body?JSON.parse(body):null;
}
function safeUid_(uid){
  return typeof uid==='string'&&/^[a-zA-Z0-9_-]{12,128}$/.test(uid);
}
function validRequest_(r) {
  return !!r&&r.status==='pending'&&
    typeof r.name==='string'&&r.name.length>=3&&r.name.length<=100&&
    Number.isFinite(r.requestedAt)&&
    SAINT_ELOI_PROFILES[r.requestedOperator]===r.requestedRole;
}
function signature_(uid,started) {
  return b64url_(Utilities.computeHmacSha256Signature(uid+':'+started,setting_('APPROVAL_LINK_SECRET')));
}
function safeEqual_(one,two) {
  // La comparaison n'est pas une API cryptographique constante en temps,
  // mais les signatures HMAC longues rendent l'énumération impraticable.
  return typeof two==='string'&&one===two;
}
function escapeHtml_(v){
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function installApprovalNotifications(){
  setting_('ADMIN_EMAIL');setting_('SERVICE_ACCOUNT_JSON');setting_('WEB_APP_URL');
  serviceToken_();
  var props=PropertiesService.getScriptProperties();
  if(!props.getProperty('APPROVAL_LINK_SECRET')){
    props.setProperty('APPROVAL_LINK_SECRET',Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid());
  }
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==='notifyPendingApprovals')ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('notifyPendingApprovals').timeBased().everyMinutes(5).create();
  Logger.log('Notifications préparées. Les demandes seront vérifiées toutes les 5 minutes.');
  notifyPendingApprovals();
}
function notifyPendingApprovals(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))return;
  try{
    var all=db_('/accessRequests','get')||{};
    var props=PropertiesService.getScriptProperties();
    var webApp=setting_('WEB_APP_URL');
    var recipient=setting_('ADMIN_EMAIL');
    var today=Utilities.formatDate(new Date(),'Europe/Paris','yyyy-MM-dd');
    var rate=JSON.parse(props.getProperty('MAIL_DAILY_COUNTER')||'{}');
    if(rate.date!==today)rate={date:today,count:0};
    Object.keys(all).forEach(function(uid){
      var req=all[uid];
      if(!safeUid_(uid)||!validRequest_(req)||req.notificationSentAt)return;
      if(rate.count>=30||MailApp.getRemainingDailyQuota()<1)return;
      var url=webApp+'?uid='+encodeURIComponent(uid)+
        '&ts='+encodeURIComponent(String(req.requestedAt))+
        '&sig='+encodeURIComponent(signature_(uid,req.requestedAt));
      var body='Nouvelle demande d’accès à Saint Éloi 2026.\n\n'+
        'Personne : '+req.name+'\n'+
        'Rôle demandé par le code saisi : '+req.requestedOperator+' ('+req.requestedRole+')\n'+
        'Appareil Firebase : '+uid+'\n\n'+
        'Consulter et ACCEPTER / REFUSER :\n'+url+'\n\n'+
        'IMPORTANT : les codes actuellement inclus dans le GitHub public ne prouvent pas '+ 
        'l’identité du demandeur. Vérifiez la personne avant d’approuver.\n';
      MailApp.sendEmail(recipient,'Saint Éloi 2026 — Demande d’accès : '+req.name,body);
      db_('/accessRequests/'+uid,'patch',{notificationSentAt:Date.now()});
      rate.count++;
      props.setProperty('MAIL_DAILY_COUNTER',JSON.stringify(rate));
    });
  }finally{
    lock.releaseLock();
  }
}
function verifiedRequest_(uid,ts,sig){
  if(!safeUid_(uid)||!/^\d{10,18}$/.test(String(ts||'')))throw new Error('Demande invalide.');
  var req=db_('/accessRequests/'+uid,'get');
  if(!validRequest_(req)||String(req.requestedAt)!==String(ts)){
    throw new Error('Demande inexistante, déjà traitée ou expirée.');
  }
  if(!safeEqual_(signature_(uid,req.requestedAt),sig)){
    throw new Error('Lien de validation invalide.');
  }
  return req;
}
function doGet(e){
  var p=e&&e.parameter||{}, html='';
  try{
    var req=verifiedRequest_(p.uid,p.ts,p.sig);
    var data=JSON.stringify({uid:p.uid,ts:p.ts,sig:p.sig}).replace(/</g,'\\u003c');
    html='<h1>Saint Éloi 2026 — validation d’accès</h1>'+
      '<p><b>Demandeur :</b> '+escapeHtml_(req.name)+'</p>'+
      '<p><b>Rôle demandé :</b> '+escapeHtml_(req.requestedOperator)+'</p>'+
      '<p><b>Appareil :</b> <code>'+escapeHtml_(p.uid)+'</code></p>'+
      '<p><b>Attention :</b> vérifiez la personne avant d’accepter. '+ 
      'Le code côté GitHub public ne constitue pas une preuve d’identité.</p>'+
      '<button onclick="decide(\'approve\')">Autoriser cet appareil</button> '+
      '<button onclick="decide(\'reject\')">Refuser cet appareil</button>'+
      '<p id="answer" aria-live="polite"></p>'+
      '<script>var data='+data+';'+
      'function decide(action){'+
      'document.getElementById("answer").textContent="Validation…";'+
      'google.script.run.withSuccessHandler(function(msg){'+
      'document.getElementById("answer").textContent=msg;'+
      '}).withFailureHandler(function(err){'+
      'document.getElementById("answer").textContent=err.message;'+
      '}).applyApprovalDecision(data.uid,data.ts,data.sig,action);'+
      '}</script>';
  }catch(error){
    html='<h1>Demande d’accès indisponible</h1><p>'+escapeHtml_(error.message)+'</p>';
  }
  return HtmlService.createHtmlOutput('<html><head><meta name="viewport" content="width=device-width, initial-scale=1">'+
    '<style>body{font-family:Arial,sans-serif;max-width:650px;padding:28px;margin:auto;line-height:1.6}'+
    'button{padding:13px;border-radius:8px;margin:6px;cursor:pointer}code{overflow-wrap:anywhere}</style>'+
    '</head><body>'+html+'</body></html>').setTitle('Saint Éloi — approbation');
}
function applyApprovalDecision(uid,ts,sig,action){
  if(action!=='approve'&&action!=='reject')throw new Error('Décision invalide.');
  var lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    var req=verifiedRequest_(uid,ts,sig);
    if(action==='approve'){
      // Cette écriture est réservée au compte de service. Jamais au navigateur.
      db_('/members/'+uid,'put',{name:req.requestedOperator,role:req.requestedRole});
    }
    db_('/accessRequests/'+uid,'patch',{
      status:action==='approve'?'approved':'rejected',
      decidedAt:Date.now()
    });
    return action==='approve'
      ? 'Appareil autorisé pour le profil '+req.requestedOperator+'.'
      : 'Demande refusée. Aucun droit accordé.';
  }finally{
    lock.releaseLock();
  }
}
