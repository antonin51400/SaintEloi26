const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const helpers=source.slice(source.indexOf('function membersFor('),source.indexOf('let tableCapacitySyncRunning'));
const group=source.slice(source.indexOf('async function placeGroupRestricted('),source.indexOf("$('placementForm').onsubmit="));
const live={reservations:{r:{status:'accepted',participants:{a:{name:'Alice',tableId:'old',seat:1,paid:true,arrived:true},b:{name:'Bob',tableId:'',seat:0,paid:false,arrived:false}}},other:{status:'accepted',participants:{c:{tableId:'target',seat:1}}}}};
let changes;
const c={ready:true,user:{uid:'placement'},online:true,busy:false,requireAccess(){},notice(){},clone:structuredClone,capacity:()=>6,accepted:data=>Object.entries(data.reservations).flatMap(([rid,r])=>Object.entries(r.participants).map(([pid,p])=>({rid,pid,...p}))),validateData(data){const seats=new Set;for(const p of c.accepted(data)){if(!p.tableId)continue;const key=p.tableId+'/'+p.seat;assert(!seats.has(key));seats.add(key)}},dataRef:{once:async()=>({val:()=>structuredClone(live)}),update:async x=>{changes=x}}};
vm.createContext(c);vm.runInContext(helpers+group,c);
(async()=>{
 await c.placeGroupRestricted({rid:'r'},'target');
 assert.deepEqual(JSON.parse(JSON.stringify(changes)),{'reservations/r/participants/a/tableId':'target','reservations/r/participants/a/seat':2,'reservations/r/participants/b/tableId':'target','reservations/r/participants/b/seat':3});
 assert.equal(live.reservations.r.participants.a.arrived,true);assert.equal(c.busy,false);
 await c.placeGroupRestricted({rid:'r'},'');assert.equal(changes['reservations/r/participants/a/seat'],0);
 c.capacity=()=>2;changes=null;await assert.rejects(()=>c.placeGroupRestricted({rid:'r'},'target'),/assez de places/);assert.equal(changes,null);assert.equal(c.busy,false);
 c.online=false;await assert.rejects(()=>c.placeGroupRestricted({rid:'r'},'target'),/Connexion/);
 assert(source.includes("allowed('place')&&r.status==='accepted'?`<button"));
 assert(!source.includes("shownRole()==='placement'&&!selection?.pid"));
 console.log('PASS: réservation complète, places libres, retrait, capacité, connexion, conservation paiement et arrivée.');
})().catch(e=>{console.error(e);process.exit(1)});
