const SpotifyWebApi = require('spotify-web-api-node');
const { promptForCredentials } = require('./src/auth-ui');
const { startServer } = require('./src/auth-server');
const { SCOPES, REDIRECT_URI } = require('./src/constants');

async function main() {
  const { clientId, clientSecret } = await promptForCredentials();

  if (!clientId || !clientSecret) {
    console.log('Client ID and Client Secret are required.');
    return;
  }

  const spotifyApi = new SpotifyWebApi({
    clientId,
    clientSecret,
    redirectUri: REDIRECT_URI,
  });

  startServer(spotifyApi, SCOPES);
}

main();
