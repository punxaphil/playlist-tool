const arg = require('arg');
const { authenticate, getAllTracks } = require('./src/spotify');
const { getNonLocalSourceTracks, runCheckUnavailable } = require('./src/tracks');
const { shuffleArray, logDryRunSummary, printDuplicatesReport } = require('./src/ui');
const { buildMap, toDuplicates } = require('./src/dupes');

function parseArgs(tokens) {
  const spec = {
    '--verbose': Boolean,
    '-v': '--verbose',
    '--cmd': String,
    '-c': '--cmd',
    '--source': [String],
    '-s': '--source',
    '--dest': String,
    '-d': '--dest',
    '--dry-run': Boolean,
    '-n': '--dry-run',
    '--help': Boolean,
    '-h': '--help',
  };
  const parsed = arg(spec, { argv: tokens, permissive: false });

  return {
    verbose: Boolean(parsed['--verbose']),
    cmd: parsed['--cmd'],
    dryRun: Boolean(parsed['--dry-run']),
    help: Boolean(parsed['--help']),
    sources: parsed['--source'] || [],
    dest: parsed['--dest'] || null,
  };
}

async function doDryRun(sources, dest, verbose) {
  await authenticate();
  // require explicit --source and --dest flags
  if (!sources || sources.length < 1 || !dest) {
    console.error('Usage: --cmd merge-dry-run --source <id> [--source <id> ...] --dest <id>');
    process.exitCode = 1;
    return;
  }
  const [srcTracks, destTracks] = await Promise.all([
    getNonLocalSourceTracks(sources, verbose),
    getAllTracks(dest),
  ]);
  shuffleArray(srcTracks);
  logDryRunSummary(destTracks, srcTracks, { verbose });
}

async function doMerge(sources, dest) {
  await authenticate();
  // require explicit --source and --dest flags
  if (!sources || sources.length < 1 || !dest) {
    console.error('Usage: --cmd merge --source <id> [--source <id> ...] --dest <id>');
    process.exitCode = 1;
    return;
  }
  const tracks = await getNonLocalSourceTracks(sources, false);
  shuffleArray(tracks);
  const { clearPlaylist, addTracksInChunks } = require('./src/spotify');
  const failed = [];
  await clearPlaylist(dest);
  await addTracksInChunks(dest, tracks, failed);
  if (failed.length) {
    console.log('\n--- The following tracks failed to be added ---');
    failed.forEach(t => console.log(`- ${t.name} by ${t.artists.map(a => a.name).join(', ')} (URI: ${t.uri})`));
  }
}

async function doCheckUnavailable(sources) {
  // This command only needs --source flags
  await authenticate(true);
  if (!sources || sources.length < 1) {
    console.error('Usage: --cmd check-unavailable --source <id> [--source <id> ...]');
    process.exitCode = 1;
    return;
  }
  await runCheckUnavailable(sources, true);
}

async function doDupes(verbose, ids) {
  await authenticate(true);
  if (!ids || !ids.length) {
    console.error('Usage: --cmd dupes <playlistId> <playlistId> ... [--verbose]');
    process.exitCode = 1;
    return;
  }
  const map = await buildMap(ids, verbose);
  const dupes = toDuplicates(map);
  const { getPlaylistName } = require('./src/spotify');
  const pairs = await Promise.all(ids.map(async id => [id, await getPlaylistName(id)]));
  const names = Object.fromEntries(pairs);
  printDuplicatesReport(dupes, { verbose, names });
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }
  const { cmd, verbose, sources, dest } = parsed;
  if (!cmd) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  // normalize and validate playlist ids (accept raw id, open.spotify.com URL, or spotify:playlist:URI)
  function normalizeId(input) {
    if (!input || typeof input !== 'string') return null;
    input = input.trim();
    // spotify URI
    const mUri = input.match(/^spotify:playlist:([A-Za-z0-9]+)$/i);
    if (mUri) return mUri[1];
    // open.spotify.com URL
    const mUrl = input.match(/playlist\/([A-Za-z0-9]+)(?:\?|$)/i);
    if (mUrl) return mUrl[1];
    // raw id candidate
    const candidate = input.replace(/\s+/g, '');
    // Spotify playlist ids are 22 chars base62. Enforce that to catch bad ids early.
    if (/^[A-Za-z0-9]{22}$/.test(candidate)) return candidate;
    return null;
  }

  function validateIds(sourcesArr, destId, options = { requireDest: false }) {
    const bad = [];
    const normalizedSources = (sourcesArr || []).map(s => ({ raw: s, id: normalizeId(s) }));
    normalizedSources.forEach(({ raw, id }) => { if (!id) bad.push({ raw, reason: 'invalid source id/URL' }); });
    let normalizedDest = null;
    if (options.requireDest) {
      normalizedDest = normalizeId(destId);
      if (!normalizedDest) bad.push({ raw: destId, reason: 'invalid destination id/URL' });
    }
    return { ok: bad.length === 0, bad, sources: normalizedSources.map(s => s.id).filter(Boolean), dest: normalizedDest };
  }
  if (cmd === 'merge') {
    const res = validateIds(sources, dest, { requireDest: true });
    if (!res.ok) {
      console.error('Invalid playlist ids provided:');
      res.bad.forEach(b => console.error(` - ${b.raw} (${b.reason})`));
      console.error('\nPlease provide Spotify playlist IDs, playlist URLs (https://open.spotify.com/playlist/{id}) or spotify:playlist:{id} URIs.');
      process.exitCode = 1;
      return;
    }
    if (parsed.dryRun) return await doDryRun(res.sources, res.dest, verbose);
    return await doMerge(res.sources, res.dest);
  }
  if (cmd === 'check-unavailable') {
    const res = validateIds(sources, null, { requireDest: false });
    if (!res.ok) {
      console.error('Invalid source playlist ids provided:');
      res.bad.forEach(b => console.error(` - ${b.raw} (${b.reason})`));
      process.exitCode = 1;
      return;
    }
    return await doCheckUnavailable(res.sources);
  }
  if (cmd === 'dupes') {
    const res = validateIds(sources, null, { requireDest: false });
    if (!res.ok) {
      console.error('Invalid playlist ids provided for dupes:');
      res.bad.forEach(b => console.error(` - ${b.raw} (${b.reason})`));
      process.exitCode = 1;
      return;
    }
    return await doDupes(verbose, res.sources);
  }
  // unknown command -> fail with helpful message
  console.error(`Unknown command: ${cmd}`);
  const { printHelp } = require('./src/ui');
  printHelp();
  process.exitCode = 2;
}

main();
