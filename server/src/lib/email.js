// Minimal email sender via the Resend HTTP API - no SDK dependency, just fetch.
// Silently no-ops when RESEND_API_KEY isn't configured, so the app works without it
// (the suggestion is still saved; only the email notification is skipped).
async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email skipped - no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.error(`Failed to send email: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error('Failed to send email', err);
  }
}

module.exports = { sendEmail };
