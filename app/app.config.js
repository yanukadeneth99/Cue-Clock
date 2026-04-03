export default ({ config }) => {
  // Read from environment variables (set by CI/CD or local .env)
  // Fallback to open-source defaults for local development
  const projectId = process.env.EAS_PROJECT_ID || "dev-local-open-source";
  const owner = process.env.EAS_OWNER || "open-source-contributor";

  const expo = {
    ...config.expo,
    owner,
    extra: {
      ...(config.expo && config.expo.extra ? config.expo.extra : {}),
      eas: {
        projectId,
      },
    },
  };

  return {
    ...config,
    expo,
  };
};
