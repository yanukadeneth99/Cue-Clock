export default ({ config }) => {
  // Read from environment variables (set by CI/CD or local .env)
  // Fallback to open-source defaults for local development
  const projectId = process.env.EAS_PROJECT_ID || "dev-local-open-source";
  const owner = process.env.EAS_OWNER || "open-source-contributor";

  // Test builds (EXPO_PUBLIC_CUE_TEST_BUILD=1) switch Firebase reporting off. Real builds never set this.
  const plugins =
    process.env.EXPO_PUBLIC_CUE_TEST_BUILD === "1"
      ? [...(config.plugins || []), "./plugins/withTestBuildNoTelemetry"]
      : config.plugins;

  return {
    ...config,
    ...(plugins ? { plugins } : {}),
    owner,
    extra: {
      ...(config.extra || {}),
      eas: {
        projectId,
      },
    },
  };
};
