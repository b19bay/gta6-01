// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Authored entry validation: fail before the dossier is written if this
// repo would breach the scorer's size and count gates. The check
// is read-only — it only lists directories and stats files under root — and
// mirrors the caps passed to buildDossier below, plus the 1 MiB ceiling on
// game/index.html itself. A compliant repo passes silently, so the normal
// copy-and-dossier flow is unchanged.
function assertEntryWithinGates(root) {
  const gameDir = join(root, 'game');
  const shotsDir = join(root, 'screenshots');

  let entryCount = 0;
  let totalBytes = 0;
  const walkGame = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(gameDir, full);
      const relBytes = Buffer.byteLength(rel, 'utf8');
      if (relBytes > 1000) {
        throw new Error(`entry gate: relative path under game/ is ${relBytes} bytes, over the 1000-byte limit: ${rel}`);
      }
      const info = statSync(full);
      entryCount += 1;
      if (info.isDirectory()) {
        walkGame(full);
      } else if (info.isFile()) {
        totalBytes += info.size;
      }
    }
  };
  walkGame(gameDir);

  if (entryCount > 993) {
    throw new Error(`entry gate: game/ holds ${entryCount} entries (files and directories), over the 993-entry limit`);
  }
  if (totalBytes > 50331648) {
    throw new Error(`entry gate: game/ totals ${totalBytes} bytes, over the 50331648-byte (48 MiB) limit`);
  }

  const indexSize = statSync(join(gameDir, 'index.html')).size;
  if (indexSize > 1048576) {
    throw new Error(`entry gate: game/index.html is ${indexSize} bytes, over the 1048576-byte (1 MiB) limit`);
  }

  const shotNames = readdirSync(shotsDir).filter((name) => statSync(join(shotsDir, name)).isFile());
  if (shotNames.length < 3 || shotNames.length > 4) {
    throw new Error(`entry gate: screenshots/ holds ${shotNames.length} files, outside the required 3-4 range`);
  }
  for (const name of shotNames) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > 262144) {
      throw new Error(`entry gate: screenshots/${name} is ${size} bytes, over the 262144-byte (256 KiB) limit`);
    }
  }
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
assertEntryWithinGates(here);
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
