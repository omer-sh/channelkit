import { join, dirname } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs';
import { c } from '../helpers';

const CLAUDE_MD_SNIPPET = `## ChannelKit

When working with WhatsApp, SMS, Voice, Telegram, or Email messaging:
- **ChannelKit has built-in TTS/STT.** Never install TTS or STT packages in the app. Configure TTS on the ChannelKit service — the app just returns \`{ "text": "..." }\` and ChannelKit converts it to audio automatically.
- **Use ChannelKit MCP tools** (get_status, send_message, add_channel, etc.) — not curl. If MCP tools are not available, ask the user to connect: \`claude mcp add --transport http channelkit http://localhost:4000/mcp\`
- **Do not install ChannelKit** unless the user explicitly asks — it's likely already running.
- Run \`/channelkit\` to load the full ChannelKit skill with detailed integration docs, MCP tool reference, and setup patterns.`;

export function installSkillCommand(opts: { print?: boolean }) {
  // From dist/cli/commands/ → go up 3 levels to package root
  const packageRoot = dirname(dirname(dirname(__dirname)));
  const skillSource = join(packageRoot, 'SKILL.md');

  if (!existsSync(skillSource)) {
    console.error(c('yellow', '\n  ❌ SKILL.md not found in ChannelKit package.\n'));
    process.exit(1);
  }

  // --print mode: output SKILL.md to stdout (for remote machines / piping)
  if (opts.print) {
    process.stdout.write(readFileSync(skillSource, 'utf-8'));
    return;
  }

  // Check if Claude Code is installed on this machine
  const claudeDir = join(homedir(), '.claude');
  if (!existsSync(claudeDir)) {
    console.log(c('yellow', '\n  ⚠️  Claude Code does not appear to be installed on this machine.'));
    console.log(c('dim', '  (~/.claude directory not found)\n'));
    console.log(c('bright', '  If ChannelKit runs on a different machine than Claude Code,'));
    console.log(c('bright', '  use --print to output the skill and copy it to your dev machine:\n'));
    console.log(c('cyan', '  channelkit install-skill --print > channelkit-skill.md'));
    console.log(c('dim', '  Then copy channelkit-skill.md to ~/.claude/skills/channelkit/SKILL.md on your dev machine.\n'));
    process.exit(1);
  }

  // Install the skill file
  const skillDir = join(claudeDir, 'skills', 'channelkit');
  const skillDest = join(skillDir, 'SKILL.md');

  mkdirSync(skillDir, { recursive: true });
  copyFileSync(skillSource, skillDest);

  console.log(c('green', '\n  ✅ ChannelKit skill installed to ~/.claude/skills/channelkit/SKILL.md'));
  console.log(c('dim', '  Use /channelkit in Claude Code to load the full integration guide.\n'));

  // Show CLAUDE.md snippet for the user to add manually
  const claudeMdPath = join(claudeDir, 'CLAUDE.md');
  const alreadyHas = existsSync(claudeMdPath) && readFileSync(claudeMdPath, 'utf-8').includes('## ChannelKit');

  if (!alreadyHas) {
    console.log(c('bright', '  📋 For best results, add this to your ~/.claude/CLAUDE.md:\n'));
    console.log(c('dim', '  ────────────────────────────────────────────'));
    for (const line of CLAUDE_MD_SNIPPET.split('\n')) {
      console.log(c('dim', `  ${line}`));
    }
    console.log(c('dim', '  ────────────────────────────────────────────\n'));
    console.log(c('bright', '  This ensures Claude Code always knows about ChannelKit\'s built-in features.'));
    console.log(c('dim', '  Without it, Claude may try to install TTS/STT packages in your app.\n'));
  }
}
