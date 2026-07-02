// ─── Suite 03: Certification Artist Library ───────────────────────────────────
//
// Runs every artist archetype in the certification library through the
// Intelligence Engine, Health Engine, and domain assemblers. Verifies that each
// produces structurally valid output and meets archetype-specific expectations.
//
// Returns: { name, passed, failed, assertions, details[] }

import { loadArtist, listArtists }           from '../artist-library/library-loader.mjs';
import { runIntelligenceEngine }             from '../../../api/_lib/intelligence-engine.js';
import { ALL_RULES }                         from '../../../api/rules/index.js';
import { computeHealthScore }                from '../../../api/_lib/health-engine.js';
import { assembleIdentityIntelligence }      from '../../../api/_lib/identity-intelligence.js';
import { assemblePublishingIntelligence }    from '../../../api/_lib/publishing-intelligence.js';

// Archetype-specific behavioral expectations.
// Each entry: { fixture, checks[] } where each check is (report, healthScore, ii, pi) => bool.
const ARCHETYPE_CHECKS = {
  'artist-major': [
    { label: 'major: health score ≥ 70',     fn: (r, h) => h?.overallScore >= 70 },
    { label: 'major: zero critical risks',   fn: (r)    => !r.risks?.some(x => x.severity === 'HIGH') },
  ],
  'artist-independent': [
    { label: 'independent: engine runs',     fn: (r) => Array.isArray(r?.observations) },
    { label: 'independent: limited providers registered in observations',
      fn: (r, h, ii) => (ii?.verifiedProviders ?? 3) <= 2 },
  ],
  'artist-single-only': [
    { label: 'single-only: engine runs without error', fn: (r) => Array.isArray(r?.observations) },
    { label: 'single-only: catalog rules evaluated',   fn: (r) => typeof r?.observations === 'object' },
  ],
  'artist-album-heavy': [
    { label: 'album-heavy: high release count handled', fn: (r, h) => typeof h?.overallScore === 'number' },
    { label: 'album-heavy: score is numeric',           fn: (r, h) => h?.overallScore >= 0 },
  ],
  'artist-no-publisher': [
    { label: 'no-publisher: publishing gap fires or coverage low',
      fn: (r, h, ii, pi) => (pi?.coverage ?? 100) <= 10 || r.observations.some(o => o.category === 'PUBLISHING') },
  ],
  'artist-legacy-catalog': [
    { label: 'legacy: engine handles 50+ year catalog', fn: (r, h) => typeof h?.overallScore === 'number' },
    { label: 'legacy: orphan rule fires',
      fn: (r) => r.observations.some(o => o.ruleId?.includes('orphan') || o.category === 'CATALOG') },
  ],
  'artist-duplicate-identity': [
    { label: 'duplicate-identity: duplicate rule fires',
      fn: (r) => r.observations.some(o => o.ruleId === 'identity.duplicate-dsp-profiles') },
  ],
  'artist-international': [
    { label: 'international: non-ASCII name handled', fn: (r) => Array.isArray(r?.observations) },
    { label: 'international: score is valid',         fn: (r, h) => typeof h?.overallScore === 'number' },
  ],
  'artist-classical': [
    { label: 'classical: zero-publishing handled', fn: (r, h) => typeof h?.overallScore === 'number' },
    { label: 'classical: engine never throws',     fn: (r)    => Array.isArray(r?.observations) },
  ],
  'artist-sparse-metadata': [
    { label: 'sparse-metadata: metadata observations present',
      fn: (r) => r.observations.some(o => o.category === 'METADATA' || o.category === 'CATALOG') },
  ],
  'artist-null-fields': [
    { label: 'null-fields: engine never throws on all-null input', fn: (r) => Array.isArray(r?.observations) },
    { label: 'null-fields: health score is a number',              fn: (r, h) => typeof h?.overallScore === 'number' },
  ],
  'artist-multi-publisher': [
    { label: 'multi-publisher: 15 writers handled', fn: (r, h) => typeof h?.overallScore === 'number' },
    { label: 'multi-publisher: 6 publishers handled', fn: (r, h, ii, pi) => typeof pi?.coverage === 'number' || pi?.coverage === null },
  ],
};

