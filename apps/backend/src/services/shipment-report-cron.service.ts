import * as cron from 'node-cron';
import { Tracking } from '@repo/db';
import { sendActiveShipmentStatusReportEmail } from './delivery-email.service';

/**
 * Generate and send the active shipment status report email.
 */
const generateAndSendActiveShipmentReport = async (): Promise<void> => {
  try {
    console.log('[ShipmentReportCron] Generating active shipment status report...');

    const activeTrackings = await Tracking.find({ isActive: true }).lean();

    const shipments = activeTrackings.map(
      (tracking: any): { trackingId: string; clientName?: string; latestStatus: string } => ({
        trackingId: tracking.trackingId,
        clientName: tracking.clientName,
        latestStatus: tracking.latestStatus,
      })
    );

    const runAt = new Date();

    const result = await sendActiveShipmentStatusReportEmail({
      shipments,
      runAt,
    });

    if (!result.success) {
      console.error(
        '[ShipmentReportCron] Failed to send active shipment report email:',
        result.error
      );
    } else {
      console.log(
        `[ShipmentReportCron] Active shipment report email sent successfully with ${shipments.length} rows.`
      );
    }
  } catch (error) {
    console.error('[ShipmentReportCron] Error generating or sending active shipment report:', error);
  }
};

/**
 * Start the cron job to send active shipment status report at 09:00 and 21:00 every day.
 */
export const startShipmentReportCronJob = (): void => {
  // Runs at 09:00 and 21:00 every day
  const cronExpression = '0 9,21 * * *';

  console.log(
    'Starting shipment report cron job (runs at 09:00 and 21:00 server time every day)...'
  );

  cron.schedule(cronExpression, async () => {
    console.log(`[ShipmentReportCron] Running shipment report job at ${new Date().toISOString()}`);
    await generateAndSendActiveShipmentReport();
  });
};

/**
 * Manually trigger the shipment report generation (for testing or manual runs).
 */
export const triggerShipmentReportJob = async (): Promise<void> => {
  await generateAndSendActiveShipmentReport();
};

