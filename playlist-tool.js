#!/usr/bin/env node
/* eslint-disable no-console */
const arg = require('arg');
const nodemailer = require('nodemailer');
const { authenticate, getAllTracks, getPlaylistName } = require('./src/spotify');
const { getNonLocalSourceTracks, runCheckUnavailable } = require('./src/tracks');
const { shuffleArray, logDryRunSummary, printDuplicatesReport, printHelp } = require('./src/ui');
const { buildMap, toDuplicates } = require('./src/dupes');

function parseArgs(tokens) {
  const spec = {
    '--verbose': Boolean,
    '-v': '--verbose',
    '--cmd': String,
    '-c': '--cmd',
    '--source': [String],
    '-s': '--source',
    '--dest': String,
    '-d': '--dest',
    '--dry-run': Boolean,
    '-n': '--dry-run',
    '--notify-email': Boolean,
    '-m': '--notify-email',
    '--help': Boolean,
    '-h': '--help',
  };
  const parsed = arg(spec, { argv: tokens, permissive: false });
  return {
    verbose: Boolean(parsed['--verbose']),
    cmd: parsed['--cmd'],
    dryRun: Boolean(parsed['--dry-run']),
    notifyEmail: Boolean(parsed['--notify-email']),
    help: Boolean(parsed['--help']),
    sources: parsed['--source'] || [],
    dest: parsed['--dest'] || null,
  };
}

async function doDryRun(sources, dest, verbose) {
  await authenticate();
  if (!sources || sources.length < 1 || !dest) {
    console.error('Usage: --cmd merge-dry-run --source <id> [--source <id> ...] --dest <id>');
    process.exitCode = 1;
    return;
  }
  const [srcTracks, destTracks] = await Promise.all([
    getNonLocalSourceTracks(sources, verbose),
    getAllTracks(dest),
  ]);
  shuffleArray(srcTracks);
  logDryRunSummary(destTracks, srcTracks, { verbose });
}

async function doMerge(sources, dest) {
  await authenticate();
  if (!sources || sources.length < 1 || !dest) {
    console.error('Usage: --cmd merge --source <id> [--source <id> ...] --dest <id>');
    process.exitCode = 1;
    return;
  }
  const tracks = await getNonLocalSourceTracks(sources, false);
  shuffleArray(tracks);
  const { clearPlaylist, addTracksInChunks } = require('./src/spotify');
  const failed = [];
  await clearPlaylist(dest);
  await addTracksInChunks(dest, tracks, failed);
  if (failed.length) {
    console.log('\n--- The following tracks failed to be added ---');
    failed.forEach(t => console.log(`- ${t.name} by ${t.artists.map(a => a.name).join(', ')} (URI: ${t.uri})`));
  }
}

async function doCheckUnavailable(sources) {
  await authenticate(true);
  if (!sources || sources.length < 1) {
    console.error('Usage: --cmd check-unavailable --source <id> [--source <id> ...]');
    process.exitCode = 1;
    return;
  }
  await runCheckUnavailable(sources, true);
}

async function doDupes(verbose, ids) {
  await authenticate(true);
  if (!ids || !ids.length) {
    console.error('Usage: --cmd dupes --source <id> [--source <id> ...] [--verbose]');
    process.exitCode = 1;
    return 0;
  }
  const map = await buildMap(ids, verbose);
  const dupes = toDuplicates(map);
  const pairs = await Promise.all(ids.map(async id => [id, await getPlaylistName(id)]));
  const names = Object.fromEntries(pairs);
  printDuplicatesReport(dupes, { verbose, names });
  return dupes.length;
}

function buildTransportFromEnv() {
  const host = process.env.SMTP_SERVER || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  const secure = port === 465;
  const auth = user && pass ? { user, pass } : undefined;
  return { host,  port, secure, auth };
}

async function sendEmailRaw(subject, body) {
  const transportOpts = buildTransportFromEnv();
  if (!transportOpts.host) {
    console.error('No SMTP host configured; skipping email');
    return;
  }
  const transporter = nodemailer.createTransport(transportOpts);
  const from = process.env.SMTP_USERNAME;
  const to = process.env.SMTP_TO;
  try {
    await transporter.sendMail({ from, to, subject, text: body });
  } catch (err) {
    console.error('Failed to send notification email:', err && err.message ? err.message : err);
  }
}

