'use strict';
// The game's code goes into the page without its comments and indentation (6 Nov 2026: ~0.5 MB of the page, which
// Android will not open at 20 MiB). Every line stays where it was, so an error's line number is the same as before.
// What is in a string, a template or a regular expression is never touched. build.js runs it on each src/ file;
// test/strip-js.test.js checks it on all of them.
// strip(code) -> the same program, shorter.
const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'instanceof', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'of']);

function strip(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  // what came last that matters for "/": a regular expression can follow an operator or a keyword, not a value
  let last = ''; // '' (start), 'value' (name, number, string, ) ] }), 'op', or a keyword
  const braces = []; // for templates: 'tpl' when a ${ ... } is open, '{' otherwise
  let lineStart = true; // nothing but whitespace yet on this line (of code)
  let space = ''; // whitespace waiting to be written as it was (unless the line ends first, or it is indentation)
  const emit = (s) => {
    if (space && !lineStart) out += space;
    space = '';
    lineStart = false;
    out += s;
  };
  const newline = () => { out += '\n'; space = ''; lineStart = true; };
  const isIdStart = (c) => /[A-Za-z_$]/.test(c) || c.charCodeAt(0) > 0x7f;
  const isId = (c) => /[A-Za-z0-9_$]/.test(c) || c.charCodeAt(0) > 0x7f;
  const isSpace = (c) => c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v' || c.charCodeAt(0) === 0xa0 || c.charCodeAt(0) === 0xfeff;
  const isBreak = (c) => c === '\n' || c.charCodeAt(0) === 0x2028 || c.charCodeAt(0) === 0x2029;

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '\n') { newline(); i++; continue; }
    if (isSpace(c)) { space += c; i++; continue; }
    if (c === '/' && d === '/') { // to the end of the line (the line itself stays)
      while (i < n && !isBreak(src[i])) i++;
      continue;
    }
    if (c === '/' && d === '*') { // its line breaks stay (one counts as a line break for semicolons, too)
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new Error('strip-js: a comment does not end');
      const body = src.slice(i, end + 2);
      i = end + 2;
      const lines = body.split('\n').length - 1;
      if (lines) for (let k = 0; k < lines; k++) newline();
      else space += ' ';
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n') throw new Error('strip-js: a string does not end'); j++; }
      emit(src.slice(i, j + 1));
      i = j + 1;
      last = 'value';
      continue;
    }
    if (c === '`') { emit('`'); i++; template(); continue; }
    if (c === '/') {
      const regex = last === '' || last === 'op' || KEYWORDS_BEFORE_REGEX.has(last);
      if (regex) {
        let j = i + 1, cls = false;
        while (j < n) {
          const r = src[j];
          if (r === '\\') { j += 2; continue; }
          if (r === '\n') throw new Error('strip-js: a regular expression does not end, at ' + src.slice(i, i + 40));
          if (cls) { if (r === ']') cls = false; } else if (r === '[') cls = true; else if (r === '/') break;
          j++;
        }
        j++;
        while (j < n && isId(src[j])) j++; // flags
        emit(src.slice(i, j));
        i = j;
        last = 'value';
        continue;
      }
      emit(c);
      i++;
      last = 'op';
      continue;
    }
    if (isIdStart(c) || c === '\\') {
      let j = i;
      while (j < n && (isId(src[j]) || src[j] === '\\')) j++;
      const word = src.slice(i, j);
      emit(word);
      i = j;
      last = KEYWORDS_BEFORE_REGEX.has(word) ? word : 'value';
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(d))) {
      let j = i;
      while (j < n && /[0-9A-Za-z_.]/.test(src[j])) {
        if ((src[j] === 'e' || src[j] === 'E') && (src[j + 1] === '+' || src[j + 1] === '-') && !/^0[xX]/.test(src.slice(i, j))) j++;
        j++;
      }
      emit(src.slice(i, j));
      i = j;
      last = 'value';
      continue;
    }
    if (c === '{') { braces.push('{'); emit(c); i++; last = 'op'; continue; }
    if (c === '}') {
      const b = braces.pop();
      i++;
      if (b === 'tpl') { emit('}'); template(); continue; } // (the template goes on)
      emit(c);
      last = 'value'; // (a block's end before a regular expression would need a ; anyway in this code: checked by the test)
      continue;
    }
    if (c === ')' || c === ']') { emit(c); i++; last = 'value'; continue; }
    // ++ and -- after a value stay a value's ending (a++ / 2)
    if ((c === '+' || c === '-') && d === c) { emit(c + d); i += 2; if (last !== 'value') last = 'op'; continue; }
    emit(c);
    i++;
    last = 'op';
  }
  if (braces.length) throw new Error('strip-js: unbalanced braces');
  return out;

  // the rest of a template, as it is, to its ` or its next ${ (after its ` or the } closing a ${ ... })
  function template() {
    let j = i;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') { out += src.slice(i, j + 1); i = j + 1; last = 'value'; return; }
      if (c === '$' && src[j + 1] === '{') { out += src.slice(i, j + 2); i = j + 2; braces.push('tpl'); last = 'op'; return; }
      j++;
    }
    throw new Error('strip-js: a template does not end');
  }
}

module.exports = { strip };
