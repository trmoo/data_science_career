/*!
 * 데이터가 앞뒤 맞는지 — 화면에 적어 둔 정답과 데이터가 어긋나지 않게 지킨다.
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { describe, test, ok, eq, deepEq } from './harness.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadData } = require('../tools/gas-load.js');

const DATA = loadData();

describe('시대와 타임라인', () => {
  test('시대는 네 개이고 마지막만 열려 있다', () => {
    eq(DATA.eras.length, 4);
    eq(DATA.eras.filter((e) => e.open).length, 1);
    ok(DATA.eras[3].open, '마지막 시대(2040)가 열린 칸이어야 한다');
  });

  test('시대 연도는 오름차순이다', () => {
    const ys = DATA.eras.map((e) => Number(e.year));
    for (let i = 1; i < ys.length; i++) ok(ys[i] > ys[i - 1], ys[i] + ' > ' + ys[i - 1]);
  });

  test('분야는 여섯 가지이고 열쇠가 겹치지 않는다', () => {
    eq(DATA.timeline.length, 6);
    eq(new Set(DATA.timeline.map((t) => t.key)).size, 6);
  });

  DATA.timeline.forEach((t) => {
    test('「' + t.name + '」 은 시대마다 한 줄씩 있다', () => {
      eq(t.rows.length, DATA.eras.length);
    });
    test('「' + t.name + '」 의 앞 세 시대는 채워져 있고 2040 은 비어 있다', () => {
      for (let i = 0; i < 3; i++) {
        ok(t.rows[i].what.length > 10, i + '번째 시대의 what');
        ok(t.rows[i].data.length > 5, i + '번째 시대의 data');
      }
      eq(t.rows[3].what, '', '2040 칸은 학생이 채운다');
      eq(t.rows[3].data, '');
    });
    test('「' + t.name + '」 에 아이콘이 있다', () => { ok(t.icon && t.icon.length > 0); });
  });
});

describe('변화 읽기 (tm-change)', () => {
  test('다섯 문항이다', () => { eq(DATA.tmChange.length, 5); });
  DATA.tmChange.forEach((q, i) => {
    test((i + 1) + '번 보기는 세 개이고 정답이 그 안에 있다', () => {
      eq(q.opts.length, 3);
      ok(q.opts.indexOf(q.ans) >= 0, '정답이 보기에 없다: ' + q.ans);
    });
    test((i + 1) + '번 보기가 서로 다르고 해설이 있다', () => {
      eq(new Set(q.opts).size, 3);
      ok(q.why && q.why.length > 15);
    });
  });
  test('정답은 모두 「기록·데이터」 를 가리킨다', () => {
    DATA.tmChange.forEach((q) => {
      ok(/기록|데이터|패턴/.test(q.ans), '정답이 데이터를 가리켜야 한다: ' + q.ans);
    });
  });
});

describe('부정 영향 유형', () => {
  test('유형 여섯 가지, 열쇠가 겹치지 않는다', () => {
    eq(DATA.negTypes.length, 6);
    eq(new Set(DATA.negTypes.map((t) => t.key)).size, 6);
  });
  test('사례 여섯 개가 서로 다른 유형을 하나씩 가리킨다', () => {
    eq(DATA.negCases.length, 6);
    eq(new Set(DATA.negCases.map((c) => c.type)).size, 6);
  });
  DATA.negCases.forEach((c, i) => {
    test((i + 1) + '번 사례의 유형이 실재하고 해설이 있다', () => {
      ok(DATA.negTypes.some((t) => t.key === c.type), '없는 유형: ' + c.type);
      ok(c.text.length > 20, '사례가 짧다');
      ok(c.why.length > 15, '해설이 짧다');
    });
  });
});

describe('영향 사슬', () => {
  test('다섯 칸이고 번호가 1~5 로 하나씩이다', () => {
    eq(DATA.chain.length, 5);
    deepEq(DATA.chain.map((c) => c.step).sort(), [1, 2, 3, 4, 5]);
  });
  test('첫 칸은 기술, 마지막 칸은 부작용이다', () => {
    eq(DATA.chain[0].kind, '기술');
    eq(DATA.chain[4].kind, '부작용');
  });
  test('가운데 칸이 있어야 「부작용은 몇 단계를 거쳐 온다」 를 가르칠 수 있다', () => {
    ok(DATA.chain.filter((c) => c.kind.indexOf('변화') >= 0).length >= 2);
  });
});

describe('보완 주체', () => {
  test('주체는 개인·기술·기업·사회·제도 세 가지다', () => {
    deepEq(DATA.fixSubjects.map((s) => s.key), ['me', 'tech', 'law']);
  });
  test('보완 사례 여섯 개가 세 주체에 두 개씩 나뉜다', () => {
    eq(DATA.fixCases.length, 6);
    ['me', 'tech', 'law'].forEach((k) => {
      eq(DATA.fixCases.filter((c) => c.subj === k).length, 2, k + ' 주체의 사례 수');
    });
  });
  DATA.fixCases.forEach((c, i) => {
    test((i + 1) + '번 보완 사례에 해설이 있다', () => {
      ok(DATA.fixSubjects.some((s) => s.key === c.subj), '없는 주체: ' + c.subj);
      ok(c.why.length > 15);
    });
  });
});

describe('직업 변화 카드', () => {
  test('열 장이고 줄어든 일·새로 생긴 일이 다섯씩이다', () => {
    eq(DATA.jobs.length, 10);
    eq(DATA.jobs.filter((j) => j.side === 'gone').length, 5);
    eq(DATA.jobs.filter((j) => j.side === 'new').length, 5);
  });
  test('직업 이름이 겹치지 않는다', () => {
    eq(new Set(DATA.jobs.map((j) => j.name)).size, 10);
  });
  DATA.jobs.forEach((j) => {
    test('「' + j.name + '」 에 왜 그렇게 되었는지 설명이 있다', () => {
      ok(j.why && j.why.length > 20, '설명이 짧다 — 뒤집어도 배울 것이 없다');
    });
  });
});

describe('진로 분야와 역량', () => {
  test('역량 축은 여섯 개, 수준 설명은 다섯 개다', () => {
    eq(DATA.axes.length, 6);
    eq(DATA.levels.length, 5);
    eq(new Set(DATA.axes.map((a) => a.key)).size, 6);
  });
  test('진로 분야는 열두 가지이고 열쇠가 겹치지 않는다', () => {
    eq(DATA.careers.length, 12);
    eq(new Set(DATA.careers.map((c) => c.key)).size, 12);
    eq(new Set(DATA.careers.map((c) => c.name)).size, 12);
  });
  DATA.careers.forEach((c) => {
    test('「' + c.name + '」 은 여섯 축 모두에 1~5 의 필요 수준이 있다', () => {
      DATA.axes.forEach((a) => {
        const v = c.need[a.key];
        ok(typeof v === 'number', a.name + ' 값이 없다');
        ok(v >= 1 && v <= 5, a.name + ' 값이 1~5 밖이다: ' + v);
      });
      eq(Object.keys(c.need).length, 6, '없는 축이 섞여 있다');
    });
    test('「' + c.name + '」 에 하는 일과 다루는 것이 적혀 있다', () => {
      ok(c.what.length > 10);
      ok(c.jobs.length >= 3, '예시 직업이 세 가지 이상');
      ok(c.tech.length >= 3, '다루는 도구가 세 가지 이상');
    });
  });
  test('어떤 분야도 여섯 축이 모두 5 이거나 모두 1 이 아니다 (구분이 되어야 한다)', () => {
    DATA.careers.forEach((c) => {
      const vs = DATA.axes.map((a) => c.need[a.key]);
      ok(new Set(vs).size > 1, c.name + ' 의 필요 수준이 모두 같다');
    });
  });
});

describe('진로 나침반', () => {
  test('열두 문항이다', () => { eq(DATA.compass.length, 12); });
  DATA.compass.forEach((q, i) => {
    test((i + 1) + '번 문항에 보기가 둘 이상 있고 저마다 이유 문구가 있다', () => {
      ok(q.opts.length >= 2, '보기가 하나뿐이면 고를 것이 없다');
      q.opts.forEach((o) => {
        ok(o.label && o.label.length > 1, '보기 문구');
        ok(o.tag && o.tag.length > 5, '이유 문구(tag) — 추천에 반드시 붙는다');
        ok(Object.keys(o.w).length >= 1, '가중치가 없다');
      });
    });
    test((i + 1) + '번 보기의 가중치가 실재하는 분야를 가리킨다', () => {
      const keys = DATA.careers.map((c) => c.key);
      q.opts.forEach((o) => {
        Object.keys(o.w).forEach((k) => {
          ok(keys.indexOf(k) >= 0, '없는 분야 열쇠: ' + k + ' (' + (i + 1) + '번)');
        });
      });
    });
  });
  test('열두 분야가 모두 적어도 한 보기에서 2점 이상을 받을 수 있다', () => {
    const reach = {};
    DATA.compass.forEach((q) => q.opts.forEach((o) => {
      Object.keys(o.w).forEach((k) => { if (o.w[k] >= 2) reach[k] = true; });
    }));
    DATA.careers.forEach((c) => ok(reach[c.key], c.name + ' 은(는) 추천 후보가 될 수 없다'));
  });
  test('보기 문구가 한 문항 안에서 겹치지 않는다', () => {
    DATA.compass.forEach((q, i) => {
      eq(new Set(q.opts.map((o) => o.label)).size, q.opts.length, (i + 1) + '번 문항');
    });
  });
});

describe('판정에 쓰는 낱말 목록', () => {
  ['vague', 'orgHints', 'orgNames', 'serviceWords', 'howVerbs', 'dataWords'].forEach((k) => {
    test(k + ' 목록이 비어 있지 않고 중복이 없다', () => {
      ok(Array.isArray(DATA[k]) && DATA[k].length >= 6, k);
      eq(new Set(DATA[k]).size, DATA[k].length, k + ' 에 중복이 있다');
    });
  });
  test('뭉뚱그린 표현과 데이터 낱말이 겹치지 않는다', () => {
    const bad = DATA.vague.filter((v) => DATA.dataWords.indexOf(v) >= 0);
    deepEq(bad, [], '겹치면 데이터 칸이 영원히 통과되지 않는다');
  });
});

describe('화면 ↔ 활동·서술 칸 표', () => {
  test('screenActs 와 screenFields 의 화면 목록이 같다', () => {
    deepEq(Object.keys(DATA.screenActs).sort(), Object.keys(DATA.screenFields).sort());
  });
  test('한 활동이 두 화면에 걸쳐 있지 않다', () => {
    const seen = {};
    Object.keys(DATA.screenActs).forEach((s) => {
      DATA.screenActs[s].forEach((k) => {
        ok(!seen[k], k + ' 이(가) ' + seen[k] + ' 와 ' + s + ' 두 곳에 있다');
        seen[k] = s;
      });
    });
  });
  test('한 서술 칸이 두 화면에 걸쳐 있지 않다', () => {
    const seen = {};
    Object.keys(DATA.screenFields).forEach((s) => {
      DATA.screenFields[s].forEach((k) => {
        ok(!seen[k], k + ' 이(가) ' + seen[k] + ' 와 ' + s + ' 두 곳에 있다');
        seen[k] = s;
      });
    });
  });
});
