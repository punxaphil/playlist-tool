const { formatTracksList } = require('./format');
const { DEFAULT_SMTP_SERVER, DEFAULT_SMTP_PORT } = require('./constants');
const nodemailer = require('nodemailer');

function buildTransportFromEnv() {
  const host = process.env.SMTP_SERVER || DEFAULT_SMTP_SERVER;
  const port = Number(process.env.SMTP_PORT || DEFAULT_SMTP_PORT);
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  const secure = port === 465;
  const auth = user && pass ? { user, pass } : undefined;
  return { host, port, secure, auth };
}

async function sendRaw(subject, body) {
  const transportOpts = buildTransportFromEnv();
  if (!transportOpts.host) return false;
  const transporter = nodemailer.createTransport(transportOpts);
  const from = process.env.SMTP_USERNAME;
  const to = process.env.SMTP_TO;
  try {
    await transporter.sendMail({ from, to, subject, text: body });
    return true;
  } catch (err) {
    return false;
  }
}

async function sendExcludedTracks(destId, tracks) {
  const subject = `Playlist-tool: excluded tracks from merge into ${destId}`;
  const body = [`Excluded tracks during merge into playlist ${destId}:`, '', formatTracksList(tracks)].join('\n');
  return sendRaw(subject, body);
}

module.exports = {
  sendExcludedTracks,
};
