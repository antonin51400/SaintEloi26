const assert=require('node:assert/strict');
const {inviteUserHandler}=require('../functions/invite-user');
const rootUid='nCNc0JdWznOZ6j4B4GjfvQqWX4K2';
let actor={uid:rootUid,firebase:{sign_in_provider:'password'}},account=null,creates=0;
const members={};
const ref=key=>({child:id=>ref(key+'/'+id),once:async()=>({val:()=>members[key]}),transaction:async update=>{members[key]=update(members[key]||null);}});
const handler=inviteUserHandler({auth:{verifyIdToken:async()=>actor,getUserByEmail:async()=>{if(!account)throw {code:'auth/user-not-found'};return account;},createUser:async data=>{creates++;assert.ok(data.password.length>=32);return account={uid:'new-uid',email:data.email};}},database:{ref},randomPassword:()=> 'a'.repeat(40)});
async function request(headers={authorization:'Bearer token'},email='Camille@example.fr'){
 const res={code:200,set(){},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
 await handler({method:'POST',headers,body:{email}},res);return res;
}
(async()=>{
 assert.equal((await request({})).code,401);
 actor={uid:'staff',firebase:{sign_in_provider:'password'}};assert.equal((await request()).code,403);assert.equal(creates,0);
 actor={uid:rootUid,firebase:{sign_in_provider:'password'}};
 assert.equal((await request(undefined,'not-email')).code,400);
 const result=await request();assert.equal(result.code,200);assert.equal(result.body.created,true);assert.equal(creates,1);
 const key='events/saint-eloi-2026/members/new-uid';assert.equal(members[key].role,'reservations');
 members[key].role='placement';assert.equal((await request()).code,200);assert.equal(creates,1);assert.equal(members[key].role,'placement');
 account.disabled=true;assert.equal((await request()).code,409);
 console.log('PASS: invite authorization, email validation, account creation, retry and preservation of roles');
})().catch(error=>{console.error(error);process.exitCode=1;});
