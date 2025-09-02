const arg = require('arg');
const { authenticate, getAllTracks } = require('./src/spotify');
const { getNonLocalSourceTracks, runCheckUnavailable } = require('./src/tracks');
const { shuffleArray, logDryRunSummary, printHelp, printDuplicatesReport } = require('./src/ui');
const { FLAGS } = require('./src/constants');
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

function getSourceIdsFromEnv() {
  const raw = process.env.SPOTIFY_SOURCE_PLAYLIST_IDS || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function getDestIdFromEnv() {
  return (process.env.SPOTIFY_DESTINATION_PLAYLIST_ID || '').trim();
}

async function doDryRun(sources, dest, verbose) {
  await authenticate();
  // require explicit --source and --dest flags
  if (!sources || sources.length < 1 || !dest) {
    console.error('Usage: --cmd merge-dry-run --source <id> [--source <id> ...] --dest <id>');
    process.exitCode = 1;
    return;
  }
  const srcIds = sources;
  const destId = dest;
  const [srcTracks, destTracks] = await Promise.all([
    getNonLocalSourceTracks(srcIds, verbose),
    getAllTracks(destId),
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
  const srcIds = sources;
  const destId = dest;
  const tracks = await getNonLocalSourceTracks(srcIds, false);
  shuffleArray(tracks);
  const { clearPlaylist, addTracksInChunks } = require('./src/spotify');
  const failed = [];
  await clearPlaylist(destId);
  await addTracksInChunks(destId, tracks, failed);
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
  const srcIds = sources;
  await runCheckUnavailable(srcIds, true);
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
  const pairs = await Promise.all(ids.map(async id => [id, await getPlaylistName(id, true)]));
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
  if (cmd === 'merge') {
    if (parsed.dryRun) return doDryRun(sources, dest, verbose);
    return doMerge(sources, dest);
  }
  // legacy command name 'merge-dry-run' is no longer supported
  if (cmd === 'check-unavailable') return doCheckUnavailable(sources);
  if (cmd === 'dupes') return doDupes(verbose, sources);
  // unknown command -> fail with helpful message
  console.error(`Unknown command: ${cmd}`);
  const { printHelp } = require('./src/ui');
  printHelp();
  process.exitCode = 2;
  return;

}

main();
