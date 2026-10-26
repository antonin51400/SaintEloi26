'use strict';
// Stable IDs keep every existing guest attached to their table when it moves.
const DEFAULT_PLAN_HTML=document.querySelector('.table-rows').innerHTML;
const DEFAULT_PLAN={revision:0,rows:document.querySelectorAll('.table-rows > .table-row').length,leftColumns:3,rightColumns:3,tables:{}};
document.querySelectorAll('.table-rows > .table-row').forEach((row,r)=>{
 row.querySelectorAll('.table-group').forEach((group,s)=>group.querySelectorAll('.table-block').forEach((el,c)=>{
  DEFAULT_PLAN.tables[el.id]={name:el.dataset.table,row:r+1,column:c+1,side:s?'right':'left'};
 }));
});
let renderedPlan='default',planDraft=null,planDraftCapacities={},planBase='',selectedPlanTable=null,draggedPlanTable=null;
function layoutFor(data){return data?.layout||DEFAULT_PLAN;}
function planSnapshot(data){const p=layoutFor(data);return JSON.stringify([p.revision,p.rows,p.leftColumns,p.rightColumns,Object.keys(p.tables||{}).sort().map(id=>[id,p.tables[id].name,p.tables[id].row,p.tables[id].column,p.tables[id].side,capacity(id,data)])]);}
function validatePlan(p){
 const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 if(!p||!integer(p.rows,1,30)||!integer(p.leftColumns,1,12)||!integer(p.rightColumns,1,12)||!integer(p.revision,0,1000000000))throw Error('Plan invalide : 1 à 30 lignes et 1 à 12 colonnes par côté.');
 const ids=Object.keys(p.tables||{}),positions=new Set();
 if(!ids.length||ids.length>200)throw Error('Le plan doit contenir entre 1 et 200 tables.');
 for(const id of ids){const t=p.tables[id];
  if(!/^t[A-Za-z0-9_-]{1,80}$/.test(id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>80||!['left','right'].includes(t.side)||!integer(t.row,1,p.rows)||!integer(t.column,1,t.side==='left'?p.leftColumns:p.rightColumns))throw Error('Nom ou position de table invalide.');
  const key=[t.row,t.side,t.column].join(':');if(positions.has(key))throw Error('Deux tables occupent le même emplacement.');positions.add(key);
 }
}
function syncPlanFromState(){
 const signature=state.layout?JSON.stringify(state.layout):'default';if(signature===renderedPlan)return;
 const p=layoutFor(state);validatePlan(p);
 const container=document.querySelector('.table-rows');
 if(!state.layout){container.innerHTML=DEFAULT_PLAN_HTML;container.classList.remove('custom-plan');}
 else{
  container.replaceChildren();container.classList.add('custom-plan');
  container.style.setProperty('--plan-left-columns',p.leftColumns);container.style.setProperty('--plan-right-columns',p.rightColumns);
  for(let row=1;row<=p.rows;row++){
   const line=document.createElement('div');line.className='table-row';
   for(const side of ['left','right']){
    if(side==='right'){const aisle=document.createElement('div');aisle.className='room-divider';line.append(aisle);}
    const group=document.createElement('div');group.className='table-group '+side;
    const columns=side==='left'?p.leftColumns:p.rightColumns;
    for(let col=1;col<=columns;col++){
     const entry=Object.entries(p.tables).find(([,t])=>t.row===row&&t.column===col&&t.side===side);
     const el=document.createElement('div');
     if(entry){const [id,t]=entry;el.className='table-block';el.id=id;el.dataset.table=t.name;
      el.innerHTML='<div class="t-number">'+esc(t.name)+'</div><div class="t-name"></div><div class="t-guests" id="occ-'+id+'"></div><div class="t-progress-wrap"><div class="t-progress-fill"></div><div class="t-progress-label"></div></div>';
     }else{el.className='plan-space';el.setAttribute('aria-hidden','true');}
     group.append(el);
    }
    line.append(group);
   }
   container.append(line);
  }
 }
 tableElements=[...document.querySelectorAll('.table-block')];tableNames=Object.fromEntries(tableElements.map(el=>[el.id,el.dataset.table]));
 tableElements.forEach(bindTableElement);renderedPlan=signature;
 if(popupTable&&!tableNames[popupTable])closeTablePopup();
}
function draftTableAt(row,side,column){return Object.entries(planDraft.tables).find(([,t])=>t.row===row&&t.side===side&&t.column===column);}
function openPlanEditor(){
 requireAccess('layout');if(!ready)throw Error('Attends la fin du chargement du plan.');
 selection=null;closeTablePopup();
 planDraft=clone(layoutFor(state));planDraftCapacities=Object.fromEntries(Object.keys(planDraft.tables).map(id=>[id,capacity(id)]));
 planBase=planSnapshot(state);selectedPlanTable=null;
 $('planRows').value=planDraft.rows;$('planLeft').value=planDraft.leftColumns;$('planRight').value=planDraft.rightColumns;$('planDefaultCapacity').value=6;
 $('planError').textContent='';renderPlanRows();renderPlanEditor();$('planDialog').showModal();
}
function renderPlanRows(){
 $('planRowCounts').innerHTML=Array.from({length:planDraft.rows},(_,r)=>'<div class="plan-row-count"><strong>Ligne '+(r+1)+'</strong><label>À gauche<input type="number" min="0" max="12" value="'+Object.values(planDraft.tables).filter(t=>t.row===r+1&&t.side==='left').length+'" data-row="'+(r+1)+'" data-side="left"></label><label>À droite<input type="number" min="0" max="12" value="'+Object.values(planDraft.tables).filter(t=>t.row===r+1&&t.side==='right').length+'" data-row="'+(r+1)+'" data-side="right"></label></div>').join('');
}
function ensureDraftRemovalAllowed(ids){
 const occupied=allGuests().filter(p=>ids.includes(p.tableId));
 if(occupied.length)throw Error('Une table à retirer contient encore des invités. Déplace-les vers une autre table avant de la supprimer.');
}
function applyPlanCounts(counts,rows){
 requireAccess('layout');const next=clone(planDraft),caps={...planDraftCapacities};
 if(!Number.isInteger(rows)||rows<1||rows>30)throw Error('Choisis entre 1 et 30 lignes.');
 const requested=counts.reduce((n,r)=>n+r.left+r.right,0);
 if(requested<1||requested>200||counts.some(r=>!Number.isInteger(r.left)||!Number.isInteger(r.right)||r.left<0||r.right<0||r.left>12||r.right>12))throw Error('Choisis 0 à 12 tables par côté et entre 1 et 200 tables au total.');
 const defaultCap=Number($('planDefaultCapacity').value);if(!Number.isInteger(defaultCap)||defaultCap<1||defaultCap>50)throw Error('La capacité doit être comprise entre 1 et 50 personnes.');
 const removed=Object.keys(next.tables).filter(id=>{const t=next.tables[id];return t.row>rows||t.column>counts[t.row-1][t.side];});
 ensureDraftRemovalAllowed(removed);removed.forEach(id=>{delete next.tables[id];delete caps[id];});
 next.rows=rows;next.leftColumns=Math.max(1,...counts.map(r=>r.left));next.rightColumns=Math.max(1,...counts.map(r=>r.right));
 for(let row=1;row<=rows;row++)for(const side of ['left','right'])for(let col=1;col<=counts[row-1][side];col++){
  if(Object.values(next.tables).some(t=>t.row===row&&t.side===side&&t.column===col))continue;
  const id='t'+uid();let number=1;while(Object.values(next.tables).some(t=>t.name==='Table '+number))number++;
  next.tables[id]={name:'Table '+number,row,side,column:col};caps[id]=defaultCap;
 }
 validatePlan(next);planDraft=next;planDraftCapacities=caps;selectedPlanTable=null;renderPlanRows();renderPlanEditor();
}
function moveDraftTable(id,row,side,column){
 requireAccess('layout');const t=planDraft.tables[id];if(!t)return;
 const other=draftTableAt(row,side,column);const old={row:t.row,side:t.side,column:t.column};
 Object.assign(t,{row,side,column});if(other&&other[0]!==id)Object.assign(other[1],old);
 selectedPlanTable=id;renderPlanRows();renderPlanEditor();
}
function renderPlanEditor(){
 $('planSummary').textContent=Object.keys(planDraft.tables).length+' tables · '+Object.values(planDraftCapacities).reduce((a,b)=>a+b,0)+' places';
 $('planCanvas').style.setProperty('--plan-editor-left',planDraft.leftColumns);$('planCanvas').style.setProperty('--plan-editor-right',planDraft.rightColumns);
 $('planCanvas').innerHTML='<div class="plan-scene">🎵 Scène</div>'+Array.from({length:planDraft.rows},(_,r)=>'<div class="plan-editor-row">'+['left','right'].map(side=>'<div class="plan-editor-side '+side+'">'+Array.from({length:side==='left'?planDraft.leftColumns:planDraft.rightColumns},(_,c)=>{
  const entry=draftTableAt(r+1,side,c+1);
  return '<button type="button" class="plan-cell '+(entry?'occupied':'empty')+(entry&&entry[0]===selectedPlanTable?' selected':'')+'" data-plan-row="'+(r+1)+'" data-plan-side="'+side+'" data-plan-column="'+(c+1)+'"'+(entry?' draggable="true" data-plan-id="'+entry[0]+'"':'')+' aria-label="Ligne '+(r+1)+', '+(side==='left'?'gauche':'droite')+', colonne '+(c+1)+(entry?', '+esc(entry[1].name):', emplacement libre')+'">'+(entry?'<strong>'+esc(entry[1].name)+'</strong><small>'+planDraftCapacities[entry[0]]+' places</small>':'+')+'</button>';
 }).join('')+'</div>').join('<div class="plan-aisle">Allée</div>')+'</div>').join('');
 const selected=planDraft.tables[selectedPlanTable];$('planSelected').hidden=!selected;
 if(selected){$('planTableName').value=selected.name;$('planTableCapacity').value=planDraftCapacities[selectedPlanTable];$('planSelectedTitle').textContent=selected.name;}
}
document.getElementById('editPlanButton').onclick=()=>{try{openPlanEditor();}catch(e){notice(e.message);}};
document.getElementById('planGenerate').onclick=()=>{try{
 const rows=Number($('planRows').value),left=Number($('planLeft').value),right=Number($('planRight').value);
 if(!Number.isInteger(rows)||rows<1||rows>30)throw Error('Choisis entre 1 et 30 lignes.');
 applyPlanCounts(Array.from({length:rows},()=>({left,right})),rows);$('planError').textContent='';
}catch(e){$('planError').textContent=e.message;}};
document.getElementById('planApplyRows').onclick=()=>{try{
 const counts=Array.from({length:planDraft.rows},(_,r)=>Object.fromEntries(['left','right'].map(side=>[side,Number($('planRowCounts').querySelector('[data-row="'+(r+1)+'"][data-side="'+side+'"]').value)])));
 applyPlanCounts(counts,planDraft.rows);$('planError').textContent='';
}catch(e){$('planError').textContent=e.message;}};
document.getElementById('planCanvas').onclick=e=>{try{
 requireAccess('layout');const b=e.target.closest('[data-plan-row]');if(!b)return;
 const row=Number(b.dataset.planRow),side=b.dataset.planSide,column=Number(b.dataset.planColumn);
 if(b.dataset.planId){selectedPlanTable=selectedPlanTable===b.dataset.planId?null:b.dataset.planId;renderPlanEditor();}
 else if(selectedPlanTable)moveDraftTable(selectedPlanTable,row,side,column);
 else{
  if(Object.keys(planDraft.tables).length>=200)throw Error('Le plan est limité à 200 tables.');
  const cap=Number($('planDefaultCapacity').value);if(!Number.isInteger(cap)||cap<1||cap>50)throw Error('Capacité invalide.');
  const id='t'+uid();let number=1;while(Object.values(planDraft.tables).some(t=>t.name==='Table '+number))number++;
  planDraft.tables[id]={name:'Table '+number,row,side,column};planDraftCapacities[id]=cap;selectedPlanTable=id;renderPlanRows();renderPlanEditor();
 }
 $('planError').textContent='';
}catch(error){$('planError').textContent=error.message;}};
document.getElementById('planCanvas').ondragstart=e=>{e.stopPropagation();const b=e.target.closest('[data-plan-id]');if(!b)return;draggedPlanTable=b.dataset.planId;e.dataTransfer.setData('text/plain',draggedPlanTable);e.dataTransfer.effectAllowed='move';};
document.getElementById('planCanvas').ondragend=()=>{draggedPlanTable=null;};
document.getElementById('planCanvas').ondragover=e=>{if(e.target.closest('[data-plan-row]'))e.preventDefault();};
document.getElementById('planCanvas').ondrop=e=>{e.preventDefault();e.stopPropagation();const b=e.target.closest('[data-plan-row]');if(!b||!draggedPlanTable)return;try{moveDraftTable(draggedPlanTable,Number(b.dataset.planRow),b.dataset.planSide,Number(b.dataset.planColumn));}catch(error){$('planError').textContent=error.message;}draggedPlanTable=null;};
document.getElementById('planUpdateTable').onclick=()=>{try{
 requireAccess('layout');if(!selectedPlanTable)return;
 const name=$('planTableName').value.trim(),cap=Number($('planTableCapacity').value);
 if(!name||name.length>80||!Number.isInteger(cap)||cap<1||cap>50)throw Error('Indique un nom et une capacité de 1 à 50 personnes.');
 if(allGuests().some(p=>p.tableId===selectedPlanTable&&p.seat>cap))throw Error('Des invités occupent des places au-delà de cette capacité. Déplace-les avant de réduire la table.');
 planDraft.tables[selectedPlanTable].name=name;planDraftCapacities[selectedPlanTable]=cap;renderPlanEditor();$('planError').textContent='';
}catch(error){$('planError').textContent=error.message;}};
document.getElementById('planRemoveTable').onclick=()=>{try{
 requireAccess('layout');if(!selectedPlanTable)return;
 if(Object.keys(planDraft.tables).length===1)throw Error('Conserve au moins une table.');
 ensureDraftRemovalAllowed([selectedPlanTable]);delete planDraft.tables[selectedPlanTable];delete planDraftCapacities[selectedPlanTable];selectedPlanTable=null;renderPlanRows();renderPlanEditor();$('planError').textContent='';
}catch(error){$('planError').textContent=error.message;}};
document.getElementById('planSave').onclick=async()=>{
 try{
  requireAccess('layout');validatePlan(planDraft);
  const draft=clone(planDraft),caps={...planDraftCapacities},base=planBase;
  $('planDialog').querySelectorAll('button,input').forEach(el=>el.disabled=true);
  await mutate(data=>{
   if(planSnapshot(data)!==base)throw Error('Le plan a été modifié par un autre administrateur. Ferme et rouvre l’éditeur.');
   for(const p of allGuests(data))if(p.tableId&&(!draft.tables[p.tableId]||p.seat>caps[p.tableId]))throw Error('Un invité occupe une table ou une place à retirer. Déplace-le avant de modifier le plan.');
   data.layout={...draft,revision:(data.layout?.revision||0)+1};
   data.tables=Object.fromEntries(Object.keys(draft.tables).map(id=>[id,{capacity:caps[id]}]));
  });
  $('planDialog').close();notice('Plan et capacités enregistrés pour toutes les vues.');
 }catch(error){$('planError').textContent=error.message;}
 finally{$('planDialog').querySelectorAll('button,input').forEach(el=>el.disabled=false);}
};
