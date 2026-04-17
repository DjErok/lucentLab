import { Resend } from 'resend';

// Vercel serverless function: POST /api/feedback
// Body shape: { category, message, from?, page?, ua? }
// Sends a tagged email to the maintainer via Resend.

const TO_ADDRESS = 'ericcao1010@gmail.com';
const FROM_ADDRESS = 'Lucent Lab Feedback <onboarding@resend.dev>';
const SUBJECT_TAG = '[Lucent Lab Feedback]';

type FeedbackPayload = {
  category?: string;
  categoryLabel?: string;
  message?: string;
  from?: string;
  page?: string;
  ua?: string;
};

// Vercel exports a default handler. Works in both Node runtime and Vite middleware.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Email service not configured' });
    return;
  }

  // Vercel auto-parses JSON bodies; in Vite middleware we hand-parse.
  let body: FeedbackPayload = req.body ?? {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const message = (body.message ?? '').trim();
  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const category = body.category ?? 'other';
  const categoryLabel = body.categoryLabel ?? category;
  const page = body.page ?? '(unknown)';
  const replyTo = (body.from ?? '').trim();
  const ua = body.ua ?? '';

  const subject = `${SUBJECT_TAG} [${categoryLabel}] ${page}`;

  // Plain-text + HTML for nice rendering
  const text = [
    message,
    '',
    '— — —',
    `Category: ${categoryLabel} (${category})`,
    `Page: ${page}`,
    replyTo ? `Reply to: ${replyTo}` : null,
    `Submitted: ${new Date().toISOString()}`,
    `User agent: ${ua}`,
  ].filter(Boolean).join('\n');

  const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px;">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin-bottom:8px;">
        ${escape(SUBJECT_TAG)} · ${escape(categoryLabel)}
      </div>
      <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.55;background:#f7f5ee;padding:14px;border-radius:6px;border:1px solid #e6e1d4;">${escape(message)}</pre>
      <table style="font-size:12px;color:#555;margin-top:14px;border-collapse:collapse;">
        <tr><td style="padding:3px 8px 3px 0;color:#888;">Category</td><td>${escape(categoryLabel)} (${escape(category)})</td></tr>
        <tr><td style="padding:3px 8px 3px 0;color:#888;">Page</td><td><code>${escape(page)}</code></td></tr>
        ${replyTo ? `<tr><td style="padding:3px 8px 3px 0;color:#888;">Reply to</td><td><a href="mailto:${escape(replyTo)}">${escape(replyTo)}</a></td></tr>` : ''}
        <tr><td style="padding:3px 8px 3px 0;color:#888;">Submitted</td><td>${new Date().toISOString()}</td></tr>
        <tr><td style="padding:3px 8px 3px 0;color:#888;vertical-align:top;">User agent</td><td style="color:#999;font-size:11px;">${escape(ua)}</td></tr>
      </table>
    </div>
  `;

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: TO_ADDRESS,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if ((result as any).error) {
      res.status(502).json({ error: (result as any).error.message ?? 'Resend error' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
}
