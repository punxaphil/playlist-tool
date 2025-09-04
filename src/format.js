function formatTrackLine(t) {
  const artists = Array.isArray(t?.artists) ? t.artists.map(a => a.name).join(', ') : 'Unknown artist';
  return `- ${t.name} by ${artists} (URI: ${t.uri})`;
}

function formatTracksList(tracks) {
  return tracks.map(formatTrackLine).join('\n');
}

module.exports = {
  formatTrackLine,
  formatTracksList,
};
