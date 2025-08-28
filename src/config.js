const { FLAGS } = require('./constants');

const isDryRun = process.argv.includes(FLAGS.DRY_RUN);
const checkUnavailable = process.argv.includes(FLAGS.CHECK_UNAVAILABLE);
const doMerge = process.argv.includes(FLAGS.MERGE);
const isVerbose = process.argv.includes(FLAGS.VERBOSE);
const showHelp = process.argv.length === 2 || process.argv.includes(FLAGS.HELP);

const sourcePlaylistIds = process.env.SPOTIFY_SOURCE_PLAYLIST_IDS
  ? process.env.SPOTIFY_SOURCE_PLAYLIST_IDS.split(',').map(id => id.trim()).filter(Boolean)
  : [];
const destinationPlaylistId = process.env.SPOTIFY_DESTINATION_PLAYLIST_ID
  ? process.env.SPOTIFY_DESTINATION_PLAYLIST_ID.trim()
  : '';

function validate() {
  if (checkUnavailable || showHelp) return;

  if (!process.env.SPOTIFY_SOURCE_PLAYLIST_IDS || !process.env.SPOTIFY_DESTINATION_PLAYLIST_ID) {
    console.error('Error: Playlist IDs are not configured. Please set SPOTIFY_SOURCE_PLAYLIST_IDS and SPOTIFY_DESTINATION_PLAYLIST_ID environment variables.');
    process.exit(1);
  }

  if (sourcePlaylistIds.length === 0) {
    console.error('Error: No source playlist IDs are configured. Please check your SPOTIFY_SOURCE_PLAYLIST_IDS environment variable.');
    process.exit(1);
  }
}

module.exports = {
  isDryRun,
  checkUnavailable,
  doMerge,
  isVerbose,
  showHelp,
  sourcePlaylistIds,
  destinationPlaylistId,
  validate,
};
