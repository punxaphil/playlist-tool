const express = require('express');
const open = require('open');
const { PORT } = require('./constants');

function startServer(spotifyApi, scopes) {
  const app = express();

  const server = app.listen(PORT, () => {
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
    console.log('Please click the link to authorize:', authorizeURL);
    open(authorizeURL);
  });

  app.get('/callback', async(req, res) => {
    const { code } = req.query;
    if (!code) {
      res.send('Authorization failed. No code provided.');
      server.close(() => process.exit(1));
      return;
    }

    try {
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
  });
}

module.exports = { startServer };
