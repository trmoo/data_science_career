/*!
 * 배포 전 점검 — 앱스 스크립트는 오류가 나도 흰 화면만 뜨므로 여기서 미리 잡는다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   node tools/check.js
 *
 * 검사하는 것
 *   ① 모든 소스의 자바스크립트 문법
 *   ② index.html 의 include 목록과 순서
 *   ③ 화면이 쓰는 CSS 클래스가 css.html 에 있는가
 *   ④ 저작권 표시
 *   ⑤ 화면 수명 규칙 (setInterval·resize 직접 사용 금지)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const SCREENS = ['s1.html', 's2.html', 's3.html', 's4.html', 's5.html'];
const SCRIPTED = ['data.html', 'judge.html', 'core.html', 'boot.html'].concat(SCREENS);
const ALL = ['Code.gs', 'index.html', 'css.html'].concat(SCRIPTED);
const WANT = ['css', 'data', 'judge', 'core', 's1', 's2', 's3', 's4', 's5', 'boot'];

let errors = 0, warns = 0;
const fail = (m) => { errors++; console.log('  ✗ ' + m); };
const warn = (m) => { warns++; console.log('  ! ' + m); };
const pass = (m) => console.log('  ✓ ' + m);

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const scriptOf = (f) => {
  const m = read(f).match(/<script>([\s\S]*)<\/script>/);
  return m ? m[1] : null;
};

/* ── ① 문법 ─────────────────────────────────────────── */
console.log('\n① 자바스크립트 문법');
[['Code.gs', read('Code.gs')]].concat(SCRIPTED.map((f) => [f, scriptOf(f)]))
  .forEach(([f, code]) => {
    if (code == null) { fail(f + ' 안에 <script> 가 없습니다'); return; }
    try { new Function(code); pass(f); }
    catch (e) { fail(f + ' — ' + e.message); }
  });

