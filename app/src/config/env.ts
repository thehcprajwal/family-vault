function readRequiredEnv(key: 'VITE_API_URL'): string {
  const value = import.meta.env[key];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.trim().replace(/\/+$/, '');
}

export const env = {
  apiUrl: readRequiredEnv('VITE_API_URL'),
};
