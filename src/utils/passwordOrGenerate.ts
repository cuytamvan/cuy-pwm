import * as p from '@clack/prompts';
import chalk from 'chalk';
import { promptGeneratePassword } from '../generator';
import { passwordBox } from '../ui';
import { checkCancel } from './checkCancel';

export async function passwordOrGenerate(): Promise<string> {
  const choice = checkCancel(
    await p.select({
      message: 'How would you like to set the password?',
      options: [
        { value: 'manual', label: `${chalk.blue('⌨️ ')}  Enter manually` },
        { value: 'generate', label: `${chalk.yellow('🎲')} Generate password` },
      ],
    }),
  );

  if (choice === 'generate') {
    const generated = await promptGeneratePassword();
    if (!generated) {
      p.log.warn(
        chalk.yellow('Generation cancelled, falling back to manual input.'),
      );
      return checkCancel(await p.password({ message: 'Password' }));
    }
    console.log(passwordBox(generated, '🎲 Generated password'));
    return generated;
  }

  return checkCancel(await p.password({ message: 'Password' }));
}
