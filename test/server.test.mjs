/*!
 * 서버 시험 — 가짜 시트 위에서 진짜 Code.gs 를 그대로 돌린다.
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { describe, test, ok, eq, deepEq, throws } from './harness.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { freshServer, loadServer, withStudent } = require('../tools/gas-load.js');

const LONG = (n) => '가'.repeat(n);

/** 서술 칸을 기준 글자 수만큼 다 채운 payload */
function fullPayload(api, extra) {
  const vals = {};
  api.FIELDS.forEach((f) => { vals[f.key] = LONG(f.min); });
  Object.keys(extra || {}).forEach((k) => { vals[k] = extra[k]; });
  const scores = {};
  api.ACTIVITIES.forEach((a) => { scores[a.key] = { g: a.max, a: true }; });
  return { v: 1, vals: vals, scores: scores, answers: { compass: [0, 1] } };
}

describe('시트 준비', () => {
  test('시트 네 장을 만든다', () => {
    const { api, gas } = freshServer();
    deepEq(Object.keys(gas.sheets).sort(),
      ['계정(비밀번호)', '작성 중(임시 저장)', '제출 기록(백업)', '제출 현황'].sort());
    ok(api);
  });
  test('제출 현황의 머리글이 기준표와 같다', () => {
    const { api, gas } = freshServer();
    const head = gas.sheets['제출 현황'].dump()[0];
    deepEq(head, api.statusHeader_());
  });
  test('계정 시트는 숨긴다 (비밀번호 해시가 보이지 않게)', () => {
    const { gas } = freshServer();
    ok(gas.sheets['계정(비밀번호)'].hidden);
  });
  test('두 번 실행해도 머리글이 망가지지 않는다', () => {
    const { api, gas } = freshServer();
    api.setupSheets();
    deepEq(gas.sheets['제출 현황'].dump()[0], api.statusHeader_());
  });
  test('편집기에서 ▶ 실행해 화면이 없어도 시트는 만들어진다', () => {
    const { api, gas } = freshServer({ noUi: true });
    eq(api.setupSheets(), 4);
    ok(gas.sheets['제출 현황']);
  });
  test('시트가 없으면 무엇을 해야 하는지 알려 주는 오류가 난다', () => {
    const { api } = loadServer();
    throws(() => api.sheet_('제출 현황'));
    try { api.sheet_('제출 현황'); } catch (e) {
      ok(e.message.indexOf('시트 준비하기') >= 0, e.message);
    }
  });
});

describe('학번·이름 다루기', () => {
  const { api } = loadServer();
  test('다섯 자리 학번을 학년·반·번호로 나눈다', () => {
    deepEq(api.parseSid_('20315'), { grade: 2, cls: 3, num: 15 });
  });
  test('네 자리 학번도 나눈다', () => {
    deepEq(api.parseSid_('2315'), { grade: 2, cls: 3, num: 15 });
  });
  test('형식이 다르면 빈 값이다', () => {
    deepEq(api.parseSid_('abc'), { grade: '', cls: '', num: '' });
  });
  test('학번은 숫자 4~5자리만 받는다', () => {
    eq(api.normSid_(' 20315 '), '20315');
    eq(api.normSid_('203'), '');
    eq(api.normSid_('203150'), '');
    eq(api.normSid_(null), '');
  });
  test('이름은 홍*동 처럼 가린다', () => {
    eq(api.maskName_('홍길동'), '홍*동');
    eq(api.maskName_('김영희'), '김*희');
    eq(api.maskName_('김영'), '김*');
    eq(api.maskName_('남궁민수'), '남**수');
  });
});

