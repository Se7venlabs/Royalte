// ─── Board Certification Report Generator ────────────────────────────────────
//
// Formats all suite results into the Board Certification Report.
// Output is plain text — paste directly into Board communications.

const LINE  = '─'.repeat(72);
const DLINE = '═'.repeat(72);

function pad(s, n) { return String(s).padEnd(n); }
function rpad(s, n) { return String(s).padStart(n); }

function statusIcon(s) {
  if (s === 'PASS' || s === 'DETERMINISTIC') return '✓';
  if (s === 'WARN') return '⚠';
  if (s === 'FAIL' || s === 'NON-DETERMINISTIC') return '✗';
  if (s === 'MISSING' || s === 'ERROR') return '!';
  return '·';
}

export function printBoardReport(results, opts = {}) {
  const {
    runAt    = new Date().toISOString(),
    version  = '1.0.0',
    commit   = 'unknown',
  } = opts;

  const lines = [];
  const out   = (...l) => l.forEach(x => lines.push(x));

  out('');
  out(DLINE);
  out('  ROYALTĒ OS v1.0 — BOARD CERTIFICATION REPORT');
  out(DLINE);
  out(`  Generated:    ${runAt}`);
  out(`  OS Version:   ${version}`);
  out(`  Commit:       ${commit}`);
  out('');

  // ── Executive Summary ──────────────────────────────────────────────────────
  let totalPassed     = 0;
  let totalFailed     = 0;
  let totalAssertions = 0;
  let allSuitesPassed = true;

  for (const r of results) {
    totalPassed     += r.passed     ?? 0;
    totalFailed     += r.failed     ?? 0;
    totalAssertions += r.assertions ?? 0;
    if ((r.failed ?? 0) > 0) allSuitesPassed = false;
  }

  const verdict = allSuitesPassed ? 'CERTIFIED' : 'NOT CERTIFIED';
  out(LINE);
  out(`  BOARD VERDICT: ${verdict}`);
  out(LINE);
  out(`  Total assertions:  ${totalAssertions}`);
  out(`  Passed:            ${totalPassed}`);
  out(`  Failed:            ${totalFailed}`);
  out('');

  // ── Suite Summaries ────────────────────────────────────────────────────────
  out(LINE);
  out('  SUITE RESULTS');
  out(LINE);

  for (const r of results) {
    const suitePass = (r.failed ?? 0) === 0;
    const icon      = suitePass ? '✓' : '✗';
    out(`  ${icon}  ${pad(r.name, 30)}  ${rpad(r.passed, 4)} passed  ${rpad(r.failed, 3)} failed`);
  }

  out('');

  // ── Suite 01: Regression detail ────────────────────────────────────────────
  const reg = results.find(r => r.name === '01-regression');
  if (reg) {
    out(LINE);
    out('  SUITE 01 — GOLDEN FIXTURE REGRESSION');
    out(LINE);
    for (const d of reg.details ?? []) {
      const icon = statusIcon(d.status);
      out(`  ${icon}  ${pad(d.fixture, 36)}  ${d.status}`);
      const fails = (d.assertions ?? []).filter(a => !a.pass);
      for (const f of fails) {
        out(`       ✗  ${f.label}${f.note ? ' — ' + f.note : ''}`);
      }
    }
    out('');
  }

  // ── Suite 02: Determinism summary ─────────────────────────────────────────
  const det = results.find(r => r.name === '02-determinism');
  if (det) {
    out(LINE);
    out('  SUITE 02 — DETERMINISM VERIFICATION');
    out(LINE);
    const nondets = (det.details ?? []).filter(d => d.status === 'NON-DETERMINISTIC' || d.status === 'ERROR');
    if (nondets.length === 0) {
      out(`  ✓  All ${det.assertions} fixtures verified deterministic`);
      const rieRow = det.details?.find(d => d.layer === 'RIE');
      if (rieRow) {
        out(`  ✓  Full RIE pipeline deterministic (${rieRow.runs} runs, fixed clock)`);
        if (rieRow.note) out(`     Note: ${rieRow.note}`);
      }
    } else {
      for (const d of nondets) {
        out(`  ✗  ${d.fixture} [${d.layer}]: ${d.status}${d.reason ? ' — ' + d.reason : ''}`);
      }
    }
    out('');
  }

  // ── Suite 03: Artist Library summary ──────────────────────────────────────
  const lib = results.find(r => r.name === '03-artist-library');
  if (lib) {
    out(LINE);
    out('  SUITE 03 — CERTIFICATION ARTIST LIBRARY');
    out(LINE);
    out(`  ${'Archetype'.padEnd(36)}  ${'Score'.padStart(6)}  ${'Grade'.padEnd(6)}  ${'Obs'.padStart(4)}  Status`);
    out(`  ${'─'.repeat(36)}  ${'─'.repeat(6)}  ${'─'.repeat(6)}  ${'─'.repeat(4)}  ─────`);
    for (const d of lib.details ?? []) {
      const icon    = statusIcon(d.status);
      const score   = d.healthScore != null ? String(d.healthScore).padStart(6) : '     –';
      const grade   = (d.grade ?? '–').padEnd(6);
      const obs     = d.observations != null ? String(d.observations).padStart(4) : '   –';
      out(`  ${icon}  ${pad(d.fixture, 36)}  ${score}  ${grade}  ${obs}  ${d.status}`);
      const fails = (d.assertions ?? []).filter(a => !a.pass);
      for (const f of fails) {
        out(`       ✗  ${f.label}${f.note ? ' — ' + f.note : ''}`);
      }
    }
    out('');
  }

  // ── Suite 04: CIM Integrity ───────────────────────────────────────────────
  const cim = results.find(r => r.name === '04-cim-integrity');
  if (cim) {
    out(LINE);
    out('  SUITE 04 — CIM STRUCTURAL INTEGRITY');
    out(LINE);
    for (const d of cim.details ?? []) {
      const icon  = statusIcon(d.status);
      out(`  ${icon}  ${pad(d.fixture, 36)}  CIM v${d.cimVersion ?? '?'}  certified=${d.certified}  ${d.status}`);
      const fails = (d.assertions ?? []).filter(a => !a.pass);
      for (const f of fails) {
        out(`       ✗  ${f.label}${f.note ? ' — ' + f.note : ''}`);
      }
    }
    out('');
  }

  // ── Suite 05: Performance Baseline ────────────────────────────────────────
  const perf = results.find(r => r.name === '05-performance');
  if (perf?.timings) {
    out(LINE);
    out('  SUITE 05 — PERFORMANCE BASELINE (ms, all stages)');
    out(LINE);
    out(`  ${'Stage'.padEnd(30)}  ${'Min'.padStart(7)}  ${'P50'.padStart(7)}  ${'P95'.padStart(7)}  ${'Max'.padStart(7)}  N`);
    out(`  ${'─'.repeat(30)}  ${'─'.repeat(7)}  ${'─'.repeat(7)}  ${'─'.repeat(7)}  ${'─'.repeat(7)}  ─`);
    for (const [stage, t] of Object.entries(perf.timings)) {
      if (t.note) {
        out(`  ·  ${pad(stage, 30)}  ${t.note}`);
        continue;
      }
      out(`  ·  ${pad(stage, 30)}  ${rpad(t.min, 7)}  ${rpad(t.p50, 7)}  ${rpad(t.p95, 7)}  ${rpad(t.max, 7)}  ${t.n}`);
    }
    for (const d of perf.details ?? []) {
      const icon = statusIcon(d.status);
      out(`  ${icon}  ${d.note}`);
    }
    out('');
  }

  // ── Final Certification ───────────────────────────────────────────────────
  out(DLINE);
  out(`  ROYALTĒ OS v${version} — ${verdict}`);
  if (allSuitesPassed) {
    out('');
    out('  The Royaltē Operating System has passed all certification requirements.');
    out('  Every intelligence assembler is deterministic.');
    out('  Every CIM is structurally valid and deeply frozen.');
    out('  All 12 §8.2 objects are present in every output.');
    out('  Every golden fixture passes regression.');
    out('  All certification artist archetypes pass without error.');
    out('');
    out('  RECOMMENDATION: TAG royalte-os-v1.0');
  } else {
    out('');
    out(`  ${totalFailed} assertion(s) failed. Certification cannot be issued.`);
    out('  Resolve all failures above before requesting Board certification.');
  }
  out(DLINE);
  out('');

  return lines.join('\n');
}
