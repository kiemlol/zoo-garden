/** A non-stacking, four-second poison. Shared by solo and authoritative combat.
 * Call only after a projectile actually damages its target; immunity clears it.
 */
export class Venom {
  private left=0;
  private elapsed=0;
  private damage=0;
  get active(){return this.left>0;}
  infect(hit:number){this.left=4;this.damage=Math.max(this.damage,hit*.15);}
  clear(){this.left=0;this.elapsed=0;this.damage=0;}
  step(dt:number,immune=false){
    if(immune){this.clear();return 0;}
    if(this.left<=0)return 0;
    const span=Math.min(Math.max(0,dt),this.left);this.left-=span;this.elapsed+=span;
    const ticks=Math.floor(this.elapsed+1e-8);this.elapsed-=ticks;
    const amount=ticks*this.damage;if(this.left<=1e-8)this.clear();return amount;
  }
}
