export const assertEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`environment variable not found: ${key}`);
  }

  return value;
};
