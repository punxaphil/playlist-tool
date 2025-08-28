function printHelp() {
  console.log(`
  Spotify Playlist Merger

  Usage: node merge-playlists.js [options]

  Options:
    --merge               Merge the source playlists into the destination playlist.
    --dry-run             Simulate the merge process without making any changes.
    --check-unavailable   Check the source playlists for local tracks and print them.
    --verbose             Enable detailed logging (track lists, per-step details).
    --help                Show this help message.
  `);
}

function shuffleArray(array) {
  console.log('  - Shuffling tracks...');
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function logDryRunSummary(destinationTracks, uniqueSourceTracks, opts = {}) {
  const { verbose = false, sample = 25 } = opts;
  console.log('\n--- Summary of changes ---');
  console.log(`Tracks to be removed: ${destinationTracks.length}`);
  if (verbose) {
    destinationTracks.slice(0, sample).forEach(track => console.log(`- ${track.name}`));
    if (destinationTracks.length > sample) console.log(`  ...and ${destinationTracks.length - sample} more`);
  }
  console.log(`\nTracks to be added: ${uniqueSourceTracks.length}`);
  if (verbose) {
    uniqueSourceTracks.slice(0, sample).forEach(track => console.log(`+ ${track.name}`));
    if (uniqueSourceTracks.length > sample) console.log(`  ...and ${uniqueSourceTracks.length - sample} more`);
  }
  console.log('\n--- END DRY RUN ---');
}

module.exports = {
  printHelp,
  shuffleArray,
  logDryRunSummary,
};
