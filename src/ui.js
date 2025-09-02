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
  const { names, verbose = false } = opts;
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

function printHelp() {
  console.log('\nUsage: node playlist-tool.js --cmd <command> [options]\n');
  console.log('Commands:');
  console.log('  merge            Merge one or more source playlists into a destination playlist');
  console.log('  --dry-run        When used with --cmd merge, show what would change (no writes)');
  console.log('  check-unavailable  Report unavailable tracks in source playlists');
  console.log('  dupes            Report duplicate tracks across playlists');
  console.log('\nOptions:');
  console.log('  --cmd, -c <command>       Command to run (required)');
  console.log('  --source, -s <id>         Repeatable source playlist id (one or more)');
  console.log('  --dest, -d <id>           Destination playlist id (required for merge commands)');
  console.log('  --verbose, -v             Show verbose output');
  console.log("  --dry-run, -n             Don't perform writes; implies merge dry-run");
  console.log('  --help, -h                Show this help');

  console.log('\nExamples:');
  console.log('  node playlist-tool.js --cmd merge --source SRC1 --source SRC2 --dest DEST');
  console.log('  node playlist-tool.js --cmd merge --dry-run --source SRC1 --dest DEST --verbose');
  console.log('  node playlist-tool.js --cmd check-unavailable --source SRC1 --source SRC2');
  console.log('  node playlist-tool.js --cmd dupes --source PLAYLIST_A --source PLAYLIST_B --verbose\n');
}

module.exports = {
  shuffleArray,
  logDryRunSummary,
  printDuplicatesReport,
  printHelp,
};
