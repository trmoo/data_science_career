/*!
 * Code.gs 와 화면 데이터를 node 안에서 그대로 돌리는 도우미
 * — 시험이 진짜 서버 코드와 진짜 판정 엔진을 검사하게 한다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * ⚠ SpreadsheetApp 같은 서비스는 Code.gs 에 선언되어 있지 않아 api. 로 꺼낼 수 없다.
 *   시험에서는 gas.PropertiesService 쪽을 쓴다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { makeGas } = require('./fake-gas.js');

const SRC = path.join(__dirname, '..', 'src');

/** src 안의 html 파일에서 <script> 안쪽만 꺼낸다 */
function readScript(name) {
  const raw = fs.readFileSync(path.join(SRC, name), 'utf8');
  const m = raw.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error(name + ' 안에 <script> 가 없습니다.');
  return m[1];
}

/** data.html 의 DATA */
function loadData() {
  const code = readScript('data.html');
  return new Function(code + '\n; return DATA;')();
}

/** judge.html 의 JUDGE·JOSA (DATA 를 먼저 깔아 준다) */
function loadJudge() {
  const code = readScript('data.html') + '\n' + readScript('judge.html');
  return new Function(code + '\n; return { DATA: DATA, JUDGE: JUDGE, JOSA: JOSA };')();
}

/**
 * Code.gs 를 가짜 앱스 스크립트 환경 위에서 돌린다.
 * 돌려주는 값: { api: 함수·상수 모음, gas: 가짜 환경 }
 */
function loadServer(opts) {
  const code = fs.readFileSync(path.join(SRC, 'Code.gs'), 'utf8');
  const gas = makeGas(opts);

  const names = [];
  const re = /^(?:function\s+([A-Za-z_$][\w$]*)|var\s+([A-Za-z_$][\w$]*))/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    const n = m[1] || m[2];
    if (names.indexOf(n) < 0) names.push(n);
  }
  const ret = 'return {' + names.map((n) => n + ': ' + n).join(', ') + '};';

  const fn = new Function(
    'SpreadsheetApp', 'PropertiesService', 'Utilities', 'ContentService', 'HtmlService',
    code + '\n' + ret
  );
  const api = fn(gas.SpreadsheetApp, gas.PropertiesService, gas.Utilities,
                 gas.ContentService, gas.HtmlService);
  return { api, gas };
}

/** 시트를 만들어 둔 상태로 시작한다 */
function freshServer(opts) {
  const { api, gas } = loadServer(opts);
  api.setupSheets();
  return { api, gas };
}

/** 학생 한 명을 등록하고 접속표를 돌려준다 */
function withStudent(api, sid, name, pw) {
  const r = api.apiRegister(sid || '20101', name || '홍길동', pw || 'pw1234');
  if (!r.ok) throw new Error('학생 등록 실패: ' + r.msg);
  return r.token;
}

module.exports = { readScript, loadData, loadJudge, loadServer, freshServer, withStudent, SRC };
