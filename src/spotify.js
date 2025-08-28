const { authenticate, getAllTracks } = require('./spotify-client');
const { clearPlaylist, addTracksInChunks } = require('./spotify-playlist');

module.exports = {
  authenticate,
  getAllTracks,
  clearPlaylist,
  addTracksInChunks,
};
