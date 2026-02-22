import * as cron from 'node-cron';
import { Tracking, TrackingStatus } from '@repo/db';
import { malcaAmitService } from './malca-amit.service';
import { sendDeliveryNotificationEmail } from './delivery-email.service';

/**
 * Fetch and update tracking status for a single tracking record
 */
const updateTrackingStatus = async (tracking: any): Promise<void> => {
  try {
    // Only update active trackings
    if (!tracking.isActive) {
      return;
    }

    // Fetch latest status from API
    let statusHistory: TrackingStatus[] = [];
    let latestStatus = 'Error';

    try {
      // For now, we only support Malca-Amit
      if (
        tracking.provider.toLowerCase().includes('malca') ||
        tracking.provider.toLowerCase().includes('amit')
      ) {
        statusHistory = await malcaAmitService.getTracking(tracking.trackingId);
        
        if (statusHistory.length > 0) {
          latestStatus = statusHistory[0].status;
        } else {
          latestStatus = 'Not Found';
        }
      } else {
        latestStatus = 'Unknown Provider';
      }
    } catch (error: any) {
      console.error(`Error fetching tracking for ${tracking.trackingId}:`, error);
      latestStatus = 'Error';
    }

    // Check if status is "delivered" - if so, mark as inactive
    const isActive = latestStatus.toLowerCase() !== 'delivered';
    const wasDeliveredBefore = (tracking.latestStatus || '').toLowerCase().includes('delivered');
    const isNowDelivered = !isActive;

    // Update tracking record
    await Tracking.findByIdAndUpdate(tracking._id, {
      latestStatus,
      statusHistory,
      isActive,
      lastUpdated: new Date(),
    });

    // Notify when status just changed to delivered
    if (!wasDeliveredBefore && isNowDelivered) {
      sendDeliveryNotificationEmail({
        trackingId: tracking.trackingId,
        provider: tracking.provider,
        latestStatus,
        clientName: tracking.clientName,
      }).catch((err) =>
        console.error(`[Cron] Delivery email failed for ${tracking.trackingId}:`, err)
      );
    }

    console.log(`Updated tracking ${tracking.trackingId}: ${latestStatus} (Active: ${isActive})`);
  } catch (error: any) {
    console.error(`Error updating tracking ${tracking.trackingId}:`, error);
  }
};

/**
 * Update all active tracking statuses
 */
const updateAllTrackings = async (): Promise<void> => {
  try {
    console.log('Starting scheduled tracking update...');
    
    // Get all active trackings
    const activeTrackings = await Tracking.find({ isActive: true }).lean();

    console.log(`Found ${activeTrackings.length} active trackings to update`);

    // Update each tracking (with some concurrency control)
    const batchSize = 10;
    for (let i = 0; i < activeTrackings.length; i += batchSize) {
      const batch = activeTrackings.slice(i, i + batchSize);
      await Promise.all(batch.map((tracking) => updateTrackingStatus(tracking)));
      
      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < activeTrackings.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log('Completed scheduled tracking update');
  } catch (error: any) {
    console.error('Error in scheduled tracking update:', error);
  }
};

/**
 * Start the cron job to update tracking statuses every 6 hours
 */
export const startTrackingCronJob = (): void => {
  // Run every 6 hours: '0 */6 * * *'
  // This runs at minute 0 of every 6th hour (00:00, 06:00, 12:00, 18:00)
  const cronExpression = '0 */6 * * *';

  console.log('Starting tracking cron job (runs every 6 hours)...');

  cron.schedule(cronExpression, async () => {
    console.log(`[Cron] Running tracking update at ${new Date().toISOString()}`);
    await updateAllTrackings();
  });

  // Also run immediately on startup (optional - comment out if not desired)
  // updateAllTrackings().catch(console.error);
};

/**
 * Manually trigger tracking update (for testing or manual refresh)
 */
export const triggerTrackingUpdate = async (): Promise<void> => {
  await updateAllTrackings();
};

