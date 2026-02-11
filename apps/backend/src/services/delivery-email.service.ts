import { Resend } from 'resend';

const SENDER_EMAIL = 'shipping@chandrajewels.com';
const SENDER_NAME = 'Chandra Jewels Shipping';

/**
 * Send delivery notification email to 2 recipients when a shipment is marked delivered.
 *
 * Required env:
 *   RESEND_API_KEY - Resend API key (from resend.com)
 *   RESEND_DELIVERY_NOTIFY_EMAIL_1 - First recipient email
 *   RESEND_DELIVERY_NOTIFY_EMAIL_2 - Second recipient email
 *
 * Sender is shipping@chandrajewels.com (domain must be verified in Resend).
 */
export async function sendDeliveryNotificationEmail(params: {
  trackingId: string;
  provider?: string;
  latestStatus?: string;
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const email1 = process.env.RESEND_DELIVERY_NOTIFY_EMAIL_1;
  const email2 = process.env.RESEND_DELIVERY_NOTIFY_EMAIL_2;

  const recipients: string[] = [email1, email2].filter(
    (e): e is string => typeof e === 'string' && e.trim().length > 0
  );

  if (!apiKey) {
    console.warn('[DeliveryEmail] RESEND_API_KEY not set, skipping delivery notification');
    return { success: false, error: 'RESEND_API_KEY not set' };
  }

  if (recipients.length === 0) {
    console.warn(
      '[DeliveryEmail] No recipient emails (RESEND_DELIVERY_NOTIFY_EMAIL_1, RESEND_DELIVERY_NOTIFY_EMAIL_2), skipping'
    );
    return { success: false, error: 'No recipient emails configured' };
  }

  try {
    const resend = new Resend(apiKey);
    const { trackingId, provider = 'Malca-Amit', latestStatus = 'Delivered' } = params;

    const subject = `Shipment Delivered – Tracking ID: ${trackingId}`;
    const html = `
      <h2>Shipment marked as delivered</h2>
      <p>A shipment has been marked as delivered.</p>
      <ul>
        <li><strong>Tracking ID:</strong> ${trackingId}</li>
        <li><strong>Provider:</strong> ${provider}</li>
        <li><strong>Status:</strong> ${latestStatus}</li>
      </ul>
      <p>This is an automated notification from Chandra Jewels.</p>
    `;

    const { error } = await resend.emails.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: recipients,
      subject,
      html,
    });

    if (error) {
      console.error('[DeliveryEmail] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[DeliveryEmail] Delivered notification sent for ${trackingId} to ${recipients.join(', ')}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[DeliveryEmail] Failed to send:', err);
    return { success: false, error: message };
  }
}
