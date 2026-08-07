import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync('pnpm', ['exec', 'eslint', 'components/**/*.{ts,tsx}', 'pages/**/*.{ts,tsx}', '-f', 'json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

let reports;
try {
  reports = JSON.parse(result.stdout || '[]');
} catch {
  console.error('Failed to parse ESLint JSON output.');
  if (result.stderr) console.error(result.stderr);
  if (result.stdout) console.error(result.stdout.slice(0, 2000));
  process.exit(1);
}

const ruleId = 'i18next/no-literal-string';
const findings = [];

for (const report of reports) {
  for (const message of report.messages ?? []) {
    if (message.ruleId === ruleId) {
      findings.push({
        filePath: report.filePath,
        line: message.line,
        column: message.column,
        message: message.message,
      });
    }
  }
}

if (findings.length === 0) {
  console.log('i18n literal-string check passed: no untranslated JSX strings.');
  process.exit(0);
}

console.error(`i18n literal-string check failed: ${findings.length} untranslated JSX string(s).\n`);
for (const finding of findings) {
  console.error(`${finding.filePath}:${finding.line}:${finding.column}  ${finding.message}`);
}
process.exit(1);
