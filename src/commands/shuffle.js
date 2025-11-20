const { authenticate, getAllTracks, clearPlaylist, addTracksInChunks } = require('../spotify');
const { shuffleArray } = require('../ui');
const { formatTrackLine } = require('../format');

function isLocalTrack(track) {
    return Boolean(track?.is_local || track?.uri?.startsWith('spotify:local'));
}

function countLocalTracks(tracks) {
    return tracks.filter(isLocalTrack).length;
}

function buildResult(status, total = 0, failed = [], meta = {}) {
    const shuffled = status === 'success' || status === 'dry-run' ? total : 0;
    return { status, totalTracks: total, shuffledTracks: shuffled, failed, ...meta };
}

function printDryRun(tracks, verbose) {
    const sample = verbose ? tracks : tracks.slice(0, 15);
    console.log('\n--- Shuffle Dry Run (new order sample) ---');
    sample.forEach(track => console.log(formatTrackLine(track)));
    if (!verbose && tracks.length > sample.length) {
        console.log(`  ...and ${tracks.length - sample.length} more`);
    }
    console.log('Dry run complete; playlist left untouched.');
}

function warnLocal(localCount) {
    console.error(`Cannot shuffle playlist because it has ${localCount} local tracks.`);
    console.error('Spotify does not allow re-adding local tracks via the Web API.');
    console.error('Remove or replace those tracks, then run shuffle again.');
}

function sanitizeTracks(tracks) {
    return tracks.filter(Boolean);
}

function handleEmptyPlaylist() {
    console.log('Playlist is empty; nothing to shuffle.');
    return buildResult('empty');
}

function handleDryRun(tracks, verbose) {
    printDryRun(tracks, verbose);
    return buildResult('dry-run', tracks.length);
}

function stopForLocals(tracks) {
    const localCount = countLocalTracks(tracks);
    if (!localCount) return null;
    warnLocal(localCount);
    return buildResult('blocked-local', tracks.length, [], { localCount });
}

async function commitShuffle(playlistId, tracks) {
    const failed = [];
    await clearPlaylist(playlistId);
    await addTracksInChunks(playlistId, tracks, failed);
    if (failed.length) console.error(`Failed to re-add ${failed.length} tracks.`);
    return buildResult('success', tracks.length, failed);
}

async function loadTracks(playlistId, verbose) {
    if (!playlistId) throw new Error('Destination playlist id is required for shuffle.');
    await authenticate(!verbose);
    const tracks = await getAllTracks(playlistId, !verbose);
    return sanitizeTracks(tracks);
}

async function shufflePlaylist(playlistId, opts = {}) {
    const { dryRun = false, verbose = false } = opts;
    const tracks = await loadTracks(playlistId, verbose);
    if (!tracks.length) return handleEmptyPlaylist();
    const localBlock = stopForLocals(tracks);
    if (localBlock) return localBlock;
    shuffleArray(tracks);
    if (dryRun) return handleDryRun(tracks, verbose);
    return commitShuffle(playlistId, tracks);
}

module.exports = {
    shufflePlaylist,
};
