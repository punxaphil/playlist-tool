const { authenticate, getAllTracks, getPlaylistName } = require('./spotify-client');
const { clearPlaylist, addTracksInChunks } = require('./spotify-playlist');

module.exports = {
  authenticate,
  getAllTracks,
  getPlaylistName,
  clearPlaylist,
  addTracksInChunks,
};
