/*!
 * 판정 엔진 — 구체성 뱃지·저울·나침반·역량 격차·조사
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * ⚠ 이 판정은 규칙으로 훑는 것이라 완벽하지 않다. 시험이 지키는 것은
 *   「학생이 실제로 쓸 만한 답은 통과하고, 뭉뚱그린 답은 막힌다」 는 선이다.
 */
import { describe, test, ok, eq, deepEq } from './harness.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadJudge } = require('../tools/gas-load.js');

const { DATA, JUDGE, JOSA } = loadJudge();

describe('글자 세기와 뭉뚱그린 표현', () => {
  test('공백은 글자 수에서 뺀다 (스페이스로 칸 채우기 막기)', () => {
    eq(JUDGE.len('   '), 0);
    eq(JUDGE.len(' 가 나 다 '), 3);
    eq(JUDGE.len(null), 0);
  });
  test('뭉뚱그린 표현을 찾아낸다', () => {
    deepEq(JUDGE.vague('요즘 많은 기업들이 한다').slice().sort(), ['많은 기업', '요즘']);
    deepEq(JUDGE.vague('국립암센터 연구팀이 2016년에'), []);
  });
  test('뭉뚱그린 표현은 두 갈래로 나뉘어 있다', () => {
    ok(DATA.vagueAnon.length >= 8, '이름 자리를 대신하는 말');
    ok(DATA.vagueHedge.length >= 6, '흐릿한 말');
    deepEq(DATA.vague.slice().sort(), DATA.vagueAnon.concat(DATA.vagueHedge).slice().sort());
    const both = DATA.vagueAnon.filter((w) => DATA.vagueHedge.indexOf(w) >= 0);
    deepEq(both, [], '두 갈래에 같은 말이 들어 있으면 판정이 헷갈린다');
  });
  test('anon 과 hedge 를 가려낸다', () => {
    eq(JUDGE.anon('여러 기업이 쓴다'), '여러 기업');
    eq(JUDGE.anon('요즘 쓴다'), '');
    eq(JUDGE.hedge('요즘 쓴다'), '요즘');
  });
});

describe('이름 찾기 (nameIn)', () => {
  test('알려진 이름·끝소리·영문 이름을 찾는다', () => {
    ok(JUDGE.nameIn('네이버 지도팀').ok);
    ok(JUDGE.nameIn('국립암센터 연구팀').ok);
    ok(JUDGE.nameIn('DeepMind 가 만든').ok);
    ok(JUDGE.nameIn('김철수 교수').ok);
  });
  test('흔한 영어 낱말은 이름으로 보지 않는다', () => {
    ok(!JUDGE.nameIn('Because 다들 그렇게 생각해서').ok);
    ok(!JUDGE.nameIn('However 그렇지 않았다').ok);
  });
  test('이름이 없으면 못 찾았다고 한다', () => {
    ok(!JUDGE.nameIn('여러 기업이 한다').ok);
  });
});

describe('서비스 이름 (namedService)', () => {
  test('이름이 앞에 붙은 서비스 낱말만 인정한다', () => {
    eq(JUDGE.namedService('지도 앱으로 길을 찾는다'), '지도 앱');
    eq(JUDGE.namedService('전자의무기록 시스템'), '전자의무기록 시스템');
  });
  test('꾸밈말만 붙은 것은 이름이 아니다', () => {
    eq(JUDGE.namedService('이 서비스는 편리하다'), '');
    eq(JUDGE.namedService('어떤 앱이 있다'), '');
    eq(JUDGE.namedService('여러 앱이 있다'), '');
  });
});

describe('뱃지 ① 누가', () => {
  const pass = ['국립암센터 연구팀', '네이버 지도팀', '기상청', '삼성전자',
                '서울대 연구소', 'Google 연구팀', '김철수 교수', '한국도로공사'];
  pass.forEach((t) => test('통과 — ' + t, () => {
    const r = JUDGE.who(t);
    ok(r.ok, t + ' → ' + r.why);
    ok(r.why.length > 5, '이유가 함께 나와야 한다');
  }));
  const fail = ['', '어떤 회사', '많은 기업들', '요즘 기업', '회사', '사람들',
                'Because 다들 그렇게 생각해서'];
  fail.forEach((t) => test('막힘 — 「' + t + '」', () => {
    const r = JUDGE.who(t);
    ok(!r.ok, t + ' 은(는) 이름이 아니다');
    ok(r.why.length > 5, '왜 안 되는지 알려 줘야 한다');
  }));
  test('★ 이름을 밝혔으면 「여러 기업」 같은 말이 섞여도 통과한다', () => {
    const r = JUDGE.who('네이버·카카오모빌리티 등 여러 기업이 택시 배차에 쓴다');
    ok(r.ok, r.why);
    ok(r.why.indexOf('네이버') >= 0, '무엇을 이름으로 보았는지 알려 준다');
    ok(r.why.indexOf('여러 기업') >= 0, '뭉뚱그린 말은 없어도 된다고 알려 준다');
  });
});