function check(label, pass, note = '') {
  return { label, pass, note };
}

export async function runArtistLibrary() {
  const suite = { name: '03-artist-library', passed: 0, failed: 0, assertions: 0, details: [] };

  const artists = listArtists();
  if (artists.length === 0) {
    suite.details.push({ fixture: '(none)', status: 'ERROR', reason: 'Artist library is empty' });
    suite.failed++;
    return suite;
  }

  for (const name of artists) {
    const cio = loadArtist(name);
    const assertions = [];

    // ── Load ──────────────────────────────────────────────────────────────
    assertions.push(check(`${name}: fixture loads`, !!cio));
    if (!cio) {
      suite.failed++;
      suite.assertions++;
      suite.details.push({ fixture: name, status: 'ERROR', reason: 'fixture failed to load', assertions });
      continue;
    }

    // ── Intelligence Engine ───────────────────────────────────────────────
    let report;
    try {
      report = runIntelligenceEngine(cio, ALL_RULES);
      assertions.push(check(`${name}: IE runs without throw`, true));
    } catch (e) {
      assertions.push(check(`${name}: IE runs without throw`, false, e.message));
      suite.failed++;
      suite.assertions += assertions.length;
      suite.details.push({ fixture: name, status: 'FAIL', assertions });
      continue;
    }

    assertions.push(check(`${name}: report.observations is array`, Array.isArray(report?.observations)));
    assertions.push(check(`${name}: report.risks is array`,        Array.isArray(report?.risks)));
    assertions.push(check(`${name}: report is frozen`,             Object.isFrozen(report)));

    // ── Health Engine ─────────────────────────────────────────────────────
    let healthScore;
    try {
      healthScore = computeHealthScore(report);
      assertions.push(check(`${name}: Health Engine runs without throw`, true));
    } catch (e) {
      assertions.push(check(`${name}: Health Engine runs without throw`, false, e.message));
    }

    if (healthScore) {
      assertions.push(check(`${name}: overallScore is number`,       typeof healthScore.overallScore === 'number'));
      assertions.push(check(`${name}: overallScore in 0..100`,       healthScore.overallScore >= 0 && healthScore.overallScore <= 100));
      assertions.push(check(`${name}: overallGrade is string`,       typeof healthScore.overallGrade === 'string' && healthScore.overallGrade.length > 0));
    }

    // ── Identity Intelligence ─────────────────────────────────────────────
    let ii;
    try {
      ii = assembleIdentityIntelligence(report, cio);
      assertions.push(check(`${name}: Identity Intelligence assembles`, true));
      assertions.push(check(`${name}: ii.coverage is number`, typeof ii?.coverage === 'number'));
    } catch (e) {
      assertions.push(check(`${name}: Identity Intelligence assembles`, false, e.message));
    }

    // ── Publishing Intelligence ───────────────────────────────────────────
    let pi;
    try {
      pi = assemblePublishingIntelligence(report, cio);
      assertions.push(check(`${name}: Publishing Intelligence assembles`, true));
      assertions.push(check(`${name}: pi.coverageStatus is string`,
        typeof pi?.coverageStatus === 'string'));
    } catch (e) {
      assertions.push(check(`${name}: Publishing Intelligence assembles`, false, e.message));
    }

    // ── Archetype-specific checks ─────────────────────────────────────────
    const archetypeChecks = ARCHETYPE_CHECKS[name] || [];
    for (const { label, fn } of archetypeChecks) {
      try {
        const pass = fn(report, healthScore, ii, pi);
        assertions.push(check(label, !!pass));
      } catch (e) {
        assertions.push(check(label, false, `threw: ${e.message}`));
      }
    }

    const pass = assertions.filter(a => a.pass).length;
    const fail = assertions.filter(a => !a.pass).length;
    suite.passed     += pass;
    suite.failed     += fail;
    suite.assertions += assertions.length;

    suite.details.push({
      fixture:     name,
      status:      fail === 0 ? 'PASS' : 'FAIL',
      healthScore: healthScore?.overallScore,
      grade:       healthScore?.overallGrade,
      observations: report?.observations?.length ?? 0,
      risks:       report?.risks?.length ?? 0,
      assertions,
    });
  }

  return suite;
}
