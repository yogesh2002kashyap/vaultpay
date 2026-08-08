import Stripe from 'stripe';
import { config } from './env.js';

const VALID_STRIPE_MODES = ['test', 'live'];

const assertStripeConfiguration = () => {
  const { mode, publishableKey, secretKey, webhookSecret } = config.stripe;

  if (!VALID_STRIPE_MODES.includes(mode)) {
    throw new Error('STRIPE_MODE must be either "test" or "live".');
  }

  if (!publishableKey.startsWith(`pk_${mode}_`)) {
    throw new Error(`STRIPE_PUBLISHABLE_KEY must be a ${mode} mode publishable key.`);
  }

  if (!secretKey.startsWith(`sk_${mode}_`)) {
    throw new Error(`STRIPE_SECRET_KEY must be a ${mode} mode secret key.`);
  }

  if (!webhookSecret.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret.');
  }

  if (config.app.env === 'production' && mode !== 'live') {
    throw new Error('Production deployments must run Stripe in live mode.');
  }
};

assertStripeConfiguration();

export const stripe = new Stripe(config.stripe.secretKey, {
  appInfo: {
    name: 'VaultPay Financial Core',
    version: '1.0.0',
  },
  maxNetworkRetries: 2,
  timeout: 10000,
});

export const stripeConfig = {
  mode: config.stripe.mode,
  webhookSecret: config.stripe.webhookSecret,
};
