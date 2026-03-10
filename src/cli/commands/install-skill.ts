import { join, dirname } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs';
import { c } from '../helpers';

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

  const skillDir = join(claudeDir, 'skills', 'channelkit');
  const skillDest = join(skillDir, 'SKILL.md');

  mkdirSync(skillDir, { recursive: true });
  copyFileSync(skillSource, skillDest);

  console.log(c('green', '\n  ✅ ChannelKit skill installed to ~/.claude/skills/channelkit/SKILL.md'));
  console.log(c('dim', '  Claude Code will now use it when helping with messaging integrations.\n'));
}
