#!/usr/bin/env node

/**
 * Send a test delivery notification email (for testing Gmail SMTP).
 * Run from apps/backend: npm run test:delivery-email
 *
 * Requires in .env: GMAIL_USER, GMAIL_APP_PASSWORD, DELIVERY_NOTIFY_EMAIL_1 (and optionally DELIVERY_NOTIFY_EMAIL_2).
 */

import dotenv from 'dotenv';
import { sendDeliveryNotificationEmail } from '../services/delivery-email.service';

dotenv.config();

async function main() {
  console.log('Sending test delivery notification email...');
  const result = await sendDeliveryNotificationEmail({
    trackingId: 'TEST-' + Date.now(),
    provider: 'Malca-Amit',
    latestStatus: 'Delivered (test)',
    clientName: 'Test Client',
  });
  if (result.success) {
    console.log('Done. Check the recipient inbox.');
  } else {
    console.error('Failed:', result.error);
    process.exit(1);
  }
}

main();
