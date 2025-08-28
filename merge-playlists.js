const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
});

const isDryRun = process.argv.includes('--dry-run');

if (!process.env.SPOTIFY_SOURCE_PLAYLIST_IDS || !process.env.SPOTIFY_DESTINATION_PLAYLIST_ID) {
  console.error('Error: Playlist IDs are not configured. Please set SPOTIFY_SOURCE_PLAYLIST_IDS and SPOTIFY_DESTINATION_PLAYLIST_ID environment variables.');
  process.exit(1);
}

const sourcePlaylistIds = process.env.SPOTIFY_SOURCE_PLAYLIST_IDS.split(',');
const destinationPlaylistId = process.env.SPOTIFY_DESTINATION_PLAYLIST_ID;

async function fetchPaginatedTracks(playlistId) {
  let tracks = [];
  let offset = 0;
  const limit = 100;
  let response;
  do {
    response = await spotifyApi.getPlaylistTracks(playlistId, { offset, limit });
    tracks = tracks.concat(response.body.items);
    offset += limit;
  } while (response.body.next);
  return tracks;
}

async function getAllTracks(playlistId) {
  const items = await fetchPaginatedTracks(playlistId);
  return items.map(item => item.track).filter(Boolean);
}

async function removeTracksInChunks(playlistId, trackUris) {
  for (let i = 0; i < trackUris.length; i += 100) {
    const chunk = trackUris.slice(i, i + 100);
    await spotifyApi.removeTracksFromPlaylist(playlistId, chunk);
  }
}

async function clearPlaylist(playlistId) {
  const tracks = await getAllTracks(playlistId);
  if (tracks.length === 0) return;
  const trackUris = tracks.map(track => ({ uri: track.uri }));
  await removeTracksInChunks(playlistId, trackUris);
}

async function addTracksInChunks(playlistId, trackUris) {
  for (let i = 0; i < trackUris.length; i += 100) {
    const chunk = trackUris.slice(i, i + 100);
    await spotifyApi.addTracksToPlaylist(playlistId, chunk);
  }
}

async function getSourceTracks() {
  let allSourceTracks = [];
  for (const playlistId of sourcePlaylistIds) {
    const tracks = await getAllTracks(playlistId);
    allSourceTracks = allSourceTracks.concat(tracks);
  }
  return Array.from(new Map(allSourceTracks.map(t => [t.uri, t])).values());
}

function logDryRunSummary(destinationTracks, uniqueSourceTracks) {
  console.log('\n--- Summary of changes ---');
  console.log(`Tracks to be removed: ${destinationTracks.length}`);
  destinationTracks.forEach(track => console.log(`- ${track.name}`));
  console.log(`\nTracks to be added: ${uniqueSourceTracks.length}`);
  uniqueSourceTracks.forEach(track => console.log(`+ ${track.name}`));
  console.log('\n--- END DRY RUN ---');
}

async function executeDryRun() {
  console.log('--- DRY RUN MODE ---');
  const [uniqueSourceTracks, destinationTracks] = await Promise.all([
    getSourceTracks(),
    getAllTracks(destinationPlaylistId),
  ]);
  logDryRunSummary(destinationTracks, uniqueSourceTracks);
}

async function executeMerge() {
  const uniqueSourceTracks = await getSourceTracks();
  const uniqueTrackUris = uniqueSourceTracks.map(track => track.uri);
  await clearPlaylist(destinationPlaylistId);
  await addTracksInChunks(destinationPlaylistId, uniqueTrackUris);
  console.log('Playlists merged successfully!');
}

async function mergePlaylists() {
  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
    if (isDryRun) {
      await executeDryRun();
    } else {
      await executeMerge();
    }
  } catch (err) {
    console.error('Something went wrong!', err);
    process.exit(1);
  }
}

mergePlaylists();
