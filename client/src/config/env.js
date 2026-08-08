const validateEnv = () => {
  const requiredVars = [
    'VITE_APP_NAME',
    'VITE_API_BASE_URL',
    'VITE_STRIPE_PUBLISHABLE_KEY'
  ];

  const missing = requiredVars.filter((v) => !import.meta.env[v]);

  if (missing.length > 0) {
    console.error('======================================================');
    console.error('🔥 FATAL ERROR: Missing required Vite environment variables');
    console.error('======================================================');
    missing.forEach(v => console.error(`  - ${v}`));
    console.error('\nPlease check your client/.env file.');
    console.error('======================================================');
    throw new Error(`Missing required frontend environment variables: ${missing.join(', ')}`);
  }
};

validateEnv();

export const config = {
  appName: import.meta.env.VITE_APP_NAME,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
};
