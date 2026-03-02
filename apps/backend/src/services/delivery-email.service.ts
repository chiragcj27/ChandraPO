import { Resend } from 'resend';
import * as XLSX from 'xlsx';

/**
 * Send delivery notification email to 2 recipients when a shipment is marked delivered.
 * Uses Resend transactional email service.
 *
 * Required env:
 *   RESEND_API_KEY - Resend API key
 *   DELIVERY_NOTIFY_EMAILS - Comma-separated recipient emails (takes precedence)
 *
 *   (Deprecated / fallback)
 *   DELIVERY_NOTIFY_EMAIL_1 - First recipient email
 *   DELIVERY_NOTIFY_EMAIL_2 - Second recipient email
 *
 * Optional:
 *   RESEND_FROM_EMAIL - From email address (must be verified in Resend; falls back to GMAIL_USER)
 *   SMTP_FROM_NAME - Sender display name (default: Chandra Jewels Shipping)
 */
export async function sendDeliveryNotificationEmail(params: {
  trackingId: string;
  provider?: string;
  latestStatus?: string;
  clientName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const rawEmails = process.env.DELIVERY_NOTIFY_EMAILS;

  let recipients: string[] = [];

  if (rawEmails && rawEmails.trim().length > 0) {
    recipients = rawEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  } else {
    const email1 = process.env.DELIVERY_NOTIFY_EMAIL_1;
    const email2 = process.env.DELIVERY_NOTIFY_EMAIL_2;

    recipients = [email1, email2].filter(
      (e): e is string => typeof e === 'string' && e.trim().length > 0
    );
  }

  if (recipients.length === 0) {
    console.warn(
      '[DeliveryEmail] No recipient emails (DELIVERY_NOTIFY_EMAILS or DELIVERY_NOTIFY_EMAIL_1/2), skipping'
    );
    return { success: false, error: 'No recipient emails configured' };
  }

  if (!resendApiKey) {
    console.warn(
      '[DeliveryEmail] RESEND_API_KEY not set, skipping delivery notification'
    );
    return { success: false, error: 'Resend not configured (RESEND_API_KEY)' };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.GMAIL_USER;
  if (!fromEmail) {
    console.warn(
      '[DeliveryEmail] RESEND_FROM_EMAIL (or fallback GMAIL_USER) not set, skipping delivery notification'
    );
    return { success: false, error: 'No from email configured (RESEND_FROM_EMAIL / GMAIL_USER)' };
  }

  try {
    const resend = new Resend(resendApiKey);
    const { trackingId, provider = 'Malca-Amit', latestStatus = 'Delivered', clientName } = params;
    const fromName = process.env.SMTP_FROM_NAME || 'Chandra Jewels Shipping';

    const subject = clientName
      ? `Shipment Delivered – ${clientName} (${trackingId})`
      : `Shipment Delivered – Tracking ID: ${trackingId}`;
    const clientLine = clientName
      ? `<li><strong>Client:</strong> ${clientName}</li>`
      : '';
    const html = `
      <h2>Shipment marked as delivered</h2>
      <p>A shipment has been marked as delivered.</p>
      <ul>
        ${clientLine}
        <li><strong>Tracking ID:</strong> ${trackingId}</li>
        <li><strong>Provider:</strong> ${provider}</li>
        <li><strong>Status:</strong> ${latestStatus}</li>
      </ul>
      <p>This is an automated notification from Chandra Jewels Shipment Tracking System.</p>
    `;

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: recipients,
      subject,
      html,
    });

    if (error) {
      console.error('[DeliveryEmail] Resend error:', error);
      return {
        success: false,
        error: (error as { message?: string }).message ?? 'Failed to send via Resend',
      };
    }

    console.log(
      `[DeliveryEmail] Delivered notification sent for ${trackingId} to ${recipients.join(', ')}`
    );
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[DeliveryEmail] Failed to send:', err);
    return { success: false, error: message };
  }
}

export async function sendActiveShipmentStatusReportEmail(params: {
  shipments: {
    trackingId: string;
    clientName?: string;
    latestStatus: string;
  }[];
  runAt?: Date;
}): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const rawEmails = process.env.DELIVERY_NOTIFY_EMAILS;

  let recipients: string[] = [];

  if (rawEmails && rawEmails.trim().length > 0) {
    recipients = rawEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  } else {
    const email1 = process.env.DELIVERY_NOTIFY_EMAIL_1;
    const email2 = process.env.DELIVERY_NOTIFY_EMAIL_2;

    recipients = [email1, email2].filter(
      (e): e is string => typeof e === 'string' && e.trim().length > 0
    );
  }

  if (recipients.length === 0) {
    console.warn(
      '[DeliveryEmail] No recipient emails (DELIVERY_NOTIFY_EMAILS or DELIVERY_NOTIFY_EMAIL_1/2), skipping daily report'
    );
    return { success: false, error: 'No recipient emails configured' };
  }

  if (!resendApiKey) {
    console.warn(
      '[DeliveryEmail] RESEND_API_KEY not set, skipping daily report email'
    );
    return { success: false, error: 'Resend not configured (RESEND_API_KEY)' };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.GMAIL_USER;
  if (!fromEmail) {
    console.warn(
      '[DeliveryEmail] RESEND_FROM_EMAIL (or fallback GMAIL_USER) not set, skipping daily report email'
    );
    return { success: false, error: 'No from email configured (RESEND_FROM_EMAIL / GMAIL_USER)' };
  }

  try {
    const resend = new Resend(resendApiKey);
    const fromName = process.env.SMTP_FROM_NAME || 'Chandra Jewels Shipping';
    const runAt = params.runAt ?? new Date();

    const rows =
      params.shipments.length > 0
        ? params.shipments.map((shipment, index) => ({
            '#': index + 1,
            'Tracking ID': shipment.trackingId,
            'Client Name': shipment.clientName ?? '',
            'Latest Status': shipment.latestStatus,
          }))
        : [
            {
              Message: `No active shipments as of ${runAt.toISOString()}`,
            },
          ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Active Shipments');

    const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const timestampForFilename = runAt.toISOString().replace(/[:.]/g, '-');
    const filename = `active-shipments-${timestampForFilename}.xlsx`;

    const subject = 'Active Shipment Status Report';
    const countLine =
      params.shipments.length > 0
        ? `<p>Total active shipments: <strong>${params.shipments.length}</strong></p>`
        : '<p>There are currently no active shipments.</p>';

    const html = `
      <h2>Active Shipment Status Report</h2>
      <p>Attached is the latest report of active shipments.</p>
      ${countLine}
      <p>Generated at: ${runAt.toISOString()}</p>
      <p>This is an automated notification from Chandra Jewels Shipment Tracking System.</p>
    `;

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: recipients,
      subject,
      html,
      attachments: [
        {
          filename,
          content: fileBuffer,
        },
      ],
    });

    if (error) {
      console.error('[DeliveryEmail] Resend error (daily report):', error);
      return {
        success: false,
        error: (error as { message?: string }).message ?? 'Failed to send via Resend (daily report)',
      };
    }

    console.log(
      `[DeliveryEmail] Daily active shipment report sent to ${recipients.join(
        ', '
      )} with ${params.shipments.length} rows`
    );
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[DeliveryEmail] Failed to send daily report:', err);
    return { success: false, error: message };
  }
}