/* ── ② include ──────────────────────────────────────── */
console.log('\n② index.html 의 부품 불러오기');
const idx = read('index.html');
const found = [];
const re = /include\('(\w+)'\)/g;
let m;
while ((m = re.exec(idx)) !== null) found.push(m[1]);
if (found.join(',') === WANT.join(',')) pass('부품 ' + WANT.length + '개를 올바른 순서로 불러옵니다');
else fail('부품 목록이 다릅니다\n      기대: ' + WANT.join(',') + '\n      실제: ' + found.join(','));
if (idx.indexOf('var BOOT_DATA') < idx.indexOf("include('boot')")) pass('BOOT_DATA 가 boot 보다 앞에 있습니다');
else fail('BOOT_DATA 가 boot 뒤에 있으면 로그인 화면이 뜨지 않습니다');
if (idx.indexOf("include('judge')") < idx.indexOf("include('core')")) pass('judge 가 core 보다 앞에 있습니다');
else fail('core 의 서술 칸이 JUDGE 를 쓰므로 judge 가 먼저 와야 합니다');
const leftover = idx.match(/<\?[\s\S]{0,50}?\?>/g) || [];
const okScriptlets = leftover.filter((s) => /include\('|BOOT/.test(s));
if (leftover.length === okScriptlets.length) pass('스크립틀릿이 모두 알려진 것입니다 (' + leftover.length + '개)');
else fail('알 수 없는 스크립틀릿: ' + leftover.filter((s) => okScriptlets.indexOf(s) < 0).join(' '));

/* ── ③ CSS 클래스 ───────────────────────────────────── */
console.log('\n③ CSS 클래스 대조');
const css = read('css.html');
const defined = new Set();
(css.match(/\.[-\w]+/g) || []).forEach((c) => defined.add(c.slice(1)));
const used = new Map();
SCRIPTED.forEach((f) => {
  const code = scriptOf(f) || '';
  const r1 = /\bh\('([a-zA-Z][\w]*(?:\.[-\w]+)+)'/g;
  let x;
  while ((x = r1.exec(code)) !== null) {
    x[1].split('.').slice(1).forEach((c) => { if (c) used.set(c, f); });
  }
  const r2 = /classList\.(?:add|remove|toggle)\(([^)]*)\)/g;
  while ((x = r2.exec(code)) !== null) {
    (x[1].match(/'([-\w]+)'/g) || []).forEach((q) => used.set(q.replace(/'/g, ''), f));
  }
  /* class: 'x y' 로 쓰는 SVG 부품 */
  const r3 = /class:\s*'([-\w ]+)'/g;
  while ((x = r3.exec(code)) !== null) {
    x[1].split(/\s+/).forEach((c) => { if (c) used.set(c, f); });
  }
});
const missing = [...used.keys()].filter((c) => !defined.has(c));
if (!missing.length) pass('화면이 쓰는 클래스 ' + used.size + '가지가 모두 css.html 에 있습니다');
else missing.forEach((c) => warn('css.html 에 없는 클래스: .' + c + '  (' + used.get(c) + ')'));

/* ── ③-2 클래스 이름 충돌 ────────────────────────────
   .btn.big 처럼 「수식 클래스」와 「홀로 쓰는 클래스」가 이름이 같으면,
   홀로 쓰는 쪽이 정한 color·font 가 단추에 새어 들어와 글씨가 안 보일 수 있다.
   (2026-08-24 실제로 초록 배경에 초록 글씨가 되어 [제출하기] 가 보이지 않았다) */
console.log('\n③-2 클래스 이름 충돌 (단추 수식 클래스 ↔ 홀로 쓰는 클래스)');
{
  const BASES = ['btn', 'pill', 'tab', 'chip', 'dcard', 'badge', 'card', 'bdg', 'lvl'];
  const decl = {};                                  /* 홀로 쓰는 .x 규칙이 정하는 속성 */
  /* ⚠ 주석을 먼저 걷어 낸다 — 주석이 붙어 있으면 선택자가 「주석+.big」 으로 잡혀 규칙을 놓친다 */
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = bare.match(/[^{}]+\{[^{}]*\}/g) || [];
  rules.forEach((r) => {
    const sel = r.slice(0, r.indexOf('{')).trim();
    const body = r.slice(r.indexOf('{') + 1, r.lastIndexOf('}'));
    sel.split(',').forEach((one) => {
      const last = one.trim().split(/\r?\n/).pop().trim();
      const m = last.match(/^\.([-\w]+)$/);          /* 딱 .x 하나만 */
      if (!m) return;
      const props = (body.match(/(^|;)\s*(color|font-family|font-size|font-weight|background)\s*:/g) || [])
        .map((x) => x.replace(/[;:\s]/g, ''));
      if (props.length) decl[m[1]] = (decl[m[1]] || []).concat(props);
    });
  });
  let bad = 0;
  BASES.forEach((base) => {
    const re = new RegExp('\\.' + base + '\\.([-\\w]+)', 'g');
    let m;
    const seen = new Set();
    while ((m = re.exec(bare)) !== null) seen.add(m[1]);
    seen.forEach((mod) => {
      if (decl[mod]) {
        bad++;
        fail('.' + base + '.' + mod + ' 와 홀로 쓰는 .' + mod + ' 가 이름이 같습니다 — .' + mod +
             ' 가 정하는 ' + [...new Set(decl[mod])].join('·') + ' 이(가) 새어 들어옵니다. 수식 클래스 이름을 바꾸세요');
      }
    });
  });
  if (!bad) pass('단추 수식 클래스와 홀로 쓰는 클래스의 이름이 겹치지 않습니다');
}

/* ── ③-3 h() 자식 자리의 HTML 태그 ───────────────────
   h('p.small', '… <b>여기</b> …') 처럼 자식 자리에 넘긴 문자열은 (일부러) 글자 그대로 들어간다.
   그래서 화면에 <b> 가 그대로 보인다. 태그를 쓰려면 {html:'…'} 를 써야 한다.
   (2026-08-24 실제로 네 곳에서 태그가 글자로 찍혔다) */
console.log('\n③-3 h() 자식 자리에 HTML 태그를 넣지 않았는가');
{
  const TAG = /<\/?(?:b|i|br|em|strong|span|div|p|ul|ol|li|code|small)\b[^>]*>/i;

  /** code 의 start 위치('(' 자리)에서 짝이 맞는 ')' 까지 잘라 온다 (따옴표 안은 건너뛴다) */
  function callBody(code, start) {
    let depth = 0, q = null;
    for (let i = start; i < code.length; i++) {
      const c = code[i], prev = code[i - 1];
      if (q) { if (c === q && prev !== '\\') q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') {
        depth--;
        if (depth === 0) return code.slice(start + 1, i);
      }
    }
    return null;
  }

  /** 깊이 0 의 쉼표로 인수를 자른다 */
  function splitArgs(s) {
    const out = [];
    let depth = 0, q = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i], prev = s[i - 1];
      if (q) { cur += c; if (c === q && prev !== '\\') q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) depth--;
      if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }

  let hits = 0;
  SCRIPTED.forEach((f) => {
    const code = scriptOf(f) || '';
    const re = /\bh\(\s*'/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      const open = code.indexOf('(', m.index);
      const body = callBody(code, open);
      if (body == null) continue;
      const args = splitArgs(body);
      /* 첫 인수는 태그 이름이므로 건너뛴다. 나머지 가운데 「따옴표로 시작하는 것」만 본다 */
      args.slice(1).forEach((raw) => {
        const arg = raw.trim();
        const cands = [];
        if (arg[0] === "'" || arg[0] === '"' || arg[0] === '`') cands.push(arg);
        else if (arg[0] === '[') {                       /* 자식 배열 안의 날 문자열도 본다 */
          splitArgs(arg.slice(1, -1)).forEach((e) => {
            const t = e.trim();
            if (t[0] === "'" || t[0] === '"' || t[0] === '`') cands.push(t);
          });
        }
        cands.forEach((c) => {
          if (TAG.test(c)) {
            hits++;
            const snip = c.replace(/\s+/g, ' ').slice(0, 62);
            fail(f + ' — h() 자식 자리에 HTML 태그가 있습니다 (글자로 보입니다): ' + snip +
                 '\n      → {html: …} 로 넘기거나 태그를 빼세요');
          }
        });
      });
    }
  });
  if (!hits) pass('h() 자식 자리에 HTML 태그를 넘긴 곳이 없습니다');
}

/* ── ③-4 브라우저 기본 창 ────────────────────────────
   앱스 스크립트 웹앱은 googleusercontent.com iframe 안에서 돌아가므로,
   alert·confirm·prompt 를 쓰면 크롬이 「…googleusercontent.com 에 삽입된 페이지 내용:」
   이라는 주소를 학생 화면에 붙여 보여 준다. core.html 의 say()·ask()·modal() 을 쓸 것. */
console.log('\n③-4 브라우저 기본 창(alert·confirm·prompt) 을 쓰지 않았는가');
{
  let hits = 0;
  SCRIPTED.forEach((f) => {
    const code = scriptOf(f) || '';
    ['alert', 'confirm', 'prompt'].forEach((fn) => {
      const re = new RegExp('(^|[^.\\w])' + fn + '\\s*\\(', 'g');
      let m;
      while ((m = re.exec(code)) !== null) {
        const line = code.slice(0, m.index).split('\n').length;
        hits++;
        fail(f + ':' + line + ' — 브라우저 기본 ' + fn + '() 을 씁니다 ' +
             '(크롬이 googleusercontent.com 주소를 붙여 보여 줍니다)\n' +
             '      → say() · ask() · modal() 을 쓰세요');
      }
    });
  });
  if (!hits) pass('브라우저 기본 창을 쓰는 곳이 없습니다 (say·ask·modal 만 씁니다)');
}

/* ── ④ 저작권 ───────────────────────────────────────── */
console.log('\n④ 저작권 표시');
ALL.forEach((f) => {
  if (read(f).indexOf('티쳐무') >= 0) pass(f);
  else fail(f + ' 에 저작권 표시가 없습니다');
});
['LICENSE', 'README.md', 'CLAUDE.md', 'package.json'].forEach((f) => {
  const p = path.join(SRC, '..', f);
  // CLAUDE.md 는 깃허브에 올리지 않으므로 받은 저장소에는 없을 수 있다
  if (!fs.existsSync(p)) { if (f !== 'CLAUDE.md') fail(f + ' 파일이 없습니다'); return; }
  const raw = fs.readFileSync(p, 'utf8');
  if (f === 'package.json') {
    if (JSON.parse(raw).license === 'UNLICENSED') pass('package.json 의 license 가 UNLICENSED');
    else fail('package.json 의 license 를 UNLICENSED 로 둘 것');
  } else if (raw.indexOf('티쳐무') >= 0) pass(f);
  else fail(f + ' 에 저작권 표시가 없습니다');
});
{
  const n = (read('index.html').match(/티쳐무/g) || []).length;
  if (n >= 2) pass('index.html 안에 저작권 표시가 ' + n + '곳 (주석 · 화면 푸터)');
  else fail('index.html 의 저작권 표시가 ' + n + '곳뿐입니다 (주석과 푸터 두 곳이어야 합니다)');
}

/* ── ⑤ 화면 수명 규칙 ───────────────────────────────── */
console.log('\n⑤ 화면 수명 규칙');
SCREENS.forEach((f) => {
  const code = scriptOf(f) || '';
  const bad = [];
  if (code.indexOf("window.addEventListener('resize'") >= 0) bad.push('resize 리스너를 직접 걺 → onResize()');
  if (/[^n]setInterval\(/.test(code)) bad.push('setInterval 을 직접 부름 → screenTimer()');
  if (bad.length) fail(f + ' — ' + bad.join(' / '));
  else pass(f);
});

/* ── 마무리 ─────────────────────────────────────────── */
console.log('\n' + '─'.repeat(56));
if (errors) {
  console.log('  잘못된 곳 ' + errors + '가지' + (warns ? ' · 살펴볼 곳 ' + warns + '가지' : ''));
  process.exit(1);
}
console.log('  모두 통과' + (warns ? ' (살펴볼 곳 ' + warns + '가지)' : '') + '. 배포해도 됩니다.');
