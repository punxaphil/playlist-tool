const FLAGS = {
  DRY_RUN: '--dry-run',
  CHECK_UNAVAILABLE: '--check-unavailable',
  MERGE: '--merge',
  HELP: '--help',
  VERBOSE: '--verbose',
};

const SCOPES = [
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-collaborative',
];

const REDIRECT_URI = 'http://localhost:8888/callback';
const PORT = 8888;
const API_LIMIT = 100;

module.exports = {
  FLAGS,
  SCOPES,
  REDIRECT_URI,
  PORT,
  API_LIMIT,
};
