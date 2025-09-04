#!/usr/bin/env node
const arg = require('arg');
const { buildMap, toDuplicates } = require('./src/dupes');
const { getPlaylistName, authenticate } = require('./src/spotify');
const { performMerge, printExcluded } = require('./src/commands/merge');
const { runCheckUnavailable } = require('./src/tracks');
const { printDuplicatesReport, printHelp } = require('./src/ui');

async function doDupes(verbose, ids) {
  await authenticate(true);
  const map = await buildMap(ids, verbose);
  const dupes = toDuplicates(map);
  const pairs = await Promise.all(ids.map(async id => [id, await getPlaylistName(id)]));
  const names = Object.fromEntries(pairs);
  printDuplicatesReport(dupes, { verbose, names });
  return dupes.length;
}

async function handleMerge(sources, dest) {
  const { failed, excluded } = await performMerge(sources, dest);
  printExcluded(excluded);
  if (excluded.length && process.env.SMTP_USERNAME && process.env.SMTP_TO) {
    const { sendExcludedTracks } = require('./src/email');
    const sent = await sendExcludedTracks(dest, excluded);
    if (sent) console.log(`Excluded tracks emailed to ${process.env.SMTP_TO}`);
  }
  return failed.length;
}

function parseArgs(tokens) {
  const parsed = arg({
    '--verbose': Boolean,'-v':'--verbose','--cmd':String,'-c':'--cmd','--source':[String],'-s':'--source',
    '--dest':String,'-d':'--dest','--dry-run':Boolean,'-n':'--dry-run','--notify-email':Boolean,'-m':'--notify-email',
    '--help':Boolean,'-h':'--help',
  }, { argv: tokens, permissive: false });
  return { verbose: Boolean(parsed['--verbose']), cmd: parsed['--cmd'], dryRun: Boolean(parsed['--dry-run']), notifyEmail: Boolean(parsed['--notify-email']), help: Boolean(parsed['--help']), sources: parsed['--source'] || [], dest: parsed['--dest'] || null };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) return printHelp();
  const { cmd, verbose, sources, dest } = parsed;
  if (!cmd) return printHelp();
  if (cmd === 'merge') return handleMerge(sources, dest);
  if (cmd === 'check-unavailable') return runCheckUnavailable(sources, true);
  if (cmd === 'dupes') return doDupes(verbose, sources);
  console.error(`Unknown command: ${cmd}`);
  printHelp();
  process.exitCode = 2;
}

main().catch(err => { console.error('Fatal error:', err && err.message ? err.message : err); process.exitCode = 2; });
