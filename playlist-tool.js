const { authenticate, getAllTracks } = require('./src/spotify');
const { getNonLocalSourceTracks, runCheckUnavailable } = require('./src/tracks');
const { shuffleArray, logDryRunSummary, printHelp, printDuplicatesReport } = require('./src/ui');
const { FLAGS } = require('./src/constants');
const { buildMap, toDuplicates } = require('./src/dupes');

function parse(argv) {
  const args = argv.slice(2);
  const verbose = args.includes(FLAGS.VERBOSE);
  const cmd = args.find(a => !a.startsWith('--')) || 'help';
  const rest = args.filter(a => a !== cmd);
  return { cmd, rest, verbose };
}

function getSourceIds() {
  const raw = process.env.SPOTIFY_SOURCE_PLAYLIST_IDS || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function getDestId() {
  return (process.env.SPOTIFY_DESTINATION_PLAYLIST_ID || '').trim();
}

async function doDryRun(verbose) {
  await authenticate();
  const srcIds = getSourceIds();
  const destId = getDestId();
  const [srcTracks, destTracks] = await Promise.all([
    getNonLocalSourceTracks(srcIds),
    getAllTracks(destId),
  ]);
  shuffleArray(srcTracks);
  logDryRunSummary(destTracks, srcTracks, { verbose });
}

async function doMerge() {
  await authenticate();
  const srcIds = getSourceIds();
  const destId = getDestId();
  const tracks = await getNonLocalSourceTracks(srcIds);
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

async function doCheckUnavailable() {
  await authenticate(true);
  const srcIds = getSourceIds();
  await runCheckUnavailable(srcIds);
}

async function doDupes(verbose, ids) {
  await authenticate(true);
  if (!ids.length) {
    console.error('Usage: node playlist-tool.js dupes <playlistId> <playlistId> ... [--verbose]');
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
  const { cmd, rest, verbose } = parse(process.argv);
  if (cmd === 'merge') return doMerge();
  if (cmd === 'merge-dry-run') return doDryRun(verbose);
  if (cmd === 'check-unavailable') return doCheckUnavailable();
  if (cmd === 'dupes') {
    const ids = rest.filter(a => !a.startsWith('--'));
    return doDupes(verbose, ids);
  }
  printHelp();
}

main();
