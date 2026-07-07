import * as p from '@clack/prompts';

const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numeric: '0123456789',
  symbol: '!@#$%^&*()_+-=[]{}|;:,.<>?',
} as const;

type CharsetKey = keyof typeof CHARSETS;

/**
 * Alur interaktif: checklist opsi karakter -> input panjang password
 * (default 8) -> generate. Return undefined kalau user cancel/invalid.
 */
export async function promptGeneratePassword(): Promise<string | undefined> {
  const options = await p.multiselect({
    message:
      'Pilih jenis karakter untuk password (spasi untuk pilih, enter untuk lanjut)',
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
    p.log.error('Minimal pilih 1 jenis karakter.');
    return undefined;
  }

  const lengthInput = await p.text({
    message: 'Panjang password',
    placeholder: '8',
    initialValue: '8',
    validate(value) {
      if (!value) return;
      const n = Number(value);
      if (Number.isNaN(n) || !Number.isInteger(n))
        return 'Harus berupa angka bulat';
      if (n < 4) return 'Panjang minimal 4 karakter';
      if (n > 128) return 'Panjang maksimal 128 karakter';
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

  // pastikan minimal 1 karakter dari tiap pool yang dipilih
  for (const pool of pools) {
    result.push(pool[randomInt(pool.length)]!);
  }

  while (result.length < length) {
    result.push(allChars[randomInt(allChars.length)]!);
  }

  // fisher-yates shuffle
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