function normalizeId(input) {
  if (!input || typeof input !== 'string') return null;
  input = input.trim();
  const mUri = input.match(/^spotify:playlist:([A-Za-z0-9]+)$/i);
  if (mUri) return mUri[1];
  const mUrl = input.match(/playlist\/([A-Za-z0-9]+)(?:\?|$)/i);
  if (mUrl) return mUrl[1];
  const candidate = input.replace(/\s+/g, '');
  if (/^[A-Za-z0-9]{22}$/.test(candidate)) return candidate;
  return null;
}

function validateIds(sourcesArr, destId, options = { requireDest: false }) {
  const bad = [];
  const normalizedSources = (sourcesArr || []).map(s => ({ raw: s, id: normalizeId(s) }));
  normalizedSources.forEach(({ raw, id }) => { if (!id) bad.push({ raw, reason: 'invalid source id/URL' }); });
  let normalizedDest = null;
  if (options.requireDest) {
    normalizedDest = normalizeId(destId);
    if (!normalizedDest) bad.push({ raw: destId, reason: 'invalid destination id/URL' });
  }
  return { ok: bad.length === 0, bad, sources: normalizedSources.map(s => s.id).filter(Boolean), dest: normalizedDest };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  // capture stdout/stderr while running the command so email body can be exact
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  let captured = '';
  process.stdout.write = function writeStdout(...args) {
    try { captured += (args[0] == null ? '' : args[0].toString()); } catch (e) { /* ignore */ }
    return stdoutWrite.apply(process.stdout, args);
  };
  process.stderr.write = function writeStderr(...args) {
    try { captured += (args[0] == null ? '' : args[0].toString()); } catch (e) { /* ignore */ }
    return stderrWrite.apply(process.stderr, args);
  };

  const { cmd, verbose, sources, dest, notifyEmail } = parsed;
  let dupesCount = 0;

  if (!cmd) {
    printHelp();
    process.exitCode = 2;
    // restore before exit
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
    return;
  }

  if (cmd === 'merge') {
    const res = validateIds(sources, dest, { requireDest: true });
    if (!res.ok) {
      console.error('Invalid playlist ids provided:');
      res.bad.forEach(b => console.error(` - ${b.raw} (${b.reason})`));
      console.error('\nPlease provide Spotify playlist IDs, playlist URLs (https://open.spotify.com/playlist/{id}) or spotify:playlist:{id} URIs.');
      process.exitCode = 1;
    } else if (parsed.dryRun) {
      await doDryRun(res.sources, res.dest, verbose);
    } else {
      await doMerge(res.sources, res.dest);
    }
  } else if (cmd === 'check-unavailable') {
    const res = validateIds(sources, null, { requireDest: false });
    if (!res.ok) {
      console.error('Invalid source playlist ids provided:');
      res.bad.forEach(b => console.error(` - ${b.raw} (${b.reason})`));
      process.exitCode = 1;
    } else {
      await doCheckUnavailable(res.sources);
    }
  } else if (cmd === 'dupes') {
    const res = validateIds(sources, null, { requireDest: false });
    if (!res.ok) {
      console.error('Invalid playlist ids provided for dupes:');
      res.bad.forEach(b => console.error(` - ${b.raw} (${b.reason})`));
      process.exitCode = 1;
    } else {
      dupesCount = await doDupes(verbose, res.sources);
    }
  } else {
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exitCode = 2;
  }

  // restore stdout/stderr
  process.stdout.write = stdoutWrite;
  process.stderr.write = stderrWrite;

  if (notifyEmail && dupesCount > 0) {
    const subject = `Playlist-tool: duplicate tracks found (${dupesCount})`;
    await sendEmailRaw(subject, captured);
  }
}

main().catch(err => {
  console.error('Fatal error:', err && err.message ? err.message : err);
  process.exitCode = 2;
});
