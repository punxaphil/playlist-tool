# playlist-tool

Utilities for inspecting, merging, and now shuffling Spotify playlists from the command line. The tool wraps the Spotify Web API via `spotify-web-api-node` and expects valid credentials in the environment.

## Prerequisites

- Node.js 18+
- Spotify app credentials exported as environment variables:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
  - `SPOTIFY_REFRESH_TOKEN`
- Optional email notifications require `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TO`

Install dependencies once:

```bash
npm install
```

## Commands

```
node playlist-tool.js --cmd <command> [options]
```

| Command | Description | Key options |
| --- | --- | --- |
| `merge` | Merge one or more `--source` playlists into `--dest`, deduping tracks. | `--source`, `--dest`, `--dry-run`, `--verbose` |
| `shuffle` | Shuffle the track order of a single playlist in-place. | `--dest`, `--dry-run`, `--verbose` |
| `check-unavailable` | Count local/unavailable tracks across the provided `--source` playlists. | `--source`, `--verbose` |
| `dupes` | Report duplicates across the provided `--source` playlists. | `--source`, `--verbose` |

Pass `--help` to print all options.

## Shuffle workflow

1. Dry run to preview the new order without writing:
   ```bash
   node playlist-tool.js --cmd shuffle --dest YOUR_PLAYLIST_ID --dry-run --verbose
   ```
2. Run the actual shuffle when satisfied:
   ```bash
   node playlist-tool.js --cmd shuffle --dest YOUR_PLAYLIST_ID
   ```

Notes:
- Spotify does not allow re-adding local tracks via the API, so playlists containing local files must have those tracks removed or replaced before shuffling.
- `--verbose` keeps API logging on so you can monitor progress.
- Failed insertions (rare) are reported at the end so you can retry manually.

## Merge workflow (unchanged)

```bash
node playlist-tool.js --cmd merge --source SRC_ONE --source SRC_TWO --dest TARGET --verbose
```

Use `--dry-run` with merge to preview removals/additions without modifying playlists.
