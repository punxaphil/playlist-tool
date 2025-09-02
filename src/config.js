// This module intentionally provides lightweight access to env-based defaults.
// The CLI (`playlist-tool.js`) now owns argument parsing and validation. Keep
// these exports for backward compatibility but don't enforce or exit.

const sourcePlaylistIds = process.env.SPOTIFY_SOURCE_PLAYLIST_IDS
  ? process.env.SPOTIFY_SOURCE_PLAYLIST_IDS.split(',').map(id => id.trim()).filter(Boolean)
  : [];

const destinationPlaylistId = process.env.SPOTIFY_DESTINATION_PLAYLIST_ID
  ? process.env.SPOTIFY_DESTINATION_PLAYLIST_ID.trim()
  : '';

function validate() {
  // No-op: argument validation is performed by the CLI layer.
}

module.exports = {
  sourcePlaylistIds,
  destinationPlaylistId,
  validate,
};
