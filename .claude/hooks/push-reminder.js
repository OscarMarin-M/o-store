// Hook PostToolUse: tras un `git push` a main, recuerda a Claude ejecutar la skill session-close.
const { execSync } = require('node:child_process');

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = JSON.parse(raw).tool_input?.command ?? '';
  } catch {
    return;
  }
  if (!/\bgit\b[^|;&]*\bpush\b/.test(command)) return;

  let branch = '';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // Sin repositorio: se decide solo por el texto del comando.
  }
  if (branch !== 'main' && !/\bmain\b/.test(command)) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          'Se hizo git push a main. Ejecuta ahora la skill session-close para actualizar CLAUDE.md y la memoria del proyecto.',
      },
    }),
  );
});
