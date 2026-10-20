const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let handler,attemptCount=0;const tokens=[];
const fakeAdmin={transaction:async fn=>{const out=fn(attemptCount?{start:Date.now(),count:attemptCount}:null);if(!out)return {committed:false};attemptCount=out.count;return {committed:true};}};
const modules={
 'firebase-functions/v2/https':{onRequest:(options,fn)=>(handler=fn)},
 'firebase-functions/params':{defineSecret:name=>({value:()=>name==='BLANCKAERT_ACCESS_CODE'?'1111':'2222'})},
 'firebase-admin/app':{initializeApp(){}},
 'firebase-admin/auth':{getAuth:()=>({createCustomToken:async(id,claims)=>{tokens.push({id,claims});return 'test-token';}})},
 'firebase-admin/database':{getDatabase:()=>({ref:()=>fakeAdmin})},
 'node:crypto':require('node:crypto')
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../functions/index.js'),'utf8'),{require:id=>modules[id],exports:{},Buffer,Date});
async function call(code){const result={status:200};const res={set(){},status(n){result.status=n;return this;},json(v){result.body=v;return this;}};await handler({method:'POST',body:{code},ip:'127.0.0.1'},res);return result;}
(async()=>{assert.equal((await call('0000')).status,401);assert.equal((await call('1111')).status,200);assert.equal(tokens.at(-1).claims.operator,'Antonin Blanckaert');assert.equal((await call('2222')).status,200);assert.equal(tokens.at(-1).claims.operator,'Antonin Bassut');assert.equal((await call('x')).status,401);attemptCount=10;assert.equal((await call('1111')).status,429);console.log('PASS: server code refusal, automatic identity for both organizers, malformed code, rate limit.');})().catch(e=>{console.error(e);process.exit(1)});
