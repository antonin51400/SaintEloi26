const fs=require('fs'),assert=require('node:assert/strict');
const rules=JSON.parse(fs.readFileSync('database.rules.managed-users.json','utf8')).rules;
function snap(tree,path=[]){const value=path.reduce((v,k)=>v?.[k],tree);return {val:()=>value??null,exists:()=>value!=null,isNumber:()=>typeof value==='number',isString:()=>typeof value==='string',isBoolean:()=>typeof value==='boolean',hasChildren:keys=>keys?keys.every(key=>value?.[key]!=null):value&&Object.keys(value).length>0,child:key=>snap(tree,[...path,...key.split('/')]),parent:()=>snap(tree,path.slice(0,-1))};}
const data=rules.events['saint-eloi-2026'].data,person=data.reservations.$id.participants.$pid;
function evaluate(formula,{role='admin',value=null,path=[],oldValue=value,uid='staff'}={}){
 const root={events:{'saint-eloi-2026':{members:{[uid]:{role}}}}};
 return Function('auth','root','data','newData','return ('+formula+');')({uid,provider:'password'},snap(root),snap(oldValue,path),snap(value,path));
}
for(const role of ['reservations','placement','entry','viewer','disabled']){
 assert.equal(evaluate(data.layout['.write'],{role}),false,role+' cannot edit layout');
 assert.equal(evaluate(data.tables['.write'],{role}),false,role+' cannot change capacity');
}
assert.equal(evaluate(data.layout['.write']),true);assert.equal(evaluate(data.tables['.write']),true);
for(const value of [1,6,8,50])assert.equal(evaluate(data.tables.$id.capacity['.validate'],{value}),true);
for(const value of [0,51,2.5,'8',null])assert.equal(evaluate(data.tables.$id.capacity['.validate'],{value}),false);
const tree=cap=>({tables:{tcustom:{capacity:cap}},layout:{tables:{tcustom:{name:'Table',row:1,column:1,side:'left'}}},reservations:{r1:{participants:{p1:{name:'Camille',tableId:'tcustom',seat:7,arrived:false,paid:false}}}}});
const path=['reservations','r1','participants','p1','seat'];
assert.equal(evaluate(person.seat['.validate'],{role:'placement',value:tree(8),path}),true);
assert.equal(evaluate(person.seat['.validate'],{role:'placement',value:tree(6),path}),false);
const invalid=tree(8);invalid.reservations.r1.participants.p1.seat=9;
assert.equal(evaluate(person.seat['.validate'],{role:'admin',value:invalid,path}),false);
console.log('PASS: admin-only layout/capacities, capacity bounds and server seat capacity expressions');
