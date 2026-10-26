'use strict';
const ROOT_ADMINS=['nCNc0JdWznOZ6j4B4GjfvQqWX4K2','KpFkapZExKcToBcy52YCo6rdwuh2'];
// Dependencies are injected so authorization and account handling can be tested offline.
exports.inviteUserHandler=({auth,database,randomPassword})=>async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Méthode non autorisée.'});
 const bearer=/^Bearer (.+)$/.exec(req.headers.authorization||'');
 if(!bearer)return res.status(401).json({error:'Reconnecte-toi pour inviter un utilisateur.'});
 let actor;
 try{actor=await auth.verifyIdToken(bearer[1],true);}catch{return res.status(401).json({error:'Session expirée. Reconnecte-toi.'});}
 try{
  const members=database.ref('events/saint-eloi-2026/members');
  const member=(await members.child(actor.uid).once('value')).val();
  if(actor.firebase?.sign_in_provider!=='password'||(!ROOT_ADMINS.includes(actor.uid)&&member?.role!=='admin'))return res.status(403).json({error:'Invitation réservée aux administrateurs.'});
  const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
  if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Adresse e-mail non valide.'});
  let account,created=false;
  try{account=await auth.getUserByEmail(email);}
  catch(error){
   if(error.code!=='auth/user-not-found')throw error;
   try{account=await auth.createUser({email,password:randomPassword(),emailVerified:false});created=true;}
   catch(error){if(error.code!=='auth/email-already-exists')throw error;account=await auth.getUserByEmail(email);}
  }
  if(account.disabled)return res.status(409).json({error:'Ce compte est suspendu. Vérifie ses droits avant de le réinviter.'});
  // Never replace an existing accreditation when an administrator resends an invite.
  await members.child(account.uid).transaction(current=>current||{email,role:ROOT_ADMINS.includes(account.uid)?'admin':'reservations',updatedBy:actor.uid,updatedAt:Date.now()});
  return res.status(200).json({uid:account.uid,created});
 }catch{return res.status(503).json({error:'Création du compte indisponible. Vérifie le déploiement du service Firebase puis réessaie.'});}
};
