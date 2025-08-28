const prompts = require('prompts');

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

module.exports = { promptForCredentials };

