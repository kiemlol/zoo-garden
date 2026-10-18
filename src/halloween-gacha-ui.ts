import type { SaveState } from './model.ts';
import { ITEMS } from './content.ts';
import { t } from './i18n.ts';
import { HALLOWEEN_GACHA, HALLOWEEN_PRIZES, HALLOWEEN_WEIGHT, type HalloweenPrize, type HalloweenDraw, type HalloweenReward } from './halloween-gacha-config.ts';
import { GachaPumpkinView } from './gacha-pumpkin-view.ts';
import { PUMPKIN_OPEN_SECONDS } from './gacha-pumpkin.ts';
import './halloween-gacha.css';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const text = (s: string, params?: Record<string, string | number>) => esc(t(s, params));
const name = (id: string) => id === 'energy' ? t('Energy') : t(ITEMS[id].name);
const prizeOf = (id: string) => HALLOWEEN_PRIZES.find(p => p.id === id)!;
const percent = (p: HalloweenPrize) => `${Number((p.weight / HALLOWEEN_WEIGHT * 100).toFixed(2))}%`;
interface PumpkinPreview { show(slot: HTMLElement, opening: boolean): void; dispose(): void }
interface Options {
  state: () => SaveState;
  draw: (count: 1 | 10) => Promise<HalloweenDraw | undefined>;
  art: (id: string, icon: string) => string;
  close: () => void;
  /** Injectable without WebGL for lifecycle tests. */
  pumpkin?: () => PumpkinPreview;
}
/** Presentation only: shared rules/server still commit the entire batch before any opening animation. */
export class HalloweenGachaPanel {
  private host: HTMLElement | null = null;
  private owner: SaveState | null = null;
  private busy = false;
  private phase: 'shop' | 'ready' | 'opening' | 'reward' | 'summary' = 'shop';
  private selected: HalloweenPrize | null = null;
  private receipt: HalloweenDraw | null = null;
  private index = 0;
  private rates = false;
  private advanceAfter = 0;
  private pumpkin: PumpkinPreview | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private options: Options) {}
  mount(host: HTMLElement) {
    this.unmount();
    const state = this.options.state(), last = state.halloweenGacha?.last;
    if (this.owner !== state || this.receipt && (this.receipt.total !== last?.total || this.receipt.at !== last?.at)) { this.owner = state; this.phase = 'shop'; this.receipt = null; this.selected = null; }
    this.host = host; host.hidden = false; host.addEventListener('click', this.click); host.addEventListener('keydown', this.key); this.render(); this.host.querySelector<HTMLButtonElement>('[data-gacha=close]')?.focus({preventScroll:true});
  }
  unmount() {
    if (this.host) { this.host.removeEventListener('click', this.click); this.host.removeEventListener('keydown', this.key); this.host.hidden = true; this.host.innerHTML = ''; }
    this.host = null; this.rates = false;
    clearTimeout(this.timer); this.timer = undefined;
    this.pumpkin?.dispose(); this.pumpkin = null;
    if (this.phase === 'opening') this.phase = 'ready';
  }
  private icon(id: string) { return id === 'energy' ? '⚡' : this.options.art(id, ITEMS[id].icon); }
  private rarity(p: HalloweenPrize) { return text(p.rarity === 'purple' ? 'PURPLE · RARE' : 'BLUE'); }
  private header() { return `<header class="gacha-heading"><span>${text('HALLOWEEN NIGHT DRAW')}</span><h2>${text('Halloween chest')}</h2></header>`; }
  private progress() {
    const misses = this.options.state().halloweenGacha?.misses ?? 0;
    return `<button class="gacha-pity" data-gacha="rates" aria-label="${text('Rod guarantee')}: ${misses}/${HALLOWEEN_GACHA.rodPity}"><span class="gacha-orb purple"><span class="gacha-art">${this.icon('rod_key')}</span></span><b>${misses}/${HALLOWEEN_GACHA.rodPity}</b></button>`;
  }
  private card(r: HalloweenReward) {
    const p = prizeOf(r.id);
    return `<div class="gacha-result-card gacha-orb ${p.rarity}" data-reward="${r.id}" role="img" aria-label="${esc(name(r.id))} ×${r.count}${r.guaranteed ? ` · ${text('GUARANTEED')}` : ''}"><span class="gacha-art">${this.icon(r.id)}</span>${r.fresh ? `<small class="gacha-new">${text('NEW')}</small>` : ''}</div>`;
  }
  private odds() {
    return `<div class="gacha-odds-shade"><section class="gacha-odds" role="dialog" aria-modal="true" aria-label="${text('Rewards and drop rates')}"><button class="gacha-close" data-gacha="rates-close" aria-label="${text('Close')}">×</button><h3>${text('Rewards and drop rates')}</h3><div class="gacha-odds-list">${HALLOWEEN_PRIZES.map(p => `<div><span class="gacha-orb ${p.rarity}"><span class="gacha-art">${this.icon(p.id)}</span></span><span>${esc(name(p.id))}${p.id === 'energy' ? ' ×1.000' : ''}</span><b>${percent(p)}</b></div>`).join('')}</div><p>${text('Rates above total 100% on ordinary draws. Each draw is independent; duplicate rewards are kept.')}</p><p>${text('After 149 draws without the sealed key rod, the next draw guarantees it. Winning the rod resets only this counter; a ten-draw batch follows the same rule.')}</p><p>${text('Rewards are saved immediately. A full backpack sends items to your chest. Closing the screen does not cancel a paid draw.')}</p></section></div>`;
  }
  private render() {
    if (!this.host) return;
    const focused = typeof document !== 'undefined' && this.host.contains(document.activeElement) ? (document.activeElement as HTMLElement)?.dataset : undefined;
    const s = this.options.state(), last = s.halloweenGacha?.last;
    let body: string;
    if (this.phase === 'shop' || !this.receipt) {
      const selected = this.selected;
      body = `${this.header()}${this.progress()}<div class="gacha-layout"><div class="gacha-showcase">${selected ? `<div class="gacha-feature ${selected.rarity}" aria-label="${esc(name(selected.id))}"><span class="gacha-art">${this.icon(selected.id)}</span></div>` : '<div class="gacha-pumpkin-slot"></div>'}</div><div class="gacha-selection"><section class="gacha-pool" aria-label="${text('Rewards and drop rates')}">${HALLOWEEN_PRIZES.map(p => `<button class="gacha-prize gacha-orb ${p.rarity}${selected?.id === p.id ? ' selected' : ''}" data-gacha="preview" data-prize="${p.id}" aria-pressed="${selected?.id === p.id}" aria-label="${esc(name(p.id))} · ${percent(p)}"><span class="gacha-art">${this.icon(p.id)}</span>${selected?.id === p.id ? `<span class="gacha-item-name" role="status">${esc(name(p.id))}</span>` : ''}</button>`).join('')}</section><div class="gacha-buy">${([1, 10] as const).map(n => `<button class="gacha-buy-button" data-gacha="draw" data-count="${n}" ${this.busy || s.energy < n * HALLOWEEN_GACHA.cost ? 'disabled' : ''}><span>${text(n === 1 ? 'Draw once' : 'Draw ten')}</span><b>⚡ ${(n * HALLOWEEN_GACHA.cost).toLocaleString()}</b></button>`).join('')}</div><small class="gacha-wallet">⚡ ${s.energy.toLocaleString()}</small></div></div><footer class="gacha-shop-footer"><button class="gacha-info" data-gacha="rates">ⓘ ${text('Drop rate info')}</button>${last ? `<button class="gacha-history" data-gacha="history" ${this.busy ? 'disabled' : ''}>${text('View last result')}</button>` : ''}</footer>${this.busy ? `<p class="gacha-pending" role="status">${text('Confirming draw…')}</p>` : ''}`;
    } else if (this.phase === 'ready' || this.phase === 'opening') {
      body = `<button class="gacha-tap-area" data-gacha="advance" ${this.phase === 'opening' ? 'disabled' : ''} aria-label="${text('Tap the screen to open the box!')}">${this.header()}<div class="gacha-gift"><div class="gacha-pumpkin-slot"></div><span class="gacha-gift-count">${this.receipt.rewards.length}</span></div><p class="gacha-tap-prompt">${text('Tap the screen to open the box!')}</p></button>`;
    } else if (this.phase === 'reward') {
      const reward = this.receipt.rewards[this.index], p = prizeOf(reward.id);
      body = `<button class="gacha-tap-area gacha-reveal ${p.rarity}" data-gacha="advance" aria-label="${text('Tap the screen to go to the next part.')}" aria-live="polite"><div class="gacha-rays"></div><span class="gacha-remaining">🎃 ${this.receipt.rewards.length - this.index - 1}</span><div class="gacha-reward-content"><b class="gacha-rarity">${this.rarity(p)}</b><span class="gacha-art">${this.icon(reward.id)}</span><h3>${esc(name(reward.id))}</h3>${reward.fresh ? `<strong class="gacha-new">${text('NEW')}</strong>` : ''}${reward.guaranteed ? `<em>${text('GUARANTEED')}</em>` : ''}<small>${text(reward.destination === 'chest' ? 'Sent to chest' : reward.destination === 'energy' ? 'A bundle of 1,000 energy.' : 'Added to backpack')}</small></div><p class="gacha-tap-prompt">${text('Tap the screen to go to the next part.')}</p></button><button class="gacha-small-button gacha-all" data-gacha="all">${text('Open all')}</button>`;
    } else {
      body = `<div class="gacha-summary"><h2>${text('DRAW RESULTS')}</h2><div class="gacha-results">${this.receipt.rewards.map(r => this.card(r)).join('')}</div><button class="gacha-ok gacha-buy-button" data-gacha="back">OK</button></div>`;
    }
    // Keep the live canvas/model between ready and opening; render() never creates a WebGL context.
    const phase = this.phase, usesPumpkin = phase === 'ready' || phase === 'opening' || phase === 'shop' && !this.selected;
    if (!usesPumpkin) { this.pumpkin?.dispose(); this.pumpkin = null; }
    this.host.innerHTML = `<section class="gacha-screen ${phase === 'reward' ? prizeOf(this.receipt!.rewards[this.index].id).rarity : ''}" data-gacha-phase="${phase}" aria-label="${text('Halloween chest')}">${body}<button class="gacha-close" data-gacha="close" aria-label="${text('Close')}">×</button>${this.rates ? this.odds() : ''}</section>`;
    const slot = this.host.querySelector<HTMLElement>('.gacha-pumpkin-slot');
    const focusAction = this.rates ? 'rates-close' : phase === 'ready' || phase === 'reward' ? 'advance' : phase === 'summary' ? 'back' : focused?.gacha;
    if (focusAction) this.host.querySelector<HTMLButtonElement>(focusAction === 'preview' && focused?.prize ? `[data-prize="${focused.prize}"]` : `[data-gacha="${focusAction}"]`)?.focus({preventScroll:true});
    if (slot) { this.pumpkin ??= this.options.pumpkin?.() ?? new GachaPumpkinView(); this.pumpkin.show(slot, phase === 'opening'); }
  }
  private open() {
    if (!this.receipt || this.phase !== 'ready' || !this.host) return;
    this.phase = 'opening'; this.render();
    this.timer = setTimeout(() => {
      this.timer = undefined; this.phase = 'reward'; this.advanceAfter = performance.now() + 350; this.render();
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : PUMPKIN_OPEN_SECONDS * 1000);
  }
  private advance() {
    if (this.rates || this.busy) return;
    if (this.phase === 'ready') { this.open(); return; }
    if (this.phase !== 'reward' || !this.receipt || performance.now() < this.advanceAfter) return;
    // Only the FIRST tap opens a pumpkin. Subsequent taps reveal the next committed reward directly.
    if (this.index + 1 < this.receipt.rewards.length) { this.index++; this.advanceAfter = performance.now() + 350; }
    else this.phase = 'summary';
    this.render();
  }
  private key = (event: KeyboardEvent) => {
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
    if (!this.rates) return;
    if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); this.host?.querySelector<HTMLButtonElement>('[data-gacha=rates-close]')?.focus(); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.rates = false; this.render(); }
  };
  private click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-gacha]');
    event.stopPropagation();
    if (!button) { this.advance(); return; }
    if (button.disabled || this.rates && button.dataset.gacha !== 'rates-close' && button.dataset.gacha !== 'close') return;
    switch (button.dataset.gacha) {
      case 'preview': this.selected = prizeOf(button.dataset.prize!); this.render(); break;
      case 'draw': void this.draw(Number(button.dataset.count) as 1 | 10); break;
      case 'advance': this.advance(); break;
      case 'all': clearTimeout(this.timer); this.timer = undefined; this.phase = 'summary'; this.render(); break;
      case 'back': this.phase = 'shop'; this.render(); break;
      case 'history': this.receipt = this.options.state().halloweenGacha?.last ?? null; this.phase = 'summary'; this.render(); break;
      case 'rates': this.rates = true; this.render(); break;
      case 'rates-close': this.rates = false; this.render(); break;
      case 'close': this.options.close(); break;
    }
  };
  private async draw(count: 1 | 10) {
    if (this.busy) return;
    const owner = this.options.state(); this.busy = true; this.render();
    try {
      const receipt = await this.options.draw(count);
      if (receipt && owner === this.options.state()) { this.receipt = receipt; this.index = 0; this.rates = false; this.phase = 'ready'; }
    } finally { this.busy = false; this.render(); }
  }
}
