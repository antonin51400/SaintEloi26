'use strict';
const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const {initializeApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getDatabase} = require('firebase-admin/database');
const {createHash, timingSafeEqual} = require('node:crypto');
initializeApp();
const {inviteUserHandler}=require('./invite-user');
const {randomBytes}=require('node:crypto');
exports.inviteUser=onRequest({region:'europe-west1',cors:['https://antonin51400.github.io'],maxInstances:3},inviteUserHandler({
  auth:getAuth(),database:getDatabase(),randomPassword:()=>randomBytes(32).toString('base64url')
}));
const blanckaertCode = defineSecret('BLANCKAERT_ACCESS_CODE');
const bassutCode = defineSecret('BASSUT_ACCESS_CODE');
function equal(a,b){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
exports.accessByCode = onRequest({region:'europe-west1',cors:true,secrets:[blanckaertCode,bassutCode],maxInstances:3},async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'method'});
  const code=req.body?.code;
  if(typeof code!=='string'||!/^\d{4}$/.test(code))return res.status(401).json({error:'code'});
  try {
    const first=blanckaertCode.value(),second=bassutCode.value();
    if(!/^\d{4}$/.test(first)||!/^\d{4}$/.test(second)||first===second)return res.status(503).json({error:'configuration'});
    // Shared database counter across instances. No codes or raw IPs stored.
    const key=createHash('sha256').update(String(req.ip||'unknown')).digest('hex');
    const now=Date.now(),windowMs=15*60*1000;
    const attempts=await getDatabase().ref('accessAttempts/'+key).transaction(current=>{
      const value=!current||now-current.start>=windowMs?{start:now,count:0}:current;
      if(value.count>=10)return;
      return {start:value.start,count:value.count+1};
    });
    if(!attempts.committed)return res.status(429).json({error:'rate-limit'});
    let id,operator;
    if(equal(code,first)){id='antonin-blanckaert';operator='Antonin Blanckaert';}
    else if(equal(code,second)){id='antonin-bassut';operator='Antonin Bassut';}
    else return res.status(401).json({error:'code'});
    const token=await getAuth().createCustomToken(id,{saintEloi2026:true,operator});
    return res.status(200).json({token});
  }catch(error){return res.status(503).json({error:'unavailable'});}
});
