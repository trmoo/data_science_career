/*!
 * 이어짐 점검 — 서버의 기준표(FIELDS·ACTIVITIES)와 화면이 어긋나지 않게 지킨다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * ⚠ 활동이나 서술 칸을 늘릴 때는 세 곳을 함께 고친다 —
 *   Code.gs 의 FIELDS·ACTIVITIES · data.html 의 screenActs·screenFields · 화면의 field()·grader().
 *   여기서 그 어긋남을 잡는다.
 */
import { describe, test, ok, eq, deepEq } from './harness.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadData, loadServer, readScript } = require('../tools/gas-load.js');

const DATA = loadData();
const { api } = loadServer();
const SCREEN_FILES = ['s1.html', 's2.html', 's3.html', 's4.html', 's5.html'];

/* 화면 파일에서 REG({id:'x', tab:n}) 을 긁어 온다 */
const regs = [];
SCREEN_FILES.forEach((f) => {
  const code = readScript(f);
  const re = /REG\(\{\s*\n?\s*id:\s*'([\w]+)',\s*tab:\s*(\d+)/g;
  let m;
  while ((m = re.exec(code)) !== null) regs.push({ id: m[1], tab: Number(m[2]), file: f });
});

function callsOf(pattern) {
  const out = {};
  SCREEN_FILES.forEach((f) => {
    const code = readScript(f);
    const re = new RegExp(pattern, 'g');
    let m;
    while ((m = re.exec(code)) !== null) {
      if (!out[m[1]]) out[m[1]] = [];
      out[m[1]].push(f);
    }
  });
  return out;
}

const graderCalls = callsOf("\\bgrader\\('([-\\w]+)'");
const scoreCalls = callsOf("\\bsetScore\\('([-\\w]+)'");
const fieldCalls = callsOf("\\bfield\\('([\\w]+)'");

describe('화면 등록', () => {
  test('화면이 열여섯 개 등록되어 있다', () => { eq(regs.length, 16); });
  test('화면 아이디가 겹치지 않는다', () => {
    eq(new Set(regs.map((r) => r.id)).size, regs.length);
  });
  test('data.html 의 표와 등록된 화면 목록이 같다', () => {
    deepEq(regs.map((r) => r.id).sort(), Object.keys(DATA.screenActs).sort());
  });
  test('탭 번호는 1~5 이고 탭마다 화면이 있다', () => {
    const tabs = {};
    regs.forEach((r) => {
      ok(r.tab >= 1 && r.tab <= 5, r.id + ' 의 탭 번호 ' + r.tab);
      tabs[r.tab] = (tabs[r.tab] || 0) + 1;
    });
    for (let t = 1; t <= 5; t++) ok(tabs[t] > 0, t + '번 탭에 화면이 없다');
  });
  test('한 화면의 파일과 탭이 맞는다 (s1→탭1 … s5→탭5)', () => {
    regs.forEach((r) => eq(r.tab, Number(r.file.charAt(1)), r.id));
  });
});

describe('활동 이어짐', () => {
  test('서버 활동은 일곱 가지, 다 열면 만점 41점', () => {
    eq(api.ACTIVITIES.length, 7);
    eq(api.ACTIVITIES.reduce((s, a) => s + a.max, 0), 41);
  });
  test('없앤 활동(tm-order)이 어디에도 남아 있지 않다', () => {
    ok(!api.ACTIVITIES.some((a) => a.key === 'tm-order'), '서버 활동 목록');
    ok(DATA.tmOrder === undefined, 'data.html 의 문항 자료');
    Object.keys(DATA.screenActs).forEach((s) => {
      ok(DATA.screenActs[s].indexOf('tm-order') < 0, s + ' 화면 표');
    });
  });
  test('만점은 이번 차시 범위의 활동만 더한다', () => {
    eq(api.totalMax_(), api.scopeActs_().reduce((s, a) => s + a.max, 0));
  });
  test('활동 열쇠가 겹치지 않는다', () => {
    eq(new Set(api.ACTIVITIES.map((a) => a.key)).size, 7);
  });
  test('screenActs 에 적힌 활동이 모두 서버에 있다', () => {
    const keys = api.ACTIVITIES.map((a) => a.key);
    Object.keys(DATA.screenActs).forEach((s) => {
      DATA.screenActs[s].forEach((k) => ok(keys.indexOf(k) >= 0, '없는 활동: ' + k + ' (' + s + ')'));
    });
  });
  test('서버 활동이 모두 어느 화면엔가 놓여 있다', () => {
    const placed = [];
    Object.keys(DATA.screenActs).forEach((s) => { placed.push.apply(placed, DATA.screenActs[s]); });
    api.ACTIVITIES.forEach((a) => ok(placed.indexOf(a.key) >= 0, a.key + ' 가 어느 화면에도 없다'));
  });
  test('활동마다 실제로 화면 코드가 있다 (grader 또는 setScore)', () => {
    api.ACTIVITIES.forEach((a) => {
      ok(graderCalls[a.key] || scoreCalls[a.key], a.key + ' 를 쓰는 화면 코드가 없다');
    });
  });
  test('화면이 부르는 활동 이름이 모두 서버에 있다', () => {
    const keys = api.ACTIVITIES.map((a) => a.key);
    Object.keys(graderCalls).forEach((k) => ok(keys.indexOf(k) >= 0, 'grader 오타: ' + k));
    Object.keys(scoreCalls).forEach((k) => ok(keys.indexOf(k) >= 0, 'setScore 오타: ' + k));
  });
  test('같은 활동을 두 화면에서 채점하지 않는다', () => {
    Object.keys(graderCalls).forEach((k) => {
      eq(new Set(graderCalls[k]).size, 1, k + ' 가 여러 파일에 있다');
    });
  });
  test('활동의 탭 번호가 놓인 화면의 탭과 같다', () => {
    const byId = {};
    regs.forEach((r) => { byId[r.id] = r; });
    api.ACTIVITIES.forEach((a) => {
      let screen = null;
      Object.keys(DATA.screenActs).forEach((s) => {
        if (DATA.screenActs[s].indexOf(a.key) >= 0) screen = s;
      });
      eq(a.tab, byId[screen].tab, a.key + ' (' + screen + ')');
    });
  });
  test('문항 수와 만점이 맞는 활동 — 자료에서 셀 수 있는 것만 확인', () => {
    const m = {};
    api.ACTIVITIES.forEach((a) => { m[a.key] = a.max; });
    eq(m['tm-change'], DATA.tmChange.length);
    eq(m['neg-sort'], DATA.negCases.length);
    eq(m['chain-order'], DATA.chain.length);
    eq(m['fix-match'], DATA.fixCases.length);
    eq(m['job-sort'], DATA.jobs.length);
    eq(m['spec-badge'], 5);
    eq(m['balance'], 4);
  });
});

describe('서술 칸 이어짐', () => {
  test('서버 서술 칸은 스물한 개다', () => { eq(api.FIELDS.length, 21); });
  test('서술 칸 열쇠가 겹치지 않는다', () => {
    eq(new Set(api.FIELDS.map((f) => f.key)).size, api.FIELDS.length);
  });
  test('번호(no)가 겹치지 않는다', () => {
    eq(new Set(api.FIELDS.map((f) => f.no)).size, api.FIELDS.length);
  });
  test('여섯 평가요소에 칸이 하나 이상씩 있다', () => {
    for (let i = 1; i <= 6; i++) {
      const n = api.FIELDS.filter((f) => String(f.no).charAt(0) === String(i)).length;
      ok(n > 0, i + '번 항목에 칸이 없다');
    }
  });
  test('screenFields 에 적힌 칸이 모두 서버에 있다', () => {
    const keys = api.FIELDS.map((f) => f.key);
    Object.keys(DATA.screenFields).forEach((s) => {
      DATA.screenFields[s].forEach((k) => ok(keys.indexOf(k) >= 0, '없는 칸: ' + k + ' (' + s + ')'));
    });
  });
  test('서버 서술 칸이 모두 어느 화면엔가 놓여 있다', () => {
    const placed = [];
    Object.keys(DATA.screenFields).forEach((s) => { placed.push.apply(placed, DATA.screenFields[s]); });
    api.FIELDS.forEach((f) => ok(placed.indexOf(f.key) >= 0, f.key + ' 가 어느 화면에도 없다'));
  });
  test('화면이 실제로 그 칸을 그린다 (field 호출)', () => {
    api.FIELDS.forEach((f) => ok(fieldCalls[f.key], f.key + ' 를 그리는 field() 호출이 없다'));
  });
  test('field() 로 부르는 이름이 모두 서버에 있다', () => {
    const keys = api.FIELDS.map((f) => f.key);
    Object.keys(fieldCalls).forEach((k) => ok(keys.indexOf(k) >= 0, 'field 오타: ' + k));
  });
  test('같은 칸을 두 화면에서 그리지 않는다', () => {
    Object.keys(fieldCalls).forEach((k) => {
      eq(new Set(fieldCalls[k]).size, 1, k + ' 가 여러 파일에 있다');
    });
  });
  test('칸의 탭 번호가 놓인 화면의 탭과 같다', () => {
    const byId = {};
    regs.forEach((r) => { byId[r.id] = r; });
    api.FIELDS.forEach((f) => {
      let screen = null;
      Object.keys(DATA.screenFields).forEach((s) => {
        if (DATA.screenFields[s].indexOf(f.key) >= 0) screen = s;
      });
      eq(f.tab, byId[screen].tab, f.key + ' (' + screen + ')');
    });
  });
  test('기준 글자 수가 1 이상이다', () => {
    api.FIELDS.forEach((f) => ok(f.min >= 1, f.key));
  });
  test('구체성 뱃지가 보는 다섯 칸이 서버에도 있다', () => {
    const keys = api.FIELDS.map((f) => f.key);
    ['case_who', 'case_when', 'case_what', 'case_how', 'case_data'].forEach((k) => {
      ok(keys.indexOf(k) >= 0, k);
    });
  });
  test('저울이 보는 네 칸이 서버에도 있고 기준이 60자다', () => {
    const m = {};
    api.FIELDS.forEach((f) => { m[f.key] = f; });
    ['pos_me', 'pos_soc', 'neg_me', 'neg_soc'].forEach((k) => {
      ok(m[k], k + ' 가 없다');
      eq(m[k].min, 60, k + ' 의 기준 글자 수 (판정 엔진의 60자와 같아야 한다)');
    });
  });
});

describe('시트 열 구성', () => {
  test('제출 현황 열 수 = 메타 + 서술 칸 + 활동', () => {
    eq(api.statusHeader_().length, api.META_COLS.length + api.FIELDS.length + api.ACTIVITIES.length);
  });
  test('진행률의 분모는 이번 차시 범위의 서술 칸 + 활동이다', () => {
    eq(api.stepCount_(), api.scopeFields_().length + api.scopeActs_().length);
  });
  test('범위를 다 열면 분모가 28 이 된다 (서술 21 + 활동 7)', () => {
    eq(api.FIELDS.length + api.ACTIVITIES.length, 28);
  });
  test('열 이름이 겹치지 않는다 (시트에서 헷갈리지 않게)', () => {
    const h = api.statusHeader_();
    eq(new Set(h).size, h.length);
  });
});

describe('차시 범위 (COURSE)', () => {
  const C = api.COURSE;
  const on = !!(C && C.screens && C.screens.length);

  test('범위에 적힌 화면이 모두 실재한다', () => {
    if (!on) { ok(true, '범위를 두지 않았다 — 전부 열린다'); return; }
    const ids = regs.map((r) => r.id);
    C.screens.forEach((s) => ok(ids.indexOf(s) >= 0, '없는 화면: ' + s));
  });
  test('제출 화면(report)이 범위에 들어 있다 — 없으면 제출할 수 없다', () => {
    if (!on) { ok(true); return; }
    ok(C.screens.indexOf('report') >= 0, '제출 단추는 report 화면에만 있다');
  });
  test('범위의 서술 칸 = 범위 화면들이 그리는 칸 (어긋나면 진행률이 100이 안 된다)', () => {
    if (!on) { ok(true); return; }
    const union = [];
    C.screens.forEach((s) => (DATA.screenFields[s] || []).forEach((k) => union.push(k)));
    deepEq(union.slice().sort(), C.fields.slice().sort());
  });
  test('범위의 활동 = 범위 화면들이 채점하는 활동', () => {
    if (!on) { ok(true); return; }
    const union = [];
    C.screens.forEach((s) => (DATA.screenActs[s] || []).forEach((k) => union.push(k)));
    deepEq(union.slice().sort(), C.acts.slice().sort());
  });
  test('범위 밖 화면의 칸은 범위에 섞여 있지 않다', () => {
    if (!on) { ok(true); return; }
    Object.keys(DATA.screenFields).forEach((s) => {
      if (C.screens.indexOf(s) >= 0) return;
      DATA.screenFields[s].forEach((k) => {
        ok(C.fields.indexOf(k) < 0, k + ' 은(는) 닫힌 화면 ' + s + ' 의 칸인데 범위에 들어 있다');
      });
    });
  });
  test('범위에 이름이 붙어 있다 (앱 정보에 보여 준다)', () => {
    if (!on) { ok(true); return; }
    ok(C.name && C.name.length > 2, '차시 이름');
  });
});

describe('화면 규칙', () => {
  test('화면 파일에서 setInterval·resize 를 직접 쓰지 않는다', () => {
    SCREEN_FILES.forEach((f) => {
      const code = readScript(f);
      ok(code.indexOf("window.addEventListener('resize'") < 0, f + ' — onResize() 를 쓸 것');
      ok(!/[^n]setInterval\(/.test(code), f + ' — screenTimer() 를 쓸 것');
    });
  });
  test('화면에서 「을(를)」 같은 조사를 쓰지 않는다 (JOSA 를 쓸 것)', () => {
    SCREEN_FILES.forEach((f) => {
      const code = readScript(f);
      ['을(를)', '은(는)', '이(가)', '과(와)'].forEach((j) => {
        ok(code.indexOf(j) < 0, f + ' 에 「' + j + '」 가 있다 — JOSA.eul()·eun()·i()·gwa() 를 쓸 것');
      });
    });
  });
  test('데이터·판정 파일에 DOM 만들기가 없다 (node 로 불러다 시험하므로)', () => {
    ['data.html', 'judge.html'].forEach((f) => {
      const code = readScript(f);
      ok(code.indexOf('document.') < 0, f + ' 에 document 가 있다');
      ok(!/\bh\('/.test(code), f + ' 에 h() 호출이 있다');
    });
  });
});
