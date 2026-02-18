import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { Tracking, TrackingStatus } from '@repo/db';
import { malcaAmitService } from '../services/malca-amit.service';
import { sendDeliveryNotificationEmail } from '../services/delivery-email.service';

interface ExcelRow {
  trackingId?: string;
  provider?: string;
  clientName?: string;
  'Tracking ID'?: string;
  'Provider'?: string;
  'Client Name'?: string;
  'tracking id'?: string;
  'client name'?: string;
  [key: string]: any;
}

/**
 * Parse Excel file and extract tracking IDs and providers
 */
const parseExcelFile = (buffer: Buffer): Array<{ trackingId: string; provider: string; clientName?: string }> => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

  const trackingData: Array<{ trackingId: string; provider: string; clientName?: string }> = [];

  for (const row of data) {
    // Try different column name variations
    const trackingId =
      row.trackingId ||
      row['Tracking ID'] ||
      row['tracking id'] ||
      row['TrackingId'] ||
      row['TRACKING_ID'] ||
      '';

    const provider =
      row.provider ||
      row.Provider ||
      row['provider'] ||
      row['Provider'] ||
      row['PROVIDER'] ||
      'Malca-Amit'; // Default provider

    const clientName =
      row.clientName ||
      row['Client Name'] ||
      row['client name'] ||
      row['ClientName'] ||
      row['CLIENT_NAME'] ||
      '';

    if (trackingId && trackingId.toString().trim()) {
      trackingData.push({
        trackingId: trackingId.toString().trim(),
        provider: provider.toString().trim() || 'Malca-Amit',
        clientName: clientName ? String(clientName).trim() : undefined,
      });
    }
  }

  return trackingData;
};

/**
 * Fetch tracking status from API and update database
 */
const fetchAndUpdateTracking = async (
  trackingId: string,
  provider: string
): Promise<{ latestStatus: string; statusHistory: TrackingStatus[]; deliveryDate?: Date }> => {
  try {
    // For now, we only support Malca-Amit
    // In the future, you can add other providers here
    if (provider.toLowerCase().includes('malca') || provider.toLowerCase().includes('amit')) {
      const statusHistory = await malcaAmitService.getTracking(trackingId);
      
      if (statusHistory.length === 0) {
        return {
          latestStatus: 'Not Found',
          statusHistory: [],
        };
      }

      return {
        latestStatus: statusHistory[0].status,
        statusHistory,
        deliveryDate: (statusHistory as any).deliveryDate,
      };
    } else {
      // Unknown provider - return default
      return {
        latestStatus: 'Unknown Provider',
        statusHistory: [],
      };
    }
  } catch (error: any) {
    console.error(`Error fetching tracking for ${trackingId}:`, error);
    return {
      latestStatus: 'Error',
      statusHistory: [],
    };
  }
};

/**
 * Upload Excel file with tracking IDs
 */