describe('로그인', () => {
  test('처음 오는 학번은 new 로 알려 준다', () => {
    const { api } = freshServer();
    const r = api.apiLookup('20101');
    ok(r.ok); eq(r.state, 'new');
  });
  test('학번 형식이 틀리면 까닭을 알려 준다', () => {
    const { api } = freshServer();
    const r = api.apiLookup('12');
    ok(!r.ok);
    ok(r.msg.indexOf('4~5자리') >= 0);
  });
  test('등록하면 접속표가 나오고, 다음에는 known 이 된다', () => {
    const { api } = freshServer();
    const r = api.apiRegister('20101', '홍길동', 'pw1234');
    ok(r.ok); ok(r.token.length > 10);
    const l = api.apiLookup('20101');
    eq(l.state, 'known');
    eq(l.masked, '홍*동');
  });
  test('이름이 한 글자면 막는다', () => {
    const { api } = freshServer();
    ok(!api.apiRegister('20101', '홍', 'pw1234').ok);
  });
  test('비밀번호가 네 글자보다 짧으면 막는다', () => {
    const { api } = freshServer();
    ok(!api.apiRegister('20101', '홍길동', 'pw1').ok);
  });
  test('비밀번호로 들어갈 수 있다', () => {
    const { api } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    const r = api.apiLogin('20101', 'pw1234');
    ok(r.ok); eq(r.name, '홍길동');
  });
  test('틀린 비밀번호는 막는다', () => {
    const { api } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    const r = api.apiLogin('20101', 'wrong');
    ok(!r.ok);
    ok(r.msg.indexOf('비밀번호') >= 0);
  });
  test('비밀번호는 시트에 그대로 저장되지 않는다', () => {
    const { api, gas } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    const dump = JSON.stringify(gas.sheets['계정(비밀번호)'].dump());
    ok(dump.indexOf('pw1234') < 0, '비밀번호가 시트에 보인다');
  });
  test('같은 비밀번호라도 학생마다 해시가 다르다 (솔트)', () => {
    const { api, gas } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    api.apiRegister('20102', '김영희', 'pw1234');
    const rows = gas.sheets['계정(비밀번호)'].dump();
    ok(rows[1][2] !== rows[2][2], '해시가 같다');
  });
  test('이미 비밀번호가 있는 학번으로 새로 등록할 수 없다', () => {
    const { api } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    ok(!api.apiRegister('20101', '홍길동', 'other1').ok);
  });
  test('초기화된 계정은 이름을 맞혀야 새 비밀번호를 정한다', () => {
    const { api } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    const a = api.accRow_('20101');
    api.sheet_('계정(비밀번호)').getRange(a.row, 3, 1, 5).setValues([['', '', '', '', '']]);

    eq(api.apiLookup('20101').state, 'reset');
    ok(!api.apiRegister('20101', '다른이름', 'new1234').ok, '이름이 다르면 막아야 한다');
    ok(api.apiRegister('20101', '홍길동', 'new1234').ok);
    ok(api.apiLogin('20101', 'new1234').ok);
  });
  test('초기화해도 작성한 내용은 남는다', () => {
    const { api } = freshServer();
    const token = withStudent(api, '20101', '홍길동', 'pw1234');
    api.apiSave(token, { v: 1, vals: { pos_me: LONG(60) }, scores: {}, answers: {} });
    const a = api.accRow_('20101');
    api.sheet_('계정(비밀번호)').getRange(a.row, 3, 1, 5).setValues([['', '', '', '', '']]);
    const r = api.apiRegister('20101', '홍길동', 'new1234');
    ok(r.ok);
    eq(r.data.vals.pos_me.length, 60, '작성 내용이 사라졌다');
  });
  test('접속표가 없으면 저장할 수 없다', () => {
    const { api } = freshServer();
    const r = api.apiSave('', { v: 1, vals: {}, scores: {}, answers: {} });
    ok(!r.ok); ok(r.expired);
  });
  test('나가기를 하면 접속표가 지워진다', () => {
    const { api } = freshServer();
    const token = withStudent(api);
    api.apiLogout(token);
    ok(!api.apiSave(token, { v: 1, vals: {}, scores: {}, answers: {} }).ok);
  });
  test('비밀번호를 스스로 바꿀 수 있고, 지금 비밀번호가 틀리면 막힌다', () => {
    const { api } = freshServer();
    const token = withStudent(api, '20101', '홍길동', 'pw1234');
    ok(!api.apiChangePw(token, 'wrong', 'new1234').ok);
    ok(api.apiChangePw(token, 'pw1234', 'new1234').ok);
    ok(api.apiLogin('20101', 'new1234').ok);
  });
});

