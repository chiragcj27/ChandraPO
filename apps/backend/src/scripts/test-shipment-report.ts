#!/usr/bin/env node

/**
 * Send a test active shipment status report email (Excel attachment).
 * Run from apps/backend: npm run test:shipment-report
 *
 * Requires in .env:
 *   RESEND_API_KEY
 *   DELIVERY_NOTIFY_EMAILS (or DELIVERY_NOTIFY_EMAIL_1 / DELIVERY_NOTIFY_EMAIL_2)
 *   RESEND_FROM_EMAIL (or GMAIL_USER)
 */

import dotenv from 'dotenv';
import { connectDB, Tracking } from '@repo/db';
import { triggerShipmentReportJob } from '../services/shipment-report-cron.service';

dotenv.config();

async function main() {
  try {
    console.log('[TestShipmentReport] Connecting to database...');
    await connectDB();

    const activeCount = await Tracking.countDocuments({ isActive: true });
    console.log(`[TestShipmentReport] Found ${activeCount} active tracking records.`);

    console.log('[TestShipmentReport] Sending active shipment status report email...');
    await triggerShipmentReportJob();

    console.log('[TestShipmentReport] Done. Check the recipient inbox for the Excel attachment.');
    process.exit(0);
  } catch (error) {
    console.error('[TestShipmentReport] Failed:', error);
    process.exit(1);
  }
}

main();

