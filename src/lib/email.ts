import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.RESEND_FROM_EMAIL ?? 'LocalPulse <noreply@localpulse.de>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    // Dev fallback — log to console
    console.log(`\n📧 [EMAIL – no RESEND_API_KEY set]\nTo: ${to}\nSubject: ${subject}\n`);
    console.log(
      html
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    );
    console.log('─'.repeat(60));
    return;
  }

  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    // Non-fatal — log and continue so the action still succeeds
    console.error('[Resend error]', error);
  }
}

/* ─── Magic link ─── */

export async function sendMagicLinkEmail(
  to: string,
  token: string,
  communityName: string,
): Promise<void> {
  const verifyUrl = `${APP_URL}/organizer/verify?token=${token}`;

  await sendEmail(
    to,
    'Your LocalPulse organizer login link',
    `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-top:0">Organizer access for ${communityName}</h2>
  <p>Click the button below to log in to your LocalPulse organizer dashboard.</p>
  <p style="margin:28px 0">
    <a href="${verifyUrl}"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
      Open organizer dashboard →
    </a>
  </p>
  <p style="font-size:13px;color:#666">This link expires in 24 hours and can only be used once.</p>
  <p style="font-size:13px;color:#666">If you didn't request this, you can safely ignore it.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#999">LocalPulse · Indian community discovery in Germany</p>
</body>
</html>
`,
  );
}

/* ─── Admin magic link ─── */

export async function sendAdminMagicLinkEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${APP_URL}/admin/verify?token=${token}`;

  await sendEmail(
    to,
    'Your LocalPulse admin login link',
    `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-top:0">Admin Dashboard Access</h2>
  <p>Click the button below to log in to the LocalPulse admin dashboard.</p>
  <p style="margin:28px 0">
    <a href="${verifyUrl}"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
      Open admin dashboard →
    </a>
  </p>
  <p style="font-size:13px;color:#666">This link expires in 24 hours and can only be used once.</p>
  <p style="font-size:13px;color:#666">If you didn't request this, you can safely ignore it.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#999">LocalPulse · Indian community discovery in Germany</p>
</body>
</html>
`,
  );
}

/* ─── Claim approved ─── */

export async function sendClaimApprovedEmail(
  to: string,
  communityName: string,
  citySlug: string,
  communitySlug: string,
): Promise<void> {
  const communityUrl = `${APP_URL}/${citySlug}/communities/${communitySlug}`;
  const dashboardUrl = `${APP_URL}/organizer`;

  await sendEmail(
    to,
    `Your claim for "${communityName}" has been approved`,
    `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-top:0">You're now the organizer of ${communityName}!</h2>
  <p>Your ownership claim has been reviewed and approved. Your community now displays a <strong>Verified</strong> badge on LocalPulse.</p>
  <p>You can now:</p>
  <ul style="line-height:1.7">
    <li>Edit your community profile (description, logo, channels)</li>
    <li>Post upcoming events</li>
    <li>Manage access links</li>
  </ul>
  <p style="margin:28px 0">
    <a href="${dashboardUrl}"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
      Go to your dashboard →
    </a>
  </p>
  <p style="font-size:13px">
    <a href="${communityUrl}" style="color:#4f46e5">View your public community page →</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#999">LocalPulse · Indian community discovery in Germany</p>
</body>
</html>
`,
  );
}

/* ─── Claim rejected ─── */

export async function sendClaimRejectedEmail(to: string, communityName: string): Promise<void> {
  await sendEmail(
    to,
    `Update on your claim for "${communityName}"`,
    `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-top:0">Claim update: ${communityName}</h2>
  <p>We reviewed your ownership claim for <strong>${communityName}</strong> and were unable to approve it based on the information provided.</p>
  <p>If you believe this is a mistake or can provide additional proof of ownership, please reply to this email or re-submit the claim with more details.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#999">LocalPulse · Indian community discovery in Germany</p>
</body>
</html>
`,
  );
}

/* ─── Submission received ─── */

export async function sendSubmissionReceivedEmail(
  to: string,
  submitterName: string,
  communityName: string,
): Promise<void> {
  await sendEmail(
    to,
    `We received your submission: "${communityName}"`,
    `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-top:0">Thanks, ${submitterName}!</h2>
  <p>We've received your submission for <strong>${communityName}</strong> and will review it within 1–2 business days.</p>
  <p>Once approved, your community will appear on LocalPulse. We'll email you when it's live.</p>
  <p style="font-size:13px;color:#666">If you have any questions in the meantime, reply to this email.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#999">LocalPulse · Indian community discovery in Germany</p>
</body>
</html>
`,
  );
}

/* ─── Submission approved ─── */

export async function sendSubmissionApprovedEmail(
  to: string,
  submitterName: string,
  communityName: string,
  citySlug: string,
  communitySlug: string,
): Promise<void> {
  const communityUrl = `${APP_URL}/${citySlug}/communities/${communitySlug}`;

  await sendEmail(
    to,
    `"${communityName}" is now live on LocalPulse!`,
    `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-top:0">Your community is live, ${submitterName}!</h2>
  <p><strong>${communityName}</strong> is now published on LocalPulse and discoverable by the Indian diaspora in your city.</p>
  <p style="margin:28px 0">
    <a href="${communityUrl}"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
      View your community page →
    </a>
  </p>
  <p style="font-size:13px">Want to manage your listing, add events, and earn a Verified badge? 
    <a href="${APP_URL}/${citySlug}/communities/${communitySlug}" style="color:#4f46e5">Claim your community →</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#999">LocalPulse · Indian community discovery in Germany</p>
</body>
</html>
`,
  );
}

export async function sendStaleReEngagementEmail(
  to: string,
  organizerName: string,
  communityName: string,
  loginUrl: string,
): Promise<void> {
  await sendEmail(
    to,
    `Is ${communityName} still active?`,
    `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-top:0">Hey ${organizerName},</h2>
  <p>We noticed <strong>${communityName}</strong> hasn't had any activity on LocalPulse in a while.</p>
  <p>If your community is still active, just update your listing or add an upcoming event to keep it visible in search results.</p>
  <p style="margin:28px 0">
    <a href="${loginUrl}"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
      Open organizer dashboard →
    </a>
  </p>
  <p style="font-size:13px;color:#666">Communities without activity for 180+ days are automatically moved to inactive status.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#999">LocalPulse · Indian community discovery in Germany</p>
</body>
</html>
`,
  );
}
