// Farm Raids between players: the balance (owner, 9 Nov 2026: "Max camp, raiders lv5 should not always 100% win. We want this
// to be a strategic game"). A farm-like copy (a field, the pen, the stall), defense setups at levels 1-5, and armies a camp
// of each level holds, 12 battles each, with the game's own battle (L.frStart, L.frDrop, L.frStep).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const R = C.FRAID;
// a real-farm-like copy: 30x24 open land, a 10x6 crop field in the middle, pen, stall; defenses placed round the field
function farm(defs,lv){const w=30,h=24,loot=[];for(let y=9;y<15;y++)for(let x=10;x<20;x++)loot.push({kind:'crops',x,y,n:1});
 loot.push({kind:'produce',x:5,y:5,n:6},{kind:'gold',x:24,y:5,n:300},{kind:'stall',x:26,y:5,n:20});
 const spots=[[15,8],[9,12],[20,12],[15,15],[6,6],[24,6],[12,8],[18,15],[9,9],[21,9]];
 const d=defs.map((t,i)=>({t,x:spots[i][0],y:spots[i][1],lv}));
 const f={w,h,solid:'0'.repeat(w*h),defs:d,loot};f.drop=L.frDropCells(f);return f;}
function army(campLv,rlv){const sp=R.camp.levels[campLv-1].space,open=[].concat(...R.camp.levels.slice(0,campLv).map(l=>l.open));
 // a sensible mix: fill with the strongest open raiders first, then goats
 const out={};let left=sp;const pref=['carabao','boar','monkey','cat','rooster','bayawak','crow','goat'].filter(k=>open.includes(k));
 for(const k of pref){const s=R.raiders[k].space;const n=k==='goat'?Math.floor(left/s):Math.min(Math.floor(left/s),Math.ceil(sp/(s*3)));if(n>0){out[k]={n,lv:rlv};left-=n*s;}}
 return out;}
function play(f,a,seed){const b=L.frStart(f,a,seed);const cells=[];for(let i=0;i<f.drop.length;i++)if(f.drop[i]==='1')cells.push(i);
 const near=cells.sort((p,q)=>{const d=(i)=>Math.abs(i%f.w-15)+Math.abs(Math.floor(i/f.w)-12);return d(p)-d(q);});
 let k=0;Object.keys(a).forEach(r=>{for(let n=0;n<a[r].n;n++){const c=near[(k++*7)%Math.min(40,near.length)];L.frDrop(b,r,c%f.w,Math.floor(c/f.w));}});
 while(!b.end)L.frStep(b);return [L.frStars(b),L.frShare(b)];}
const D={'none':[],'dog+scarecrow':['dog','scarecrow'],'4 def':['dog','scarecrow','goose','beebox'],'7 def':['dog','scarecrow','goose','beebox','tower','sili','kampana'],'10 def':['dog','scarecrow','goose','beebox','tower','sili','kampana','mudpit','sprinkler','fence']};
const avg = (defs, dl, cl, rl) => { let st = 0; for (let s = 1; s <= 12; s++) st += play(farm(D[defs], dl), army(cl, rl), s * 97)[0]; return st / 12; };

test('a defense hits with its own level (it used to hit with level 1), and its counter hits 3x', () => {
  assert.ok(L.frDefMult(5) > R.level.mult[4], 'a defense levels up more steeply than a raider');
  const f = farm(['dog'], 5), b = L.frStart(f, { cat: { n: 1, lv: 1 } }, 1);
  assert.ok(b.defs[0].dps > R.defenses.dog.dps * 3, 'level 5: over 3x the damage');
  assert.strictEqual(R.counter, 3);
});

test('no defenses: anyone wins 3 stars; a new camp cannot beat a guarded farm', () => {
  assert.strictEqual(avg('none', 1, 1, 1), 3);
  assert.ok(avg('4 def', 3, 1, 1) < 1, 'a new camp vs 4 defenses at level 3');
});

test('a max camp with level-5 raiders does not always win: well defended farms hold', () => {
  assert.ok(avg('10 def', 5, 7, 5) < 3, 'all 10 defenses at level 5 hold a max camp under 3 stars');
  assert.ok(avg('7 def', 5, 7, 5) < 3, '7 defenses at level 5 too');
  assert.strictEqual(avg('4 def', 1, 7, 5), 3, 'a lightly defended farm still falls to a max camp');
});

test('levels matter on both sides: a mid camp beats light defenses, not maxed ones', () => {
  assert.strictEqual(avg('dog+scarecrow', 1, 5, 3), 3);
  assert.ok(avg('10 def', 5, 5, 3) < 1);
});