describe('정리하기 (tally_)', () => {
  const { api } = loadServer();
  test('만점을 넘겨 보낸 점수는 만점으로 자른다', () => {
    const t = api.tally_({ scores: { 'job-sort': { g: 999, a: true } } });
    eq(t.per['job-sort'], 10);
  });
  test('음수 점수는 0 으로 자른다', () => {
    const t = api.tally_({ scores: { 'balance': { g: -5, a: true } } });
    eq(t.per['balance'], 0);
  });
  test('없는 활동 이름을 보내도 무시한다', () => {
    const t = api.tally_({ scores: { 'nope': { g: 5, a: true } } });
    eq(t.got, 0);
    ok(t.per['nope'] === undefined);
  });
  test('글자 수는 공백을 뺀다', () => {
    const t = api.tally_({ vals: { pos_me: '가 나 다' } });
    eq(t.chars, 3);
  });
  test('제어 문자는 지운다', () => {
    const t = api.tally_({ vals: { pos_me: '가 나다' } });
    eq(t.vals.pos_me, '가나다');
  });
  test('아주 긴 글은 잘라 낸다', () => {
    const t = api.tally_({ vals: { pos_me: LONG(5000) } });
    eq(t.vals.pos_me.length, 1500);
  });
  test('빈 payload 도 죽지 않는다', () => {
    const t = api.tally_(null);
    eq(t.filled, 0); eq(t.got, 0); eq(t.progress, 0);
  });
  test('진행률 = (채운 칸 + 손댄 활동) ÷ 전체', () => {
    const t = api.tally_({ vals: { pos_me: '가' }, scores: { balance: { g: 0, a: true } } });
    eq(t.filled, 1); eq(t.tried, 1);
    eq(t.progress, Math.round(2 / api.stepCount_() * 1000) / 10);
  });
  test('다 채우면 진행률이 100 이다 (이번 차시 범위 기준)', () => {
    const t = api.tally_(fullPayload(api));
    eq(t.progress, 100);
    eq(t.got, api.totalMax_());
    eq(t.enough, api.scopeFields_().length);
  });
  test('범위 안의 칸만 채워도 진행률이 100 이 된다', () => {
    const vals = {}, scores = {};
    api.scopeFields_().forEach((f) => { vals[f.key] = LONG(f.min); });
    api.scopeActs_().forEach((a) => { scores[a.key] = { g: a.max, a: true }; });
    const t = api.tally_({ v: 1, vals: vals, scores: scores, answers: {} });
    eq(t.progress, 100);
  });
  test('범위 밖 칸에 쓴 것도 값은 저장되지만 진행률에는 안 든다', () => {
    const outside = api.FIELDS.filter((f) => api.scopeFields_().indexOf(f) < 0)[0];
    if (!outside) { eq(1, 1); return; }
    const t = api.tally_({ v: 1, vals: { [outside.key]: LONG(outside.min) }, scores: {}, answers: {} });
    eq(t.vals[outside.key].length, outside.min, '값은 그대로 저장된다');
    eq(t.progress, 0, '진행률에는 들지 않는다');
  });
  test('범위 밖 활동 점수는 총점에 들지 않는다', () => {
    const outside = api.ACTIVITIES.filter((a) => api.scopeActs_().indexOf(a) < 0)[0];
    if (!outside) { eq(1, 1); return; }
    const t = api.tally_({ scores: { [outside.key]: { g: outside.max, a: true } } });
    eq(t.got, 0);
    eq(t.per[outside.key], outside.max, '점수 자체는 시트에 남는다');
  });
  test('기준 글자 수에 못 미치면 filled 는 세지만 enough 는 안 센다', () => {
    const t = api.tally_({ vals: { pos_me: '가' } });
    eq(t.filled, 1); eq(t.enough, 0);
  });
  test('진로 분야를 따로 뽑아 둔다 (시트 앞쪽 열)', () => {
    const t = api.tally_({ vals: { career_field: '보건·의료 데이터' } });
    eq(t.career, '보건·의료 데이터');
  });
  test('구체성 뱃지 점수를 따로 뽑아 둔다', () => {
    const t = api.tally_({ scores: { 'spec-badge': { g: 4, a: true } } });
    eq(t.spec, 4);
  });
});

