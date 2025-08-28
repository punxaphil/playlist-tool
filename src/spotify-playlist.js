const { API_LIMIT } = require('./constants');
const { spotifyApi, getAllTracks } = require('./spotify-client');

async function removeTracksInChunks(playlistId, trackUris) {
  console.log(`Removing ${trackUris.length} tracks from playlist ID: ${playlistId}`);
  for (let i = 0; i < trackUris.length; i += API_LIMIT) {
    const chunk = trackUris.slice(i, i + API_LIMIT);
    console.log(`  - Removing chunk of ${chunk.length} tracks`);
    await spotifyApi.removeTracksFromPlaylist(playlistId, chunk);
  }
  console.log('  - Finished removing tracks.');
}

async function clearPlaylist(playlistId) {
  console.log(`Clearing playlist ID: ${playlistId}`);
  const tracks = await getAllTracks(playlistId);
  if (tracks.length === 0) {
    console.log('  - Playlist is already empty. Nothing to clear.');
    return;
  }
  const trackUris = tracks.map(track => ({ uri: track.uri }));
  await removeTracksInChunks(playlistId, trackUris);
  console.log('  - Playlist cleared successfully.');
}

async function addTrackIndividually(playlistId, trackChunk, failedTracks) {
  console.log(`  - Retrying failed chunk... adding ${trackChunk.length} tracks one by one.`);
  for (const track of trackChunk) {
    try {
      console.log(`    - Adding track: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`);
      await spotifyApi.addTracksToPlaylist(playlistId, [track.uri]);
    } catch (err) {
      console.error(`    - FAILED to add track: ${track.uri}. Skipping.`, err.body);
      failedTracks.push(track);
    }
  }
}

async function addTracksInChunks(playlistId, tracks, failedTracks) {
  console.log(`Adding ${tracks.length} tracks to playlist ID: ${playlistId}`);
  for (let i = 0; i < tracks.length; i += API_LIMIT) {
    const chunk = tracks.slice(i, i + API_LIMIT);
    const trackUris = chunk.map(t => t.uri);
    try {
      console.log(`  - Adding chunk of ${chunk.length} tracks`);
      await spotifyApi.addTracksToPlaylist(playlistId, trackUris);
    } catch (err) {
      console.error(`  - FAILED to add chunk.`, err.body);
      await addTrackIndividually(playlistId, chunk, failedTracks);
    }
  }
  console.log('  - Finished adding tracks.');
}

module.exports = {
  removeTracksInChunks,
  clearPlaylist,
  addTracksInChunks,
};

