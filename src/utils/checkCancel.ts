import * as p from '@clack/prompts';
import chalk from 'chalk';

export function checkCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel(chalk.red('Cancelled.'));
    process.exit(0);
  }
  return value as T;
}