describe('저장과 제출', () => {
  test('자동 저장은 작성 중 시트에 학생 1명 = 1줄로 쓴다', () => {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    api.apiSave(token, { v: 1, vals: { pos_me: LONG(60) }, scores: {}, answers: {} });
    api.apiSave(token, { v: 1, vals: { pos_me: LONG(70) }, scores: {}, answers: {} });
    eq(gas.sheets['작성 중(임시 저장)'].getLastRow(), 2, '머리글 + 한 줄');
  });
  test('자동 저장이 제출 현황도 갱신한다 (작성 중에도 교사가 본다)', () => {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    api.apiSave(token, { v: 1, vals: { pos_me: LONG(60) }, scores: {}, answers: {} });
    const row = gas.sheets['제출 현황'].dump()[1];
    const iProg = api.META_COLS.indexOf('진행률(%)');
    const iSub = api.META_COLS.indexOf('제출 시각');
    eq(String(row[0]), '20101');
    ok(Number(row[iProg]) > 0, '진행률이 적혀 있어야 한다');
    eq(row[iSub], '', '아직 제출하지 않았으므로 제출 시각은 비어 있다');
  });
  test('제출하면 제출 시각과 백업 줄이 남는다', () => {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    const r = api.apiSubmit(token, fullPayload(api, { career_field: '데이터 분석가' }));
    ok(r.ok); ok(r.at.length >= 10);
    ok(gas.sheets['제출 현황'].dump()[1][6], '제출 시각이 비었다');
    eq(gas.sheets['제출 기록(백업)'].getLastRow(), 2);
  });
  test('⚠ 제출한 뒤 자동 저장을 해도 제출 시각이 지워지지 않는다', () => {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    api.apiSubmit(token, fullPayload(api));
    const before = gas.sheets['제출 현황'].dump()[1][6];
    api.apiSave(token, { v: 1, vals: { pos_me: LONG(60) }, scores: {}, answers: {} });
    const after = gas.sheets['제출 현황'].dump()[1][6];
    eq(String(after), String(before), '제출 시각이 사라졌다 — writeStatus_ 의 keep 처리를 확인할 것');
  });
  test('두 번 제출하면 백업은 두 줄, 현황은 한 줄이다', () => {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    api.apiSubmit(token, fullPayload(api));
    api.apiSubmit(token, fullPayload(api));
    eq(gas.sheets['제출 기록(백업)'].getLastRow(), 3);
    eq(gas.sheets['제출 현황'].getLastRow(), 2);
  });
  test('이어서 쓰기 — 저장한 것을 다시 불러온다', () => {
    const { api } = freshServer();
    const token = withStudent(api);
    api.apiSave(token, { v: 1, vals: { pos_me: '이어서' }, scores: { balance: { g: 2, a: true } },
      answers: { compass: [1, 2] } });
    const r = api.apiLoad(token);
    ok(r.ok);
    eq(r.data.vals.pos_me, '이어서');
    deepEq(r.data.answers.compass, [1, 2]);
  });
  test('다시 로그인해도 쓴 것이 남아 있다', () => {
    const { api } = freshServer();
    const token = withStudent(api, '20101', '홍길동', 'pw1234');
    api.apiSave(token, { v: 1, vals: { prep_now: '집에서 이어서' }, scores: {}, answers: {} });
    const again = api.apiLogin('20101', 'pw1234');
    eq(again.data.vals.prep_now, '집에서 이어서');
  });
  test('서술 원문이 시트의 제 열에 들어간다', () => {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    api.apiSave(token, { v: 1, vals: { case_who: '기상청' }, scores: {}, answers: {} });
    const head = gas.sheets['제출 현황'].dump()[0];
    const row = gas.sheets['제출 현황'].dump()[1];
    let col = -1;
    api.FIELDS.forEach((f, i) => { if (f.key === 'case_who') col = api.META_COLS.length + i; });
    ok(col > 0);
    ok(String(head[col]).indexOf('누가') >= 0, head[col]);
    eq(row[col], '기상청');
  });
});

describe('제출 마감', () => {
  test('마감하면 제출이 막히고, 저장은 계속된다', () => {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    gas.PropertiesService.getDocumentProperties().setProperty('closed', '1');
    ok(api.isClosed_());
    const r = api.apiSubmit(token, fullPayload(api));
    ok(!r.ok);
    ok(r.msg.indexOf('마감') >= 0);
    ok(api.apiSave(token, { v: 1, vals: {}, scores: {}, answers: {} }).ok, '저장은 계속되어야 한다');
  });
  test('다시 열면 제출된다', () => {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    gas.PropertiesService.getDocumentProperties().setProperty('closed', '1');
    gas.PropertiesService.getDocumentProperties().setProperty('closed', '0');
    ok(api.apiSubmit(token, fullPayload(api)).ok);
  });
  test('화면에 보내는 값에 마감 여부가 들어 있다', () => {
    const { api, gas } = freshServer();
    eq(api.clientBoot_().closed, false);
    gas.PropertiesService.getDocumentProperties().setProperty('closed', '1');
    eq(api.clientBoot_().closed, true);
  });
});

