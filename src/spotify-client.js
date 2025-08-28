const SpotifyWebApi = require('spotify-web-api-node');
const { API_LIMIT } = require('./constants');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
});

async function fetchPaginatedTracks(playlistId, silent = false) {
  if (!silent) console.log(`Fetching paginated tracks for playlist ID: ${playlistId}`);
  let tracks = [];
  let offset = 0;
  try {
    while (true) {
      if (!silent) console.log(`  - Fetching tracks, offset: ${offset}`);
      const response = await spotifyApi.getPlaylistTracks(playlistId, { offset, limit: API_LIMIT });
      tracks = tracks.concat(response.body.items);
      if (!response.body.next) break;
      offset += API_LIMIT;
    }
    if (!silent) console.log(`  - Successfully fetched ${tracks.length} track items for playlist ID: ${playlistId}`);
    return tracks;
  } catch (err) {
    console.error(`Error fetching tracks for playlist ID: ${playlistId}`, err);
    throw err;
  }
}

async function getAllTracks(playlistId, silent = false) {
  if (!silent) console.log(`Getting all tracks for playlist ID: ${playlistId}`);
  const items = await fetchPaginatedTracks(playlistId, silent);
  const tracks = items.map(item => item.track).filter(Boolean);
  if (!silent) console.log(`  - Found ${tracks.length} valid tracks for playlist ID: ${playlistId}`);
  return tracks;
}

async function authenticate(silent = false) {
  if (!silent) console.log('--- Authenticating with Spotify ---');
  const data = await spotifyApi.refreshAccessToken();
  spotifyApi.setAccessToken(data.body['access_token']);
  if (!silent) console.log('--- Authentication successful ---');
}

async function getPlaylistName(playlistId, silent = false) {
  try {
    const res = await spotifyApi.getPlaylist(playlistId);
    return res?.body?.name || playlistId;
  } catch (e) {
    if (!silent) console.error(`Failed to fetch name for playlist ${playlistId}`, e.body || e.message);
    return playlistId;
  }
}

module.exports = {
  spotifyApi,
  fetchPaginatedTracks,
  getAllTracks,
  authenticate,
  getPlaylistName,
};
