function printHelp() {
  console.log(`
  Spotify Playlist Tool

  Usage: node playlist-tool.js <command> [options]

  Commands:
    merge                 Merge source playlists into destination (uses env IDs)
    merge-dry-run         Simulate the merge without making any changes
    check-unavailable     List count of local (excluded) tracks in sources; with --verbose prints all
    dupes <ids...>        Find songs present in more than one of the given playlist IDs

  Options:
    --verbose             Enable additional detail (samples, IDs next to names)
    --help                Show this help message

  Environment:
    SPOTIFY_SOURCE_PLAYLIST_IDS   Comma-separated source playlist IDs
    SPOTIFY_DESTINATION_PLAYLIST_ID Destination playlist ID
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

function printDuplicatesReport(dupes, opts = {}) {
  const { names, verbose = false } = opts || {};
  console.log('\n--- Duplicates Report ---');
  console.log(`Tracks appearing in more than one playlist: ${dupes.length}`);

  // Group by playlist combination (sorted, stable key)
  const groups = new Map();
  dupes.forEach(({ track, playlists }) => {
    const sorted = [...playlists].sort();
    const key = sorted.join('||');
    const entry = groups.get(key) || { playlists: sorted, tracks: [] };
    entry.tracks.push(track);
    groups.set(key, entry);
  });

  // Print each group with human-friendly playlist names
  for (const { playlists, tracks } of groups.values()) {
    const listLabel = playlists
      .map(id => {
        const nm = names?.[id];
        return verbose && nm ? `${nm} (${id})` : (nm || id);
      })
      .join(', ');

    console.log(`\nSongs in ${listLabel}:`);
    tracks.forEach(t => {
      const title = t?.name || 'Unknown title';
      const artists = Array.isArray(t?.artists) ? t.artists.map(a => a.name).join(', ') : 'Unknown artist';
      console.log(`* ${title} — ${artists}`);
    });
  }

  console.log('\n--- END REPORT ---');
}

module.exports = {
  printHelp,
  shuffleArray,
  logDryRunSummary,
  printDuplicatesReport,
};