describe('뱃지 ② 언제', () => {
  test('연도를 찾아낸다', () => {
    const r = JUDGE.when('2016년 무렵');
    ok(r.ok); eq(r.year, 2016);
  });
  test('연도만 적어도 통과한다', () => { ok(JUDGE.when('2020').ok); });
  test('「○○년대」 도 통과한다', () => { ok(JUDGE.when('90 년 대').ok); });
  test('「요즘」 은 막힌다', () => {
    const r = JUDGE.when('요즘');
    ok(!r.ok);
    ok(r.why.indexOf('연도') >= 0);
  });
  test('빈 칸은 막힌다', () => { ok(!JUDGE.when('').ok); });
  test('말이 안 되는 연도는 막힌다', () => { ok(!JUDGE.when('2999년').ok); });
});

describe('뱃지 ③ 무엇을', () => {
  test('서비스 이름이 들어가면 통과한다', () => {
    ok(JUDGE.what('실시간 교통정보 지도 앱 길 안내 기능').ok);
    ok(JUDGE.what('전자의무기록 시스템').ok);
  });
  test('영문 이름·모델명은 통과한다', () => { ok(JUDGE.what('AlphaFold 단백질 구조 예측').ok); });
  test('★ 로마자·숫자가 한 글자 섞인 것만으로는 통과하지 않는다', () => {
    const r = JUDGE.what('이 서비스는 사람들이 많이 이용합니다2');
    ok(!r.ok, r.why);
  });
  test('★ 꾸밈말만 붙은 서비스 낱말은 통과하지 않는다', () => {
    ok(!JUDGE.what('어떤 앱이 아주 편리하게 만들어 줍니다').ok);
  });
  test('이름이 붙은 서비스 낱말은 무엇을 이름으로 보았는지 알려 준다', () => {
    const r = JUDGE.what('실시간 교통정보를 반영하는 지도 앱 길 안내 기능');
    ok(r.ok);
    ok(r.why.indexOf('지도 앱') >= 0, r.why);
  });
  test('짧으면 막힌다', () => { ok(!JUDGE.what('지도').ok); });
  test('뭉뚱그린 표현은 막힌다', () => {
    const r = JUDGE.what('요즘 나오는 여러 기업의 인공지능');
    ok(!r.ok);
  });
  test('빈 칸은 막힌다', () => { ok(!JUDGE.what('').ok); });
});

describe('뱃지 ④ 어떻게', () => {
  const good = '이용자 기기가 보내는 위치와 속도를 모아 구간마다 지금 걸리는 시간을 계산하고, ' +
               '더 빠른 길로 경로를 다시 잡아 안내한다.';
  test('길고 동작이 드러나면 통과한다', () => {
    const r = JUDGE.how(good);
    ok(r.ok, r.why);
  });
  test('짧으면 막히고 글자 수를 알려 준다', () => {
    const r = JUDGE.how('데이터를 모아서 쓴다');
    ok(!r.ok);
    ok(r.why.indexOf('40자') >= 0, r.why);
  });
  test('길지만 동작 낱말이 없으면 막힌다', () => {
    const t = '그것은 아주 훌륭한 것이며 사람들에게 좋은 일이 되었고 앞으로도 그럴 것이라고 나는 생각한다.';
    ok(JUDGE.len(t) >= 40);
    const r = JUDGE.how(t);
    ok(!r.ok, r.why);
  });
  test('뭉뚱그린 표현이 있으면 막힌다', () => {
    ok(!JUDGE.how('요즘 많은 기업들이 데이터를 수집하고 분석해서 여러 가지 좋은 서비스를 만들고 있다고 한다.').ok);
  });
});