describe('우리 반 분포 (이름 없이 개수만)', () => {
  function seed(api, list) {
    list.forEach((x, i) => {
      const t = withStudent(api, String(20201 + i), '학생' + i, 'pw1234');
      api.apiSave(t, { v: 1, vals: { career_field: x }, scores: {}, answers: {} });
    });
  }
  test('세 명보다 적으면 열리지 않는다', () => {
    const { api } = freshServer();
    seed(api, ['데이터 분석가', '데이터 분석가']);
    const r = api.classStat_();
    ok(r.ok); eq(r.enough, false); eq(r.n, 2); eq(r.rows.length, 0);
  });
  test('세 명부터 열리고 많은 순으로 늘어놓는다', () => {
    const { api } = freshServer();
    seed(api, ['데이터 분석가', '보건·의료 데이터', '데이터 분석가', '정보 보호·보안']);
    const r = api.classStat_();
    ok(r.enough); eq(r.n, 4);
    eq(r.rows[0].name, '데이터 분석가');
    eq(r.rows[0].count, 2);
    eq(r.rows.length, 3);
  });
  test('진로 분야를 안 적은 학생은 세지 않는다', () => {
    const { api } = freshServer();
    seed(api, ['데이터 분석가', '', '데이터 분석가', '  ']);
    eq(api.classStat_().n, 2);
  });
  test('접속표가 있어야 볼 수 있다', () => {
    const { api } = freshServer();
    ok(!api.apiClassStat('없는표').ok);
  });
  test('빈 시트에서도 죽지 않는다', () => {
    const { api } = freshServer();
    const r = api.classStat_();
    eq(r.n, 0); eq(r.enough, false);
  });
});

describe('제출 후 수정 표시', () => {
  function seeded() {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    return { api, gas, token };
  }
  const rowOf = (api, gas) => gas.sheets['제출 현황'].dump().filter((r) => String(r[0]) === '20101')[0];
  const iEdit = (api) => api.META_COLS.indexOf('제출 후 수정');
  const iSub = (api) => api.META_COLS.indexOf('제출 시각');

  test('메타 열에 「제출 후 수정」 이 있다', () => {
    const { api } = seeded();
    ok(iEdit(api) > 0);
    eq(api.META_COLS[iEdit(api) - 1], '제출 시각', '제출 시각 바로 뒤에 있어야 한다');
  });
  test('제출 전 자동 저장은 「제출 후 수정」 을 비워 둔다', () => {
    const { api, gas, token } = seeded();
    api.apiSave(token, { v: 1, vals: { pos_me: LONG(60) }, scores: {}, answers: {} });
    eq(rowOf(api, gas)[iEdit(api)], '');
  });
  test('제출한 뒤 자동 저장하면 「제출 후 수정」 에 시각이 찍힌다', () => {
    const { api, gas, token } = seeded();
    api.apiSubmit(token, fullPayload(api));
    eq(rowOf(api, gas)[iEdit(api)], '', '제출 직후에는 비어 있다');
    api.apiSave(token, { v: 1, vals: { pos_me: LONG(70) }, scores: {}, answers: {} });
    ok(rowOf(api, gas)[iEdit(api)], '제출 뒤에 고쳤으면 표시가 남아야 한다');
    ok(rowOf(api, gas)[iSub(api)], '제출 시각은 그대로 남는다');
  });
  test('다시 제출하면 「제출 후 수정」 이 지워진다', () => {
    const { api, gas, token } = seeded();
    api.apiSubmit(token, fullPayload(api));
    api.apiSave(token, { v: 1, vals: { pos_me: LONG(70) }, scores: {}, answers: {} });
    ok(rowOf(api, gas)[iEdit(api)]);
    api.apiSubmit(token, fullPayload(api));
    eq(rowOf(api, gas)[iEdit(api)], '');
  });
});

