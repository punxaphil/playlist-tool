const { getAllTracks } = require('./spotify');

function isLocal(track) {
  return !!track?.uri && track.uri.startsWith('spotify:local');
}

function normalizeTrack(track) {
  return track && track.uri ? track : null;
}

async function fetchPlaylistTracks(pid, silent) {
  const items = await getAllTracks(pid, silent);
  return items.filter(Boolean).map(normalizeTrack).filter(Boolean);
}

function addToMap(map, tracks, pid) {
  const seen = new Set();
  for (const t of tracks) {
    if (isLocal(t) || seen.has(t.uri)) continue;
    seen.add(t.uri);
    const entry = map.get(t.uri) || { track: t, playlists: new Set() };
    entry.playlists.add(pid);
    map.set(t.uri, entry);
  }
}

async function buildMap(ids, verbose) {
  const silent = !verbose;
  const map = new Map();
  for (const pid of ids) {
    const tracks = await fetchPlaylistTracks(pid, silent);
    addToMap(map, tracks, pid);
  }
  return map;
}

function toDuplicates(map) {
  const dupes = [];
  for (const { track, playlists } of map.values()) {
    if (playlists.size > 1) dupes.push({ track, playlists: Array.from(playlists) });
  }
  return dupes;
}

module.exports = {
  isLocal,
  buildMap,
  toDuplicates,
};

