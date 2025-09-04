const { authenticate } = require('../spotify');
const { getNonLocalSourceTracks } = require('../tracks');
const { shuffleArray } = require('../ui');
const { clearPlaylist, addTracksInChunks } = require('../spotify');
const { formatTrackLine } = require('../format');
const { EXCLUDED_PRINT_LIMIT } = require('../constants');

async function performMerge(sources, dest) {
  await authenticate();
  const res = await getNonLocalSourceTracks(sources, false);
  const tracks = res.nonLocalTracks || [];
  shuffleArray(tracks);
  await clearPlaylist(dest);
  const failed = [];
  await addTracksInChunks(dest, tracks, failed);
  return { failed, excluded: res.excludedTracks || [] };
}

function printExcluded(excluded) {
  if (!excluded || !excluded.length) return;
  console.log('\n--- Excluded tracks (not added) ---');
  excluded.slice(0, EXCLUDED_PRINT_LIMIT).forEach(t => console.log(formatTrackLine(t)));
  if (excluded.length > EXCLUDED_PRINT_LIMIT) console.log(`  ...and ${excluded.length - EXCLUDED_PRINT_LIMIT} more`);
}

module.exports = {
  performMerge,
  printExcluded,
};