describe('교사 메뉴가 차시 범위를 지킨다', () => {
  function withSubmitted() {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    const vals = {}, scores = {};
    api.scopeFields_().forEach((f) => { vals[f.key] = LONG(f.min); });
    api.scopeActs_().forEach((a) => { scores[a.key] = { g: a.max, a: true }; });
    api.apiSubmit(token, { v: 1, vals: vals, scores: scores, answers: {} });
    return { api, gas, token };
  }

  test('현황 요약에 잠긴 활동이 0점으로 나오지 않는다', () => {
    const { api } = withSubmitted();
    const s = api.summaryText_();
    api.ACTIVITIES.forEach((a) => {
      const open = api.scopeActs_().some((x) => x.key === a.key);
      if (!open) ok(s.indexOf(a.label) < 0, '잠긴 활동 「' + a.label + '」 이 요약에 있다');
    });
  });
  test('현황 요약에 잠긴 서술 칸이 나오지 않는다', () => {
    const { api } = withSubmitted();
    const s = api.summaryText_();
    api.FIELDS.forEach((f) => {
      const open = api.scopeFields_().some((x) => x.key === f.key);
      if (!open) ok(s.indexOf(f.no + ' ' + f.title) < 0, '잠긴 칸 「' + f.title + '」 이 요약에 있다');
    });
  });
  test('현황 요약이 보는 범위를 밝힌다', () => {
    const { api } = withSubmitted();
    const s = api.summaryText_();
    ok(s.indexOf('보는 범위') >= 0, s.slice(0, 120));
  });
  test('범위를 다 한 학생은 요약에 ⚠ 표시가 붙지 않는다', () => {
    const { api } = withSubmitted();
    /* 「⚠ 는 …」 이라고 알려 주는 머리글 줄은 세지 않는다 — ⚠ 로 시작하는 항목 줄만 본다 */
    const flagged = api.summaryText_().split('\n').filter((l) => l.indexOf('⚠ ') === 0);
    deepEq(flagged, [], '가짜 경고가 남아 있다');
  });
  test('기록이 없으면 요약은 null 을 돌려준다', () => {
    const { api } = freshServer();
    eq(api.summaryText_(), null);
  });
  test('학생 답 자세히 보기도 잠긴 칸을 보여 주지 않는다', () => {
    const { api } = withSubmitted();
    const d = api.detailText_('20101', '홍길동', '', null);
    api.FIELDS.forEach((f) => {
      const open = api.scopeFields_().some((x) => x.key === f.key);
      if (!open) ok(d.indexOf('[' + f.no + ']') < 0, '잠긴 칸 「' + f.title + '」 이 나온다');
    });
    ok(d.indexOf('잠긴 서술 칸') >= 0, '잠긴 칸이 몇 개인지 알려 준다');
  });
  test('범위 밖에 쓴 것이 있으면 따로 모아 보여 준다', () => {
    const { api } = freshServer();
    const token = withStudent(api);
    const outside = api.FIELDS.filter((f) => !api.scopeFields_().some((x) => x.key === f.key))[0];
    ok(outside, '범위 밖 칸이 있어야 이 시험이 뜻이 있다');
    const vals = {};
    vals[outside.key] = LONG(outside.min);
    api.apiSave(token, { v: 1, vals: vals, scores: {}, answers: {} });
    const d = api.detailText_('20101', '홍길동', '', null);
    ok(d.indexOf('이번 차시 범위 밖에 쓴 것') >= 0, d.slice(-300));
    ok(d.indexOf('[' + outside.no + ']') >= 0, '범위 밖에 쓴 칸은 보여 준다');
  });
  test('제출 뒤 고친 학생은 자세히 보기에서 알려 준다', () => {
    const { api } = withSubmitted();
    const d = api.detailText_('20101', '홍길동', new Date(), null);
    ok(d.indexOf('제출한 뒤에 고쳤습니다') >= 0);
  });
});

describe('겹쳐 쓰기 막기 (LockService)', () => {
  test('저장·제출·등록이 자물쇠를 쓴다', () => {
    const { api } = freshServer();
    const token = withStudent(api);
    /* 가짜 자물쇠는 한 번에 하나만 잡히므로, 자물쇠를 놓지 않으면 다음 호출이 막힌다.
       세 함수가 모두 정상으로 돌아오면 잡고 놓기를 제대로 하고 있다는 뜻이다. */
    ok(api.apiSave(token, { v: 1, vals: {}, scores: {}, answers: {} }).ok);
    ok(api.apiSubmit(token, fullPayload(api)).ok);
    ok(api.apiRegister('20999', '새학생', 'pw1234').ok);
    ok(api.apiSave(token, { v: 1, vals: {}, scores: {}, answers: {} }).ok, '자물쇠를 놓지 않았다');
  });
  test('withLock_ 은 자물쇠가 없어도 일을 한다', () => {
    const { api } = freshServer();
    eq(api.withLock_(function () { return 7; }), 7);
  });
});

