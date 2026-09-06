export const createReadinessChecker = ({
  query,
  checkRedisReady,
  checkObjectStorageReady
}) => async () => {
  const checks = {
    postgres: { ok: false },
    redis: { ok: false },
    object_storage: { ok: false }
  };

  try {
    await query("SELECT 1");
    checks.postgres = { ok: true };
  } catch (error) {
    checks.postgres = { ok: false, message: error.message };
  }

  try {
    checks.redis = await checkRedisReady();
  } catch (error) {
    checks.redis = { ok: false, message: error.message };
  }

  try {
    checks.object_storage = await checkObjectStorageReady();
  } catch (error) {
    checks.object_storage = { ok: false, message: error.message };
  }

  return {
    ok: Object.values(checks).every((check) => check.ok),
    service: "api-gateway",
    checks
  };
};
