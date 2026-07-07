import * as p from '@clack/prompts';

const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numeric: '0123456789',
  symbol: '!@#$%^&*()_+-=[]{}|;:,.<>?',
} as const;

type CharsetKey = keyof typeof CHARSETS;

export async function promptGeneratePassword(): Promise<string | undefined> {
  const options = await p.multiselect({
    message:
      'Select character types for password (space to select, enter to continue)',
    options: [
      { value: 'upper', label: 'UPPERCASE (A-Z)' },
      { value: 'lower', label: 'lowercase (a-z)' },
      { value: 'numeric', label: 'Numeric (0-9)' },
      { value: 'symbol', label: 'Symbol (!@#$%^&*...)' },
    ],
    required: true,
  });

  if (p.isCancel(options)) return undefined;

  const selected = options as CharsetKey[];

  if (!selected.length) {
    p.log.error('Select at least 1 character type.');
    return undefined;
  }

  const lengthInput = await p.text({
    message: 'Password length',
    placeholder: '8',
    initialValue: '8',
    validate(value) {
      if (!value) return;
      const n = Number(value);
      if (Number.isNaN(n) || !Number.isInteger(n))
        return 'Must be a whole number';
      if (n < 4) return 'Minimum length is 4 characters';
      if (n > 128) return 'Maximum length is 128 characters';
    },
  });

  if (p.isCancel(lengthInput)) return undefined;

  const length = Number(lengthInput || '8');

  return generatePassword(selected, length);
}

export function generatePassword(
  selected: CharsetKey[],
  length: number,
): string {
  const pools = selected.map((s) => CHARSETS[s]);
  const allChars = pools.join('');

  const result: string[] = [];

  for (const pool of pools) {
    result.push(pool[randomInt(pool.length)]!);
  }

  while (result.length < length) {
    result.push(allChars[randomInt(allChars.length)]!);
  }

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const current = result[i]!;
    result[i] = result[j]!;
    result[j] = current;
  }

  return result.slice(0, length).join('');
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}
