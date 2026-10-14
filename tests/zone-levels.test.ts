import test from 'node:test';
import assert from 'node:assert/strict';
import {enemyRoster} from '../src/enemy-roster.ts';
import {ENEMY_TYPES} from '../src/enemy-types.ts';
import {ZONE_DIFFICULTY,creatureScale,bossScale} from '../src/boss-patterns.ts';
import {zoneInfo,ZONE_DIFFICULTY as HUD_DIFFICULTY} from '../src/hud-combat.ts';

test('home zones share levels and HP/attack scaling between server roster and HUD',()=>{
 assert.equal(HUD_DIFFICULTY,ZONE_DIFFICULTY);
 const entries=enemyRoster('home');
 for(const [zone,name,level,scale]of [['forest','Mushroom Forest',4,1.7],['meadow','Blue Lake Meadow',1,1],['swamp','Chomper Swamp',7,2.6],['canyon','Redrock Canyon',10,3.6]] as const){
 assert.match(zoneInfo(name,'home').chip,new RegExp(`Lv ${level}\\+`));
 const monsters=entries.filter(e=>e.zone===zone&&!e.boss&&!e.titan);assert.ok(monsters.length);
 for(const e of monsters){const d=ENEMY_TYPES[e.type];assert.equal(e.level,level);assert.equal(e.baseMaxHp,Math.round(d.hp*scale));assert.equal(e.baseDamage,d.damage*scale);}
 const boss=entries.find(e=>e.zone===zone&&e.boss&&!e.titan)!;assert.equal(boss.level,level+6);assert.equal(bossScale(zone,boss.type,1,1).level,boss.level);
 assert.equal(creatureScale(ZONE_DIFFICULTY[zone]).hpMultiplier,scale);
 }
});
