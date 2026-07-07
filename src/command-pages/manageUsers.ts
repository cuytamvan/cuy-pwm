import * as p from '@clack/prompts';
import chalk from 'chalk';
import { loadUsers, addUser, updateUser, deleteUser, newId } from '../store';
import { printBanner, pressEnterHint } from '../ui';
import { checkCancel } from '../utils';

export async function manageUsersFlow() {
  while (true) {
    printBanner();
    const users = loadUsers();

    if (users.length) {
      console.log();
      const lines = users.map(
        (u, i) =>
          `  ${chalk.dim(`${i + 1}.`)} ${chalk.whiteBright(u.name)}  ${chalk.dim(u.id)}`,
      );
      console.log(chalk.bold.cyan('👤 Users:'));
      console.log(lines.join('\n'));
      console.log();
    } else {
      console.log(chalk.dim('\n  No users registered yet.\n'));
    }

    const action = checkCancel(
      await p.select({
        message: 'Manage Users',
        options: [
          { value: 'add', label: `${chalk.green('+')} Add User` },
          { value: 'edit', label: `${chalk.yellow('✏️ ')} Edit User` },
          { value: 'delete', label: `${chalk.red('🗑 ')} Delete User` },
          { value: 'back', label: chalk.dim('← Back') },
        ],
      }),
    );

    if (action === 'back') return;

    if (action === 'add') {
      const name = checkCancel(
        await p.text({ message: 'User name', placeholder: 'e.g. John Doe' }),
      );
      addUser({ id: newId(), name });
      p.log.success(
        chalk.green(`✔ User '${chalk.bold(name)}' added successfully.`),
      );
    } else if (action === 'edit') {
      if (!users.length) {
        p.log.warn(chalk.yellow('No users yet.'));
      } else {
        const selectedId = checkCancel(
          await p.select({
            message: 'Select user to edit',
            options: users.map((u) => ({ value: u.id, label: u.name })),
          }),
        ) as string;
        const user = users.find((u) => u.id === selectedId)!;
        const name = checkCancel(
          await p.text({ message: 'New name', initialValue: user.name }),
        );
        updateUser({ ...user, name });
        p.log.success(
          chalk.green(`✔ User '${chalk.bold(name)}' updated successfully.`),
        );
      }
    } else if (action === 'delete') {
      if (!users.length) {
        p.log.warn(chalk.yellow('No users yet.'));
      } else {
        const selectedId = checkCancel(
          await p.select({
            message: 'Select user to delete',
            options: users.map((u) => ({ value: u.id, label: u.name })),
          }),
        ) as string;
        const user = users.find((u) => u.id === selectedId)!;
        const confirmed = checkCancel(
          await p.confirm({
            message: `Delete user '${chalk.bold(user.name)}'? Linked credentials will not be deleted.`,
            initialValue: false,
          }),
        );
        if (confirmed) {
          deleteUser(user.id);
          p.log.success(
            chalk.green(
              `✔ User '${chalk.bold(user.name)}' deleted successfully.`,
            ),
          );
        } else {
          p.log.info(chalk.dim('Cancelled.'));
        }
      }
    }

    await p.text({ message: pressEnterHint(), defaultValue: '' });
  }
}
