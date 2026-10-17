import {aquarium,fishFits} from './aquarium.ts';
import {ITEMS,FISH,type SaveState} from './model.ts';
import {t} from './i18n.ts';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function aquariumPanel(s:SaveState,uid:string,art:(id:string,icon:string)=>string){
 const tank=s.decorations.find(d=>d.uid===uid),spec=tank&&aquarium(tank.id);if(!tank||!spec)return '';
 const fish=tank.fish??[],full=fish.length>=spec.capacity,classes=['cá nhỏ (<50 cm)','cá nhỏ và vừa (tối đa 150 cm)','mọi cỡ cá'];
 const eligible=Object.entries(s.bag).filter(([id,n])=>(n??0)>0&&fishFits(tank.id,id));
 const row=(id:string,label:string,button:string)=>`<div class="shop-item"><span class="shop-icon">${art(id,ITEMS[id].icon)}</span><div><strong>${esc(t(ITEMS[id].name))}</strong><small>${esc(label)}</small></div>${button}</div>`;
 return `<p class="intro">${fish.length} / ${spec.capacity} con · Nhận ${classes[spec.maxClass]}. Phân loại theo kích thước tối đa của loài.</p>${full?'<p class="intro" role="status">Bể đã đầy. Hãy bắt một con cá ra trước.</p>':''}<div class="section-label">CÁ TRONG BỂ</div><div class="shop-grid">${fish.map((f,i)=>row(f.id,`${f.size} cm`,`<button class="soft-button" data-action="take-aquarium-fish" data-uid="${esc(uid)}" data-index="${i}">Bắt ra</button>`)).join('')||'<p class="muted">Bể chưa có cá.</p>'}</div><div class="section-label">CÁ TRONG TÚI — ĐÚNG CỠ BỂ</div><div class="shop-grid">${eligible.map(([id,n])=>row(id,`×${n} · Loài tối đa ${FISH[id].size[1]} cm`,`<button class="primary" data-action="put-aquarium-fish" data-uid="${esc(uid)}" data-item="${id}" ${full?'disabled':''}>Thả vào</button>`)).join('')||'<p class="muted">Trong túi chưa có cá phù hợp với cỡ bể này.</p>'}</div>`;
}