describe('뱃지 ⑤ 어떤 데이터', () => {
  test('무엇의 기록인지 밝히면 통과한다', () => {
    const r = JUDGE.data('수많은 이용자 기기의 위치·속도 기록과 과거 통행 시간 기록');
    ok(r.ok, r.why);
  });
  test('★ 「데이터」 한 낱말은 막히고, 무엇의 기록인지 묻는다 (죽은 코드가 아니다)', () => {
    const r = JUDGE.data('데이터');
    ok(!r.ok);
    ok(r.why.indexOf('무엇의 기록') >= 0, r.why);
  });
  test('★ 다른 데이터 낱말 하나만 적어도 같은 안내가 나온다', () => {
    const r = JUDGE.data('측정값');
    ok(!r.ok);
    ok(r.why.indexOf('무엇의 기록') >= 0, r.why);
  });
  test('★ 이름을 밝혔으면 「여러 기업」 이 섞여도 데이터 판정이 막지 않는다', () => {
    const r = JUDGE.data('네이버 등 여러 기업이 모은 이용자 위치·속도 기록과 통행 시간 기록');
    ok(r.ok, r.why);
  });
  test('데이터 낱말이 아예 없으면 막힌다', () => {
    ok(!JUDGE.data('아주 많은 것을 모아서 좋은 결과를 얻었다고 한다').ok);
  });
  test('짧으면 글자 수를 알려 준다', () => {
    const r = JUDGE.data('이용자의 위치 기록');
    ok(!r.ok);
    ok(r.why.indexOf('15자') >= 0, r.why);
  });
});

describe('구체성 뱃지 다섯 개', () => {
  const full = {
    case_who: '국립암센터 연구팀',
    case_when: '2016년',
    case_what: '흉부 영상 판독을 돕는 프로그램',
    case_how: '수많은 흉부 영상과 판독 결과를 학습해, 새 영상에서 의심되는 곳을 표시하고 ' +
              '의사가 확인할 순서를 정해 준다.',
    case_data: '오랫동안 쌓인 흉부 영상과 그에 붙은 판독 기록'
  };
  test('다 채우면 다섯 개가 켜진다', () => {
    const r = JUDGE.spec(full);
    eq(r.got, 5, r.badges.filter((b) => !b.ok).map((b) => b.badge + ':' + b.why).join(' / '));
    eq(r.of, 5);
  });
  test('빈 답이면 하나도 켜지지 않고, 다섯 개 모두 이유가 붙는다', () => {
    const r = JUDGE.spec({});
    eq(r.got, 0);
    eq(r.badges.length, 5);
    r.badges.forEach((b) => ok(b.why.length > 5, b.badge));
  });
  test('한 칸만 뭉뚱그리면 그 칸만 꺼진다', () => {
    const v = Object.assign({}, full, { case_who: '어떤 회사' });
    const r = JUDGE.spec(v);
    eq(r.got, 4);
    eq(r.badges.filter((b) => !b.ok)[0].badge, '누가');
  });
  test('뱃지 개수는 활동 만점(5)과 같다', () => {
    eq(JUDGE.specKeys.length, 5);
  });
});

describe('양팔 저울', () => {
  const long = (n) => '가'.repeat(n);
  test('네 칸을 다 채우면 수평이다', () => {
    const r = JUDGE.balance({ pos_me: long(60), pos_soc: long(60), neg_me: long(60), neg_soc: long(60) });
    eq(r.got, 4); eq(r.tilt, 0);
    ok(r.msg.indexOf('수평') >= 0, r.msg);
  });
  test('긍정만 채우면 긍정 쪽으로 기운다', () => {
    const r = JUDGE.balance({ pos_me: long(60), pos_soc: long(60) });
    eq(r.pos, 2); eq(r.neg, 0); eq(r.tilt, 2);
    ok(r.msg.indexOf('긍정') >= 0, r.msg);
  });
  test('부정만 채우면 부정 쪽으로 기운다', () => {
    const r = JUDGE.balance({ neg_me: long(60), neg_soc: long(60) });
    eq(r.tilt, -2);
    ok(r.msg.indexOf('부정') >= 0, r.msg);
  });
  test('개인만 두 쪽 채우면 균형이지만 네 칸이 아니다', () => {
    const r = JUDGE.balance({ pos_me: long(60), neg_me: long(60) });
    eq(r.got, 2); eq(r.tilt, 0);
    ok(r.msg.indexOf('한쪽이 비어') >= 0, r.msg);
  });
  test('기준 글자 수에 못 미치면 저울에 올라가지 않는다', () => {
    const r = JUDGE.balance({ pos_me: long(59) });
    eq(r.got, 0);
    eq(r.per[0].len, 59);
  });
  test('빈 답이면 아무 칸도 없다고 알려 준다', () => {
    const r = JUDGE.balance({});
    eq(r.got, 0);
    ok(r.msg.indexOf('아직') >= 0);
  });
});

