import type { SaveState } from './model.ts';
import { ITEMS } from './content.ts';
import { t } from './i18n.ts';
import { HALLOWEEN_GACHA, HALLOWEEN_PRIZES, HALLOWEEN_WEIGHT, type HalloweenPrize, type HalloweenDraw, type HalloweenReward } from './halloween-gacha-config.ts';
import './halloween-gacha.css';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const text = (s: string, params?: Record<string, string | number>) => esc(t(s, params));
const name = (id: string) => id === 'energy' ? t('Energy') : t(ITEMS[id].name);
const prizeOf = (id: string) => HALLOWEEN_PRIZES.find(p => p.id === id)!;
const percent = (p: HalloweenPrize) => `${Number((p.weight / HALLOWEEN_WEIGHT * 100).toFixed(2))}%`;
/** Lightweight vector pumpkin, with a separate lid: no additional WebGL context or per-frame allocations. */
export const gachaPumpkin = `<svg class="gacha-pumpkin" viewBox="0 0 300 280" aria-hidden="true"><defs><linearGradient id="gacha-orange" x2=".3" y2="1"><stop stop-color="#ffcb57"/><stop offset=".5" stop-color="#f78924"/><stop offset="1" stop-color="#bc401b"/></linearGradient><radialGradient id="gacha-magic"><stop stop-color="#fff2b2"/><stop offset="1" stop-color="#d69aff" stop-opacity="0"/></radialGradient></defs><ellipse cx="150" cy="254" rx="101" ry="13" fill="#190d32" opacity=".3"/><ellipse class="gacha-pumpkin-glow" cx="150" cy="151" rx="143" ry="120" fill="url(#gacha-magic)"/><g class="gacha-pumpkin-body" fill="url(#gacha-orange)" stroke="#c85b24" stroke-width="2"><ellipse cx="150" cy="172" rx="113" ry="78"/><ellipse cx="150" cy="172" rx="83" ry="79"/><ellipse cx="150" cy="172" rx="43" ry="79"/><path d="m76 159 37-23 8 29z m148 0-37-23-8 29z M96 190l20 7 5-9 18 13 12-8 13 9 18-15 4 10 19-7-12 29-21-5-14 9-19-9-15 7-20-7z" fill="#ffed8e" stroke="#aa481e" stroke-width="4"/></g><g class="gacha-pumpkin-lid"><path d="M53 113Q150 65 247 113l-20 20-18-8-20 13-20-10-19 11-20-11-22 9-19-13-20 7z" fill="url(#gacha-orange)" stroke="#b95523" stroke-width="3"/><path d="M138 89q-4-35 15-50l21 8q-21 15-17 43" fill="#617b49" stroke="#334d39" stroke-width="4"/><path d="M165 63q29-32 48-13-13 28-46 21" fill="#91ae57" stroke="#516e3d" stroke-width="3"/><path d="m100 104 32-10m38 0 29 10" stroke="#ffe094" stroke-width="5" stroke-linecap="round"/></g><g fill="#fff4ba"><path d="m37 79 4 11 11 4-11 4-4 11-4-11-11-4 11-4z"/><path d="m258 163 3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/></g></svg>`;
interface Options { state: () => SaveState; draw: (count: 1 | 10) => Promise<HalloweenDraw | undefined>; art: (id: string, icon: string) => string }
/** Presentation only. The shared action/server commits the whole batch before any pumpkin opens. */
export class HalloweenGachaPanel {
  private host: HTMLElement | null = null;
  private owner: SaveState | null = null;
  private busy = false;
  private phase: 'shop' | 'ready' | 'opening' | 'reward' | 'summary' = 'shop';
  private selected: HalloweenPrize | null = null;
  private receipt: HalloweenDraw | null = null;
  private index = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private options: Options) {}
  mount(host: HTMLElement) {
    this.unmount();
    const state = this.options.state(), last = state.halloweenGacha?.last;
    if (this.owner !== state || this.receipt && (this.receipt.total !== last?.total || this.receipt.at !== last?.at)) { this.owner = state; this.phase = 'shop'; this.receipt = null; }
    this.host = host; host.addEventListener('click', this.click); this.render();
  }
  unmount() {
    this.host?.removeEventListener('click', this.click); this.host = null;
    clearTimeout(this.timer); this.timer = undefined;
    if (this.phase === 'opening') this.phase = 'ready';
  }
  private icon(id: string) { return id === 'energy' ? '⚡' : this.options.art(id, ITEMS[id].icon); }
  private rarity(p: HalloweenPrize) { return text(p.rarity === 'purple' ? 'PURPLE · RARE' : 'BLUE'); }
  private progress() {
    const s = this.options.state().halloweenGacha, misses = s?.misses ?? 0;
    return `<div class="gacha-guarantee"><div><b>🎣 ${text('Rod guarantee')}</b><span>${misses} / ${HALLOWEEN_GACHA.rodPity}</span></div><progress max="${HALLOWEEN_GACHA.rodPity}" value="${misses}" aria-label="${text('Rod guarantee')}"></progress><small>${text('At most {count} more draws for the sealed key rod.', { count: HALLOWEEN_GACHA.rodPity - misses })}</small></div>`;
  }
  private card(r: HalloweenReward, i: number) {
    const p = prizeOf(r.id);
    return `<div class="gacha-result-card ${p.rarity}" data-reward="${r.id}"><span class="gacha-art">${this.icon(r.id)}</span><b>${esc(name(r.id))}</b><small>×${r.count.toLocaleString()}${r.fresh ? ` · ${text('NEW')}` : ''}</small>${r.guaranteed ? `<em>${text('GUARANTEED')}</em>` : ''}<small>${text(r.destination === 'chest' ? 'Sent to chest' : r.destination === 'energy' ? 'Energy added' : 'Added to backpack')}</small><span class="gacha-number">${i + 1}</span></div>`;
  }
  private render() {
    if (!this.host) return;
    const s = this.options.state(), last = s.halloweenGacha?.last;
    let body: string;
    if (this.phase === 'shop' || !this.receipt) {
      const selected = this.selected;
      const preview = selected ? `<div class="gacha-feature ${selected.rarity}"><span class="gacha-art">${this.icon(selected.id)}</span><strong>${esc(name(selected.id))}</strong><small>${this.rarity(selected)} · ${percent(selected)}${selected.id === 'energy' ? ' · ×1.000' : ''}</small><p>${selected.id === 'energy' ? text('A bundle of 1,000 energy.') : text(ITEMS[selected.id].desc ?? '')}</p><button class="gacha-link" data-gacha="pumpkin">${text('View pumpkin')}</button></div>` : `<div class="gacha-pumpkin-idle">${gachaPumpkin}<strong>${text('A little pumpkin. A big surprise.')}</strong><small>${text('Select any reward to preview it.')}</small></div>`;
      body = `<div class="gacha-layout"><div class="gacha-stage">${preview}</div><section class="gacha-pool" aria-label="${text('Rewards and drop rates')}">${HALLOWEEN_PRIZES.map(p => `<button class="gacha-prize ${p.rarity}${selected?.id === p.id ? ' selected' : ''}" data-gacha="preview" data-prize="${p.id}" aria-pressed="${selected?.id === p.id}" aria-label="${esc(name(p.id))} · ${percent(p)}"><span class="gacha-art">${this.icon(p.id)}</span><b>${esc(name(p.id))}${p.id === 'energy' ? ' ×1.000' : ''}</b><small>${this.rarity(p)}</small><span class="gacha-rate">${percent(p)}</span></button>`).join('')}</section></div>${this.progress()}<div class="gacha-wallet">⚡ ${text('Energy')}: <b>${s.energy.toLocaleString()}</b> · ${text('Total draws')}: ${s.halloweenGacha?.total ?? 0}</div><div class="gacha-buy">${([1, 10] as const).map(n => `<button class="${n === 10 ? 'primary' : 'sky-button'}" data-gacha="draw" data-count="${n}" ${this.busy || s.energy < n * HALLOWEEN_GACHA.cost ? 'disabled' : ''}>${text(n === 1 ? 'Draw once' : 'Draw ten')}<span>⚡ ${(n * HALLOWEEN_GACHA.cost).toLocaleString()}</span></button>`).join('')}</div>${this.busy ? `<p class="gacha-note" role="status">${text('Confirming draw… Your result is saved before opening.')}</p>` : ''}<details class="gacha-rules"><summary>${text('Rates and guarantee rules')}</summary><p>${text('Rates above total 100% on ordinary draws. Each draw is independent; duplicate rewards are kept.')}</p><p>${text('After 149 draws without the sealed key rod, the next draw guarantees it. Winning the rod resets only this counter; a ten-draw batch follows the same rule.')}</p><p>${text('Rewards are saved immediately. A full backpack sends items to your chest. Closing the screen does not cancel a paid draw.')}</p></details>${last ? `<button class="gacha-link" data-gacha="history" ${this.busy ? 'disabled' : ''}>${text('View last result')} · ${text('Draws {from}–{to}', { from: last.total - last.rewards.length + 1, to: last.total })}</button>` : ''}`;
    } else if (this.phase === 'ready' || this.phase === 'opening') {
      const opening = this.phase === 'opening';
      body = `<div class="gacha-open-stage${opening ? ' opening' : ''}"><span class="gacha-count">🎃 ${this.receipt.rewards.length - this.index}</span><button class="gacha-open-button" data-gacha="open" ${opening ? 'disabled' : ''} aria-label="${text('Tap to open')}">${gachaPumpkin}</button><h3>${text(opening ? 'Opening pumpkin…' : 'Tap to open')}</h3><p>${text('Your rewards are already saved.')}</p></div><button class="sky-button gacha-all" data-gacha="all">${text('Open all')}</button>`;
    } else if (this.phase === 'reward') {
      const reward = this.receipt.rewards[this.index], p = prizeOf(reward.id);
      body = `<div class="gacha-reveal ${p.rarity}"><div class="gacha-rays"></div><div class="gacha-confetti" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}">✦</i>`).join('')}</div><span class="gacha-count">${this.index + 1} / ${this.receipt.rewards.length}</span><div class="gacha-reward-content" role="status"><b class="gacha-rarity">${this.rarity(p)}</b><span class="gacha-art">${this.icon(reward.id)}</span><h3>${esc(name(reward.id))}</h3><strong>×${reward.count.toLocaleString()}${reward.fresh ? ` · ${text('NEW')}` : ''}</strong>${reward.guaranteed ? `<em>${text('GUARANTEED')}</em>` : ''}<p>${text(reward.destination === 'chest' ? 'Sent to chest' : reward.destination === 'energy' ? 'Energy added' : 'Added to backpack')}</p></div></div><div class="gacha-next"><button class="soft-button" data-gacha="all">${text('Open all')}</button><button class="sky-button" data-gacha="next">${text(this.index + 1 < this.receipt.rewards.length ? 'Next reward' : 'View results')}</button></div>`;
    } else {
      body = `<div class="gacha-summary"><h3>${text('YOUR REWARDS')}</h3><p>${text('Draws {from}–{to}', { from: this.receipt.total - this.receipt.rewards.length + 1, to: this.receipt.total })} · ⚡ −${this.receipt.cost.toLocaleString()}</p><div class="gacha-results">${this.receipt.rewards.map((r, i) => this.card(r, i)).join('')}</div>${this.progress()}<button class="sky-button" data-gacha="back">${text('Back to Halloween chest')}</button></div>`;
    }
    this.host.innerHTML = `<section class="gacha-screen" data-gacha-phase="${this.phase}" aria-label="${text('Halloween chest')}">${body}</section>`;
  }
  private open() {
    if (!this.receipt || this.phase === 'opening' || !this.host) return;
    this.phase = 'opening'; this.render();
    this.timer = setTimeout(() => { this.timer = undefined; this.phase = 'reward'; this.render(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750);
  }
  private click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-gacha]');
    if (!button || button.disabled) return;
    event.stopPropagation();
    switch (button.dataset.gacha) {
      case 'preview': this.selected = prizeOf(button.dataset.prize!); this.render(); break;
      case 'pumpkin': this.selected = null; this.render(); break;
      case 'draw': void this.draw(Number(button.dataset.count) as 1 | 10); break;
      case 'open': this.open(); break;
      case 'all': clearTimeout(this.timer); this.phase = 'summary'; this.render(); break;
      case 'next': if (this.receipt && this.index + 1 < this.receipt.rewards.length) { this.index++; this.phase = 'ready'; this.open(); } else { this.phase = 'summary'; this.render(); } break;
      case 'back': this.phase = 'shop'; this.render(); break;
      case 'history': this.receipt = this.options.state().halloweenGacha?.last ?? null; this.phase = 'summary'; this.render(); break;
    }
  };
  private async draw(count: 1 | 10) {
    if (this.busy) return;
    const owner = this.options.state(); this.busy = true; this.render();
    try {
      const receipt = await this.options.draw(count);
      if (receipt && owner === this.options.state()) { this.receipt = receipt; this.index = 0; this.phase = 'ready'; }
    } finally { this.busy = false; this.render(); }
  }
}
