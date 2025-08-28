const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
});

const isDryRun = process.argv.includes('--dry-run');

const failedTracks = [];

console.log('--- Starting Playlist Merge Script ---');
console.log(`Dry Run Mode: ${isDryRun}`);

if (!process.env.SPOTIFY_SOURCE_PLAYLIST_IDS || !process.env.SPOTIFY_DESTINATION_PLAYLIST_ID) {
  console.error('Error: Playlist IDs are not configured. Please set SPOTIFY_SOURCE_PLAYLIST_IDS and SPOTIFY_DESTINATION_PLAYLIST_ID environment variables.');
  process.exit(1);
}

const sourcePlaylistIds = process.env.SPOTIFY_SOURCE_PLAYLIST_IDS.split(',').map(id => id.trim()).filter(Boolean);
const destinationPlaylistId = process.env.SPOTIFY_DESTINATION_PLAYLIST_ID.trim();

console.log('--- Playlist Configuration ---');
console.log('Source Playlist IDs:', sourcePlaylistIds);
console.log('Destination Playlist ID:', destinationPlaylistId);

if (sourcePlaylistIds.length === 0) {
  console.error('Error: No source playlist IDs are configured. Please check your SPOTIFY_SOURCE_PLAYLIST_IDS environment variable.');
  process.exit(1);
}

async function fetchPaginatedTracks(playlistId) {
  console.log(`Fetching paginated tracks for playlist ID: ${playlistId}`);
  let tracks = [];
  let offset = 0;
  const limit = 100;
  let response;
  try {
    do {
      console.log(`  - Fetching tracks, offset: ${offset}`);
      response = await spotifyApi.getPlaylistTracks(playlistId, { offset, limit });
      tracks = tracks.concat(response.body.items);
      offset += limit;
    } while (response.body.next);
    console.log(`  - Successfully fetched ${tracks.length} track items for playlist ID: ${playlistId}`);
    return tracks;
  } catch (err) {
    console.error(`Error fetching tracks for playlist ID: ${playlistId}`, err);
    throw err;
  }
}

async function getAllTracks(playlistId) {
  console.log(`Getting all tracks for playlist ID: ${playlistId}`);
  const items = await fetchPaginatedTracks(playlistId);
  const tracks = items.map(item => item.track).filter(Boolean);
  console.log(`  - Found ${tracks.length} valid tracks for playlist ID: ${playlistId}`);
  return tracks;
}

async function removeTracksInChunks(playlistId, trackUris) {
  console.log(`Removing ${trackUris.length} tracks from playlist ID: ${playlistId}`);
  for (let i = 0; i < trackUris.length; i += 100) {
    const chunk = trackUris.slice(i, i + 100);
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

async function addTrackIndividually(playlistId, trackChunk) {
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

async function addTracksInChunks(playlistId, tracks) {
  console.log(`Adding ${tracks.length} tracks to playlist ID: ${playlistId}`);
  for (let i = 0; i < tracks.length; i += 10) {
    const chunk = tracks.slice(i, i + 10);
    const trackUris = chunk.map(t => t.uri);
    try {
      console.log(`  - Adding chunk of ${chunk.length} tracks`);
      await spotifyApi.addTracksToPlaylist(playlistId, trackUris);
    } catch (err) {
      console.error(`  - FAILED to add chunk.`, err.body);
      await addTrackIndividually(playlistId, chunk);
    }
  }
  console.log('  - Finished adding tracks.');
}

async function getSourceTracks() {
  console.log('--- Fetching and Combining Source Tracks ---');
  let allSourceTracks = [];
  for (const playlistId of sourcePlaylistIds) {
    console.log(`Fetching tracks from source playlist ID: ${playlistId}`);
    const tracks = await getAllTracks(playlistId);
    allSourceTracks = allSourceTracks.concat(tracks);
    console.log(`  - Fetched ${tracks.length} tracks. Total tracks so far: ${allSourceTracks.length}`);
  }
  const uniqueTracks = Array.from(new Map(allSourceTracks.map(t => [t.uri, t])).values());
  console.log(`Total unique tracks from all sources: ${uniqueTracks.length}`);
  return uniqueTracks;
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
  console.log('--- EXECUTING DRY RUN ---');
  const [uniqueSourceTracks, destinationTracks] = await Promise.all([
    getSourceTracks(),
    getAllTracks(destinationPlaylistId),
  ]);
  logDryRunSummary(destinationTracks, uniqueSourceTracks);
}

async function executeMerge() {
  console.log('--- EXECUTING MERGE ---');
  const uniqueSourceTracks = await getSourceTracks();
  console.log(`Preparing to clear destination playlist and add ${uniqueSourceTracks.length} unique tracks.`);
  await clearPlaylist(destinationPlaylistId);
  await addTracksInChunks(destinationPlaylistId, uniqueSourceTracks);
  console.log('--- Playlists merged successfully! ---');
}

async function mergePlaylists() {
  try {
    console.log('--- Authenticating with Spotify ---');
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('  - Authentication successful.');
    if (isDryRun) {
      await executeDryRun();
    } else {
      await executeMerge();
    }
  } catch (err) {
    console.error('--- A critical error occurred! ---');
    console.error('Something went wrong!', err);
    process.exit(1);
  } finally {
    if (failedTracks.length > 0) {
      console.log('\n--- The following tracks failed to be added ---');
      failedTracks.forEach(track => console.log(`- ${track.name} by ${track.artists.map(a => a.name).join(', ')} (URI: ${track.uri})`));
    }
  }
}

mergePlaylists();
