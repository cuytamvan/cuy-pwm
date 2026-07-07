import * as p from '@clack/prompts';
import chalk from 'chalk';
import { promptGeneratePassword } from '../generator';
import { passwordBox } from '../ui';

export async function generatePasswordFlow() {
  const generated = await promptGeneratePassword();
  if (!generated) {
    p.log.warn(chalk.yellow('Generate password dibatalkan.'));
    return;
  }
  console.log(passwordBox(generated));
}
