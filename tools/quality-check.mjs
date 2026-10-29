import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

function check(report) {
  assert.equal(report.version, '2.1.0', 'Expected SARIF 2.1.0');
  assert.ok(Array.isArray(report.runs) && report.runs.length, 'Missing analysis runs');
  for (const run of report.runs) {
    assert.ok(Array.isArray(run.results), 'Missing analysis results');
    assert.equal(run.results.length, 0, 'CodeQL security findings must be resolved before release');
    for (const invocation of run.invocations ?? []) {
      assert.equal(invocation.executionSuccessful, true, 'CodeQL invocation failed');
    }
  }
}

if (process.argv[2] === '--self-test') {
  const clean = {version:'2.1.0',runs:[{results:[]}]};
  check(clean);
  assert.throws(() => check({...clean,runs:[{results:[{ruleId:'synthetic-security-finding'}]}]}));
  assert.throws(() => check({...clean,runs:[{}]}));
  assert.throws(() => check({...clean,runs:[{results:[],invocations:[{executionSuccessful:false}]}]}));
  console.log('SARIF gate rejects seeded findings, missing results and failed analysis.');
} else {
  const directory = process.argv[2];
  assert.ok(directory, 'Usage: node tools/quality-check.mjs <SARIF directory>');
  const reports = readdirSync(directory).filter(name => name.endsWith('.sarif'));
  assert.ok(reports.length, 'No SARIF report produced');
  for (const name of reports) check(JSON.parse(readFileSync(join(directory,name),'utf8')));
  console.log('CodeQL reports contain no security findings.');
}