export const uploadTrackingExcel = async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse Excel file
    const trackingData = parseExcelFile(file.buffer);

    if (trackingData.length === 0) {
      return res.status(400).json({ message: 'No tracking IDs found in Excel file' });
    }

    const results = {
      added: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each tracking ID
    for (const { trackingId, provider, clientName } of trackingData) {
      try {
        // Check if tracking already exists
        const existing = await Tracking.findOne({ trackingId });
        if (existing) {
          results.skipped++;
          continue;
        }

        // Fetch initial status from API
        const { latestStatus, statusHistory, deliveryDate } = await fetchAndUpdateTracking(trackingId, provider);

        // Determine if tracking should be active
        const isActive = latestStatus.toLowerCase() !== 'delivered';

        // Create new tracking record
        await Tracking.create({
          trackingId,
          provider,
          clientName: clientName || undefined,
          latestStatus,
          statusHistory,
          isActive,
          lastUpdated: new Date(),
          deliveryDate,
        });

        // Notify when shipment is already delivered (e.g. from Excel upload)
        if (latestStatus.toLowerCase() === 'delivered') {
          sendDeliveryNotificationEmail({ trackingId, provider, latestStatus }).catch((err) =>
            console.error(`[Tracking] Delivery email failed for ${trackingId}:`, err)
          );
        }

        results.added++;
      } catch (error: any) {
        console.error(`Error processing tracking ${trackingId}:`, error);
        results.errors.push(`${trackingId}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: 'Tracking IDs processed',
      results,
    });
  } catch (error: any) {
    console.error('Error uploading tracking Excel:', error);
    res.status(500).json({ message: 'Failed to process Excel file', error: error.message });
  }
};

/**
 * Get all tracking records
 */
export const getAllTrackings = async (req: Request, res: Response) => {
  try {
    const trackings = await Tracking.find()
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      trackings: trackings.map((t: any) => ({
        id: t._id,
        trackingId: t.trackingId,
        provider: t.provider,
        clientName: t.clientName,
        latestStatus: t.latestStatus,
        statusHistory: t.statusHistory || [], // Include status history
        isActive: t.isActive,
        lastUpdated: t.lastUpdated,
        deliveryDate: t.deliveryDate, // Include delivery date
        createdAt: t.createdAt || t._id?.getTimestamp?.() || new Date(),
        updatedAt: t.updatedAt || t._id?.getTimestamp?.() || new Date(),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching trackings:', error);
    res.status(500).json({ message: 'Failed to fetch trackings', error: error.message });
  }
};

/**
 * Get tracking details with full status history
 */
export const getTrackingDetails = async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;

    const tracking = await Tracking.findOne({ trackingId }).lean();

    if (!tracking) {
      return res.status(404).json({ message: 'Tracking not found' });
    }

    res.status(200).json({
      id: tracking._id,
      trackingId: tracking.trackingId,
      provider: tracking.provider,
      clientName: (tracking as any).clientName,
      latestStatus: tracking.latestStatus,
      statusHistory: tracking.statusHistory,
      isActive: tracking.isActive,
      lastUpdated: tracking.lastUpdated,
      deliveryDate: (tracking as any).deliveryDate,
      createdAt: (tracking as any).createdAt || new Date(),
      updatedAt: (tracking as any).updatedAt || new Date(),
    });
  } catch (error: any) {
    console.error('Error fetching tracking details:', error);
    res.status(500).json({ message: 'Failed to fetch tracking details', error: error.message });
  }
};

/**
 * Manually refresh tracking status
 */
export const refreshTracking = async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;

    const tracking = await Tracking.findOne({ trackingId });

    if (!tracking) {
      return res.status(404).json({ message: 'Tracking not found' });
    }

    // Fetch latest status
    const { latestStatus, statusHistory, deliveryDate } = await fetchAndUpdateTracking(
      tracking.trackingId,
      tracking.provider
    );

    const wasDeliveredBefore = tracking.latestStatus.toLowerCase().includes('delivered');
    const isNowDelivered = latestStatus.toLowerCase().includes('delivered');

    // Update tracking record
    const isActive = !isNowDelivered;

    tracking.latestStatus = latestStatus;
    tracking.statusHistory = statusHistory;
    tracking.isActive = isActive;
    tracking.lastUpdated = new Date();
    if (deliveryDate) {
      (tracking as any).deliveryDate = deliveryDate;
    }

    await tracking.save();

    // Notify when status just changed to delivered
    if (!wasDeliveredBefore && isNowDelivered) {
      sendDeliveryNotificationEmail({
        trackingId: tracking.trackingId,
        provider: tracking.provider,
        latestStatus,
      }).catch((err) =>
        console.error(`[Tracking] Delivery email failed for ${tracking.trackingId}:`, err)
      );
    }

    res.status(200).json({
      message: 'Tracking refreshed successfully',
      tracking: {
        id: tracking._id,
        trackingId: tracking.trackingId,
        provider: tracking.provider,
        clientName: (tracking as any).clientName,
        latestStatus: tracking.latestStatus,
        statusHistory: tracking.statusHistory,
        isActive: tracking.isActive,
        lastUpdated: tracking.lastUpdated,
        deliveryDate: (tracking as any).deliveryDate,
      },
    });
  } catch (error: any) {
    console.error('Error refreshing tracking:', error);
    res.status(500).json({ message: 'Failed to refresh tracking', error: error.message });
  }
};

/**
 * Delete a tracking record
 */
export const deleteTracking = async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;

    const tracking = await Tracking.findOneAndDelete({ trackingId });

    if (!tracking) {
      return res.status(404).json({ message: 'Tracking not found' });
    }

    res.status(200).json({
      message: 'Tracking deleted successfully',
      deletedTracking: {
        id: tracking._id,
        trackingId: tracking.trackingId,
        provider: tracking.provider,
        clientName: (tracking as any).clientName,
      },
    });
  } catch (error: any) {
    console.error('Error deleting tracking:', error);
    res.status(500).json({ message: 'Failed to delete tracking', error: error.message });
  }
};

export default {
  uploadTrackingExcel,
  getAllTrackings,
  getTrackingDetails,
  refreshTracking,
  deleteTracking,
};

