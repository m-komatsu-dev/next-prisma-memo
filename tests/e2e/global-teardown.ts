import { cleanupE2eData, disconnectE2eDb, shouldSkipE2eDatabaseSetup } from "./e2e-db";

export default async function globalTeardown() {
  try {
    if (!shouldSkipE2eDatabaseSetup()) {
      await cleanupE2eData();
    }
  } finally {
    await disconnectE2eDb();
  }
}