describe('교사 메뉴', () => {
  test('메뉴를 만드는 데 실패하지 않는다', () => {
    const { api } = freshServer();
    api.onOpen();
    ok(true);
  });
  test('앱 정보를 띄운다', () => {
    const { api, gas } = freshServer();
    api.menuAbout();
    ok(gas.alerts.length > 0);
    ok(gas.alerts.join(' ').indexOf('티쳐무') >= 0);
  });
  test('기록이 없으면 요약이 그렇다고 알려 준다', () => {
    const { api, gas } = freshServer();
    api.menuSummary();
    ok(gas.alerts.join(' ').indexOf('아직') >= 0);
  });
  test('학생이 있으면 요약이 돈다', () => {
    const { api } = freshServer();
    const token = withStudent(api);
    api.apiSubmit(token, fullPayload(api));
    api.menuSummary();
    ok(true);
  });
  test('미제출 학생을 찾아낸다', () => {
    const { api } = freshServer();
    const t1 = withStudent(api, '20101', '홍길동', 'pw1234');
    const t2 = withStudent(api, '20102', '김영희', 'pw1234');
    api.apiSubmit(t1, fullPayload(api));
    api.apiSave(t2, { v: 1, vals: { pos_me: LONG(60) }, scores: {}, answers: {} });
    api.menuNotSubmitted();
    ok(true);
  });
  test('고른 줄의 학생 답을 자세히 볼 수 있다', () => {
    const { api, gas } = freshServer();
    const token = withStudent(api);
    api.apiSubmit(token, fullPayload(api, { case_who: '기상청' }));
    gas.SpreadsheetApp._setActive('제출 현황', 2);
    api.menuDetail();
    ok(true);
  });
  test('제출 현황 시트가 아니면 알려 준다', () => {
    const { api, gas } = freshServer();
    gas.SpreadsheetApp._setActive('작성 중(임시 저장)', 2);
    api.menuDetail();
    ok(gas.alerts.join(' ').indexOf('제출 현황') >= 0);
  });
  test('반 분포 메뉴가 돈다', () => {
    const { api } = freshServer();
    api.menuClassStat();
    ok(true);
  });
  test('비밀번호 초기화 메뉴 — 없는 학번이면 알려 준다', () => {
    const { api, gas } = freshServer({ promptAnswer: '29999' });
    api.menuResetPw();
    ok(gas.alerts.join(' ').indexOf('계정이 없습니다') >= 0);
  });
  test('비밀번호 초기화 메뉴가 실제로 지운다', () => {
    const { api } = freshServer({ promptAnswer: '20101' });
    api.apiRegister('20101', '홍길동', 'pw1234');
    api.menuResetPw();
    eq(api.apiLookup('20101').state, 'reset');
  });
  test('제출 마감 메뉴가 값을 바꾼다', () => {
    const { api } = freshServer();
    api.menuToggleClose();
    ok(api.isClosed_());
    api.menuToggleClose();
    ok(!api.isClosed_());
  });
});

describe('공개 주소 (?api=stat)', () => {
  test('개인정보 없이 참여 수만 알려 준다', () => {
    const { api } = freshServer();
    const token = withStudent(api);
    api.apiSave(token, { v: 1, vals: { pos_me: LONG(60) }, scores: {}, answers: {} });
    const out = JSON.parse(api.doGet({ parameter: { api: 'stat' } }).getContent());
    ok(out.ok); eq(out.students, 1); eq(out.totalMax, api.totalMax_());
    ok(JSON.stringify(out).indexOf('홍길동') < 0, '이름이 새어 나간다');
  });
  test('시트를 준비하지 않았어도 죽지 않는다', () => {
    const { api } = loadServer();
    const out = JSON.parse(api.doGet({ parameter: { api: 'stat' } }).getContent());
    eq(out.ok, false); eq(out.students, 0);
  });
});

describe('화면에 보내는 기준표', () => {
  test('서술 칸과 활동 표를 함께 보낸다', () => {
    const { api } = freshServer();
    const b = api.clientBoot_();
    eq(b.fields.length, api.FIELDS.length);
    eq(b.activities.length, api.ACTIVITIES.length);
    eq(b.tabs.length, 5);
    eq(b.steps, api.stepCount_());
    eq(b.preview, false);
  });
});
