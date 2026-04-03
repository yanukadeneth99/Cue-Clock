export default ({ config }) => {
  // Read from environment variables (set by CI/CD or local .env)
  // Fallback to open-source defaults for local development
  const projectId = process.env.EAS_PROJECT_ID || "dev-local-open-source";
  const owner = process.env.EAS_OWNER || "open-source-contributor";

  // Safely inject EAS config without losing existing structure
  const expo = config?.expo || {};

  return {
    ...config,
    expo: {
      ...expo,
      owner,
      extra: {
        ...(expo.extra || {}),
        eas: {
          projectId,
        },
      },
    },
  };
};
