import {ITEMS,type SaveState} from './model.ts';
import {isFurniture} from './furniture-rules.ts';
import {GHOST_CARRIAGE} from './carriage-pose.ts';
import {t} from './i18n.ts';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function decorationControls(s:SaveState,uid:string,readOnly=false){
 const d=s.decorations.find(d=>d.uid===uid);if(!d||readOnly)return '';
 return `<div class="button-row"><button class="soft-button" data-action="edit-decor" data-uid="${esc(uid)}">✎ Chỉnh sửa / Đặt lại</button><button class="soft-button" data-action="pack-decor" data-uid="${esc(uid)}">📦 ${t('Pack away')}</button></div>${d.fish?.length?'<p class="fineprint">Cất bể sẽ trả cả bể và cá vào túi đồ.</p>':''}`;
}
export function decorationPanel(s:SaveState,uid:string,art:(id:string,icon:string)=>string,readOnly=false){
 const d=s.decorations.find(d=>d.uid===uid);if(!d)return '';
 const use=isFurniture(d.id)?d.id==='deco_cursed_coffin'?'Lie in coffin':'Sit on bench':d.id===GHOST_CARRIAGE&&!readOnly?'Board carriage':null;
 return `<div class="grow-illustration">${art(d.id,ITEMS[d.id].icon??'🏡')}</div>${use?`<button class="primary wide" data-action="use-decor" data-uid="${esc(uid)}">${t(use)}</button>`:''}${decorationControls(s,uid,readOnly)}${readOnly&&!use?'<p class="intro">Chỉ chủ sân mới được chỉnh sửa đồ trang trí.</p>':''}`;
}
