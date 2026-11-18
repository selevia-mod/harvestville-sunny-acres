// Every top-level save key belongs to one feature (18 Nov 2026). Two features built at the same time on different
// branches both took 'mc' (the Manila Cup and the farm machines): merged, one would have written over the other's save.
// This finds every `o.<key> = ...` inside an L.serialize wrapper in src/01-*.js and fails when two files write the same
// key, unless it is on the list below of keys shared on purpose (one feature adding to another's).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// key -> the files allowed to write it, and why
const SHARED = {
  gm: ['01-logicZZZZZZZZZZZZZZZZZZZZZZZ-grand-market.js', '01-logicZZZZZZZZZZZZZZZZZZZZZZZZZ-manila-friends.js', '01-logicZZZZZZZZZZZZZZZZZZZZZZZZZZZ-trucks.js'], // Manila Friends (Aling Rosa's 4th contract) and the trucks (vehicles, City Order deliveries) append to the Grand Market's list
  hg: ['01-logicL.js', '01-logicZZZZ-places.js'], // the same gear data, written again with the places' pieces
  hs: ['01-logic2.js', '01-logicZZZZZZZZZZZZZZ-horse.js'], // the horse's own list, extended (gear, stamina, its regen time)
  m: ['01-logicZZZ-park.js', '01-logicZZZZ-places.js'], // the map: saved as the town from the park and the places
};

// every key each file's L.serialize wrappers write
const keysByFile = (files) => {
  const by = {};
  Object.keys(files).forEach((f) => {
    const s = files[f];
    for (const m of s.matchAll(/L\.serialize\s*=\s*function\s*\([^)]*\)\s*\{/g)) {
      let i = m.index + m[0].length, d = 1;
      while (i < s.length && d > 0) { if (s[i] === '{') d++; else if (s[i] === '}') d--; i++; }
      for (const k of s.slice(m.index, i).matchAll(/\bo\.([a-zA-Z][a-zA-Z0-9]*)\s*=(?!=)/g)) (by[k[1]] = by[k[1]] || new Set()).add(f);
    }
  });
  return by;
};
const clashes = (by) => Object.keys(by).filter((k) => by[k].size > 1 && !(SHARED[k] && [...by[k]].every((f) => SHARED[k].includes(f))))
  .map((k) => k + ': ' + [...by[k]].join(', '));

test('no two features write the same top-level save key', () => {
  const dir = path.join(__dirname, '..', 'src'), files = {};
  fs.readdirSync(dir).filter((f) => /^01-/.test(f)).forEach((f) => { files[f] = fs.readFileSync(path.join(dir, f), 'utf8'); });
  const by = keysByFile(files);
  assert.ok(Object.keys(by).length > 80, 'the save keys were found (' + Object.keys(by).length + ')');
  assert.deepStrictEqual(clashes(by), []);
});

test('the check catches a clash like the one of 18 Nov', () => {
  const cup = 'L.serialize = function (s) { var o = serialize(s); if (x) o.mc = x; return o; };';
  const machines = 'L.serialize = function (s) {\n var o = serialize(s);\n o.mc = s.made;\n return o;\n};';
  assert.deepStrictEqual(clashes(keysByFile({ 'a-cup.js': cup, 'b-machines.js': machines })), ['mc: a-cup.js, b-machines.js']);
  assert.deepStrictEqual(clashes(keysByFile({ 'a-cup.js': cup })), []);
});
