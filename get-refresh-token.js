const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const open = require('open');
const prompts = require('prompts');

const scopes = [
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-collaborative',
];

const redirectUri = 'http://127.0.0.1:8888/callback';
let spotifyApi;

const credentialPrompts = [
  {
    type: 'text',
    name: 'clientId',
    message: 'Enter your Spotify Client ID:',
  },
  {
    type: 'text',
    name: 'clientSecret',
    message: 'Enter your Spotify Client Secret:',
  },
];

async function promptForCredentials() {
  return await prompts(credentialPrompts);
}

function initializeSpotifyApi(clientId, clientSecret) {
  return new SpotifyWebApi({ clientId, clientSecret, redirectUri });
}

async function handleAuthorizationCallback(req, res, server) {
  try {
    const { code } = req.query;
    const data = await spotifyApi.authorizationCodeGrant(code);
    console.log('Successfully retrieved refresh token!');
    console.log('Your Refresh Token is:', data.body['refresh_token']);
    res.send('Authorization successful! You can close this window.');
  } catch (err) {
    console.error('Error getting tokens:', err);
    res.send('Error getting tokens. Check the console.');
  } finally {
    server.close(() => process.exit());
  }
}

function startServerAndAuthorize() {
  const app = express();
  const server = app.listen(8888, () => {
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
    console.log('Please click the link to authorize:', authorizeURL);
    open(authorizeURL);
  });
  app.get('/callback', (req, res) => handleAuthorizationCallback(req, res, server));
}

async function main() {
  const { clientId, clientSecret } = await promptForCredentials();
  if (!clientId || !clientSecret) {
    console.log('Client ID and Client Secret are required.');
    return;
  }
  spotifyApi = initializeSpotifyApi(clientId, clientSecret);
  startServerAndAuthorize();
}

main();