describe('진로 나침반', () => {
  test('답을 안 하면 후보가 없다', () => {
    const r = JUDGE.compass([]);
    eq(r.answered, 0);
    eq(r.top.length, 0);
  });
  test('열두 문항에 첫 보기를 고르면 후보 세 개가 이유와 함께 나온다', () => {
    const r = JUDGE.compass(DATA.compass.map(() => 0));
    eq(r.answered, 12);
    eq(r.top.length, 3);
    r.top.forEach((t) => {
      ok(t.why && t.why.length > 5, t.name + ' 에 이유가 없다 — 이유 없는 추천은 하지 않는다');
      ok(t.score > 0);
    });
  });
  test('점수가 높은 순으로 늘어놓는다', () => {
    const r = JUDGE.compass(DATA.compass.map(() => 0));
    for (let i = 1; i < r.rank.length; i++) ok(r.rank[i - 1].score >= r.rank[i].score);
  });
  test('보건 쪽 답을 고르면 보건·의료 데이터가 후보에 든다', () => {
    /* 3번(관심 분야)에서 「사람의 몸과 건강」, 11번에서 「병원·연구소」, 12번에서 「사람을 돕는 일」 */
    const picks = [];
    picks[2] = 0; picks[10] = 0; picks[11] = 0;
    picks[5] = 2;   /* 생명·화학·지구과학 */
    const r = JUDGE.compass(picks);
    ok(r.top.some((t) => t.key === 'health'), r.top.map((t) => t.name).join(', '));
  });
  test('보안 쪽 답을 고르면 정보 보호·보안이 후보에 든다', () => {
    const picks = [];
    picks[1] = 1;   /* 내 정보가 어디까지 가는 걸까 */
    picks[4] = 1;   /* 개인정보 유출 사고 */
    picks[7] = 0;   /* 데이터를 잘못 쓰는 일이 자주 눈에 띈다 */
    picks[11] = 2;  /* 무언가를 지키는 일 */
    const r = JUDGE.compass(picks);
    ok(r.top.some((t) => t.key === 'security'), r.top.map((t) => t.name).join(', '));
  });
  test('없는 보기 번호를 넣어도 죽지 않는다', () => {
    const r = JUDGE.compass([99, -1, null, undefined]);
    eq(r.answered, 0);
  });
  test('여섯 문항만 답해도 후보가 나온다 (화면의 문턱과 같다)', () => {
    const picks = [0, 0, 0, 0, 0, 0];
    const r = JUDGE.compass(picks);
    eq(r.answered, 6);
    ok(r.top.length > 0);
  });
});

describe('역량 격차', () => {
  const need = { data: 5, code: 3, stat: 4, domain: 3, ethic: 3, comm: 4 };
  test('격차가 큰 축이 앞에 온다', () => {
    const r = JUDGE.gap({ data: 1, code: 3, stat: 4, domain: 3, ethic: 3, comm: 4 }, need);
    eq(r[0].key, 'data');
    eq(r[0].gap, 4);
  });
  test('필요한 수준을 넘겼으면 격차는 0 이다 (음수가 되지 않는다)', () => {
    const r = JUDGE.gap({ data: 5, code: 5, stat: 5, domain: 5, ethic: 5, comm: 5 }, need);
    r.forEach((x) => eq(x.gap, 0));
  });
  test('축 여섯 개를 모두 돌려준다', () => {
    eq(JUDGE.gap({}, need).length, 6);
  });
  test('자기 평가를 안 했으면 필요한 수준만큼이 격차다', () => {
    const r = JUDGE.gap({}, need);
    const d = r.filter((x) => x.key === 'data')[0];
    eq(d.gap, 5);
  });
});

describe('한국어 조사', () => {
  test('받침이 있으면 은/이/을', () => {
    eq(JOSA.eun('보안'), '보안은');
    eq(JOSA.i('직업'), '직업이');
    eq(JOSA.eul('기록'), '기록을');
  });
  test('받침이 없으면 는/가/를', () => {
    eq(JOSA.eun('데이터'), '데이터는');
    eq(JOSA.i('학교'), '학교가');
    eq(JOSA.eul('데이터 분석가'), '데이터 분석가를');
  });
  test('「트」 는 초성이 ㅌ 일 뿐 받침이 없다', () => {
    eq(JOSA.i('마이크로비트'), '마이크로비트가');
  });
  test('숫자는 읽는 소리로 판단한다', () => {
    eq(JOSA.i('ESP8266'), 'ESP8266이');   /* 육 → 받침 있음 */
    eq(JOSA.i('아이폰5'), '아이폰5가');    /* 오 → 받침 없음 */
  });
  test('「로/으로」 도 가른다', () => {
    eq(JOSA.ro('서울'), '서울로');
    eq(JOSA.ro('기록'), '기록으로');
    eq(JOSA.ro('데이터'), '데이터로');
  });
  test('괄호·따옴표가 뒤에 붙어도 앞 글자로 판단한다', () => {
    eq(JOSA.eul('보건 데이터」'), '보건 데이터」를');
  });
});

describe('기준 글자 수', () => {
  test('enough 는 공백을 뺀 글자 수로 판단한다', () => {
    ok(JUDGE.enough('가 나 다', 3));
    ok(!JUDGE.enough('가 나 다', 4));
  });
});
