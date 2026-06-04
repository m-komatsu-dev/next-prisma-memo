import { disconnectE2eDb, ensureE2eUser } from "./e2e-db";

export default async function globalSetup() {
  try {
    await ensureE2eUser();
  } finally {
    await disconnectE2eDb();
  }
}
