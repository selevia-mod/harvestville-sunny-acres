// tools/strip-js.js: the page's code without comments and indentation (6 Nov 2026), the same program line for line.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { strip } = require('../tools/strip-js');

test('comments and indentation go; strings, templates and regular expressions stay as they are', () => {
  const src = [
    '  // a whole line',
    '  var a = "http://x.y/*z*/", b = \'it\\\'s // not\'; // after',
    '  var re = /\\/\\/[\'"`]*/g, d = a.length / 2 / 1; /* one */ var e = 1;',
    '    /* two',
    '       lines */ var t = `a // b ${ a ? `c ${ b } /* d */` : \'e\' } f`;',
    '  if (/^x/.test(a)) return typeof /y/;',
    '  var g = i++ / 2, h = (a) / 2;',
  ].join('\n');
  const out = strip(src);
  assert.strictEqual(out, [
    '',
    'var a = "http://x.y/*z*/", b = \'it\\\'s // not\';',
    'var re = /\\/\\/[\'"`]*/g, d = a.length / 2 / 1;   var e = 1;', // (the space round a comment stays as it was)
    '',
    'var t = `a // b ${ a ? `c ${ b } /* d */` : \'e\' } f`;',
    'if (/^x/.test(a)) return typeof /y/;',
    'var g = i++ / 2, h = (a) / 2;',
  ].join('\n'));
  assert.strictEqual(strip(out), out, 'twice is once');
});

test('every src/ file: the same number of lines, it still parses, and stripping it again changes nothing', () => {
  const dir = path.join(__dirname, '..', 'src');
  let before = 0, after = 0;
  fs.readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => {
    const code = fs.readFileSync(path.join(dir, f), 'utf8'), out = strip(code);
    before += code.length;
    after += out.length;
    assert.strictEqual(out.split('\n').length, code.split('\n').length, f);
    assert.doesNotThrow(() => new Function(out), f); // eslint-disable-line no-new-func
    assert.strictEqual(strip(out), out, f);
  });
  assert.ok(after < before * 0.85, `smaller: ${before} -> ${after}`);
});
