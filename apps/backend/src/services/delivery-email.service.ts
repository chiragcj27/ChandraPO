import nodemailer from 'nodemailer';

/**
 * Send delivery notification email to 2 recipients when a shipment is marked delivered.
 * Uses Gmail SMTP configured via a Google account (App Password required).
 *
 * Required env:
 *   GMAIL_USER - Gmail address (e.g. your@gmail.com)
 *   GMAIL_APP_PASSWORD - Google App Password (create at myaccount.google.com → Security → App passwords)
 *   DELIVERY_NOTIFY_EMAIL_1 - First recipient email
 *   DELIVERY_NOTIFY_EMAIL_2 - Second recipient email
 *
 * Optional:
 *   SMTP_FROM_NAME - Sender display name (default: Chandra Jewels Shipping)
 */
export async function sendDeliveryNotificationEmail(params: {
  trackingId: string;
  provider?: string;
  latestStatus?: string;
  clientName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  const email1 = process.env.DELIVERY_NOTIFY_EMAIL_1;
  const email2 = process.env.DELIVERY_NOTIFY_EMAIL_2;

  const recipients: string[] = [email1, email2].filter(
    (e): e is string => typeof e === 'string' && e.trim().length > 0
  );

  if (!gmailUser || !gmailAppPassword) {
    console.warn(
      '[DeliveryEmail] GMAIL_USER or GMAIL_APP_PASSWORD not set, skipping delivery notification'
    );
    return { success: false, error: 'Gmail not configured (GMAIL_USER, GMAIL_APP_PASSWORD)' };
  }

  if (recipients.length === 0) {
    console.warn(
      '[DeliveryEmail] No recipient emails (DELIVERY_NOTIFY_EMAIL_1, DELIVERY_NOTIFY_EMAIL_2), skipping'
    );
    return { success: false, error: 'No recipient emails configured' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

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

    await transporter.sendMail({
      from: `${fromName} <${gmailUser}>`,
      to: recipients.join(', '),
      subject,
      html,
    });

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
