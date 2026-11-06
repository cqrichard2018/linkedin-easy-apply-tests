/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
import path from 'node:path';

export interface TestUser {
  id: string;
  email?: string;
  password?: string;
  /** `li_at` session cookie — bypasses UI login entirely (CI-friendly). */
  liAt?: string;
  stateFile: string;
}

const AUTH_DIR = path.resolve(process.cwd(), '.auth');

/**
 * Reads the multi-user roster from the environment. Any number of users can be
 * added by following the LINKEDIN_USER_<X>_* naming pattern; each one gets its
 * own persisted storageState, so sessions are fully isolated between users.
 */
export function getUsers(): TestUser[] {
  const users: TestUser[] = [];
  for (const key of ['A', 'B', 'C', 'D']) {
    const email = process.env[`LINKEDIN_USER_${key}_EMAIL`];
    const password = process.env[`LINKEDIN_USER_${key}_PASSWORD`];
    const liAt = process.env[`LINKEDIN_USER_${key}_LI_AT`];
    if (!email && !liAt) continue;
    users.push({
      id: `user${key}`,
      email,
      password,
      liAt,
      stateFile: path.join(AUTH_DIR, `${key.toLowerCase()}.json`),
    });
  }
  if (users.length === 0) {
    throw new Error(
      'No test users configured. Copy .env.example to .env and fill in ' +
        'LINKEDIN_USER_A_* (credentials or li_at cookie).',
    );
  }
  return users;
}
