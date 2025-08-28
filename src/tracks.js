const { getAllTracks } = require('./spotify');
const config = require('./config');

async function getSourceTracks(sourcePlaylistIds, silent = false) {
  if (!silent) console.log('--- Fetching and Combining Source Tracks ---');
  let allSourceTracks = [];
  for (const playlistId of sourcePlaylistIds) {
    if (!silent) console.log(`Fetching tracks from source playlist ID: ${playlistId}`);
    const tracks = await getAllTracks(playlistId, silent);
    allSourceTracks = allSourceTracks.concat(tracks);
    if (!silent) console.log(`  - Fetched ${tracks.length} tracks. Total tracks so far: ${allSourceTracks.length}`);
  }
  const uniqueTracks = Array.from(new Map(allSourceTracks.map(t => [t.uri, t])).values());
  if (!silent) console.log(`Total unique tracks from all sources: ${uniqueTracks.length}`);
  return uniqueTracks;
}

async function getNonLocalSourceTracks(sourcePlaylistIds) {
  const uniqueTracks = await getSourceTracks(sourcePlaylistIds);
  const nonLocalTracks = uniqueTracks.filter(track => {
    const isLocal = track.uri.startsWith('spotify:local');
    if (isLocal && config.isVerbose) {
      console.log(`  - Filtering out local track: ${track.name} by ${track.artists.map(a => a.name).join(', ')} (URI: ${track.uri})`);
    }
    return !isLocal;
  });
  console.log(`Found ${nonLocalTracks.length} non-local tracks out of ${uniqueTracks.length} unique tracks.`);
  return nonLocalTracks;
}

async function runCheckUnavailable(sourcePlaylistIds) {
  const uniqueSourceTracks = await getSourceTracks(sourcePlaylistIds, true);
  const localTracks = uniqueSourceTracks.filter(track => track.uri.startsWith('spotify:local'));

  if (config.isVerbose) {
    localTracks.forEach(track => {
      console.log(`- ${track.name} by ${track.artists.map(a => a.name).join(', ')} (URI: ${track.uri})`);
    });
  } else {
    console.log(String(localTracks.length));
  }
}

module.exports = {
  getNonLocalSourceTracks,
  runCheckUnavailable,
  getSourceTracks,
};
