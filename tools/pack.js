/*!
 * 붙여넣기 꾸러미 만들기 — 앱스 스크립트 편집기에 옮길 파일을 모은다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   node tools/pack.js   →   dist/appsscript/ (파일 11개 + 붙여넣는 순서.md)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist', 'appsscript');

const FILES = [
  { file: 'appsscript.json', kind: '설정',    note: '편집기 ⚙️ 프로젝트 설정에서 「매니페스트 파일 표시」를 켜야 보입니다' },
  { file: 'Code.gs',         kind: '스크립트', note: '서버 코드 — 시트 읽기·쓰기, 로그인, 진행률 집계, 교사 메뉴' },
  { file: 'index.html',      kind: 'HTML',    note: '학생 화면의 뼈대' },
  { file: 'css.html',        kind: 'HTML',    note: '화면 모양' },
  { file: 'data.html',       kind: 'HTML',    note: '데이터와 정답 (타임라인·문항·직업·진로 분야)' },
  { file: 'judge.html',      kind: 'HTML',    note: '판정 엔진 (구체성 뱃지·저울·나침반·역량 격차·조사)' },
  { file: 'core.html',       kind: 'HTML',    note: '화면 부품 (서술 칸·채점 위젯·저울·레이더·사슬)' },
  { file: 's1.html',         kind: 'HTML',    note: 'Ⅰ 시간 여행' },
  { file: 's2.html',         kind: 'HTML',    note: 'Ⅱ 영향 평가' },
  { file: 's3.html',         kind: 'HTML',    note: 'Ⅲ 보완 방법' },
  { file: 's4.html',         kind: 'HTML',    note: 'Ⅳ 진로 설계' },
  { file: 's5.html',         kind: 'HTML',    note: 'Ⅴ 내 보고서' },
  { file: 'boot.html',       kind: 'HTML',    note: '로그인·화면 이동·서버 통신' }
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let total = 0;
const rows = FILES.map((f) => {
  const raw = fs.readFileSync(path.join(SRC, f.file), 'utf8');
  fs.writeFileSync(path.join(OUT, f.file), raw, 'utf8');
  const kb = Buffer.byteLength(raw, 'utf8') / 1024;
  total += kb;
  return '| `' + f.file + '` | ' + f.kind + ' | ' + kb.toFixed(1) + 'KB | ' + f.note + ' |';
});

const guide = `# 앱스 스크립트에 옮기는 순서

© 2026 티쳐무 · 모든 권리 보유

1. 구글 드라이브에서 **스프레드시트를 새로 만든다.** 이름은 아무렇게나 (예: 「데이터 과학 영향력 탐구 2학년」).
2. 그 시트에서 **확장 프로그램 → Apps Script** 를 누른다.
3. 편집기 왼쪽 ⚙️ **프로젝트 설정** → 「\`appsscript.json\` 매니페스트 파일을 편집기에서 표시」를 **켠다.**
4. 아래 파일을 하나씩 만들고 내용을 **그대로 붙여넣는다.**
   - \`.gs\` 는 [＋] → 스크립트, \`.html\` 은 [＋] → HTML 로 만든다.
   - 파일 이름을 적을 때 **확장자는 빼고** 적는다 (\`index\`, \`css\`, \`s1\` …). 편집기가 붙여 준다.
   - 처음 있는 \`Code.gs\` 는 내용만 바꿔 붙여넣으면 된다.
5. 저장(Ctrl+S)하고 **스프레드시트로 돌아가 새로 고침**한다.
   위쪽에 **[데이터 과학 영향력 탐구]** 메뉴가 생긴다.
6. 메뉴 → **① 시트 준비하기** 를 한 번 실행한다. (권한 승인 창이 뜨면 허용)
7. 편집기에서 **배포 → 새 배포 → 유형 「웹 앱」**
   - 실행 대상: **나**
   - 액세스 권한: **모든 사용자** (학생이 구글 로그인 없이 들어올 수 있게)
   - 배포하면 나오는 주소를 학생에게 알려 준다.
8. 나중에 코드를 고쳤으면 **배포 → 배포 관리 → 연필(수정) → 버전 「새 버전」 → 배포**.
   새 배포를 만들면 **주소가 바뀌니** 반드시 「수정」으로 할 것.

| 파일 | 종류 | 크기 | 하는 일 |
|---|---|---|---|
${rows.join('\n')}

합계 약 ${total.toFixed(0)}KB.

## 학생에게 알려 줄 것 (3줄)

1. 주소를 열고 **학번**을 넣습니다. 처음이면 이름과 비밀번호를 정합니다.
2. 위쪽 탭 Ⅰ~Ⅳ 를 차례로 하면 **자동 저장**됩니다. 집에서 이어서 써도 됩니다.
3. 다 쓰면 **Ⅴ 내 보고서 → [제출하기]**. 공용 컴퓨터라면 꼭 **[나가기]** 를 누릅니다.
`;

fs.writeFileSync(path.join(OUT, '붙여넣는 순서.md'), guide, 'utf8');

console.log('만들었습니다 → dist/appsscript/  (파일 ' + FILES.length + '개, 약 ' + total.toFixed(0) + 'KB)');
console.log('옮기는 순서는 dist/appsscript/붙여넣는 순서.md 를 보세요.');
