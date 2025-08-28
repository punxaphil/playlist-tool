const config = require('./src/config');
const { printHelp, shuffleArray, logDryRunSummary } = require('./src/ui');
const { authenticate, getAllTracks, clearPlaylist, addTracksInChunks } = require('./src/spotify');
const { getNonLocalSourceTracks, runCheckUnavailable } = require('./src/tracks');

const failedTracks = [];

async function executeDryRun() {
  console.log('--- EXECUTING DRY RUN ---');
  const [uniqueSourceTracks, destinationTracks] = await Promise.all([
    getNonLocalSourceTracks(config.sourcePlaylistIds),
    getAllTracks(config.destinationPlaylistId),
  ]);
  shuffleArray(uniqueSourceTracks);
  logDryRunSummary(destinationTracks, uniqueSourceTracks);
}

async function executeMerge() {
  console.log('--- EXECUTING MERGE ---');
  const uniqueSourceTracks = await getNonLocalSourceTracks(config.sourcePlaylistIds);
  shuffleArray(uniqueSourceTracks);
  console.log(`Preparing to clear destination playlist and add ${uniqueSourceTracks.length} unique tracks.`);
  await clearPlaylist(config.destinationPlaylistId);
  await addTracksInChunks(config.destinationPlaylistId, uniqueSourceTracks, failedTracks);
  console.log('--- Playlists merged successfully! ---');
}

async function main() {
  if (config.showHelp) {
    printHelp();
    return;
  }

  config.validate();

  try {
    if (config.checkUnavailable) {
      await authenticate(true);
      await runCheckUnavailable(config.sourcePlaylistIds);
      return;
    }

    await authenticate();

    if (config.isDryRun) {
      await executeDryRun();
    } else if (config.doMerge) {
      await executeMerge();
    } else {
      console.log('\nNo valid command specified.');
      printHelp();
    }
  } catch (err) {
    console.error('--- A critical error occurred! ---', err);
    process.exit(1);
  } finally {
    if (failedTracks.length > 0) {
      console.log('\n--- The following tracks failed to be added ---');
      failedTracks.forEach(track => console.log(`- ${track.name} by ${track.artists.map(a => a.name).join(', ')} (URI: ${track.uri})`));
    }
  }
}

main();
