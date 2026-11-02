// api/verify-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const FOUNDER_TEST_CODES = new Set([
  'FOUNDER-2026',
  'KIBO-FOUNDER',
  'BETA-FOUNDER',
  'KIBO-2026',
  'FOUNDER-VIP',
]);

const OWNER_EMAILS = new Set([
  'raahimalavi2003@gmail.com',
  'alaviraahim@gmail.com',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawEmail = req.method === 'POST' ? req.body?.email : req.query?.email;
    const rawCode =
      req.method === 'POST'
        ? (req.body?.code || req.body?.licenseKey || req.body?.orderNumber)
        : (req.query?.code || req.query?.licenseKey || req.query?.orderNumber);

    const cleanEmail = String(rawEmail || '').trim().toLowerCase();
    const cleanCode = String(rawCode || '').trim().toUpperCase().replace(/^#/, '');

    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      return res.status(400).json({
        verified: false,
        error: 'Please enter a valid email address.',
      });
    }

    if (!cleanCode) {
      return res.status(400).json({
        verified: false,
        error: 'Please enter your Order Number or License Key from your purchase confirmation receipt.',
      });
    }

    // 1. Check for owner accounts or authorized founders test codes
    if (FOUNDER_TEST_CODES.has(cleanCode) || (OWNER_EMAILS.has(cleanEmail) && cleanCode.length >= 4)) {
      return res.status(200).json({
        verified: true,
        email: cleanEmail,
        licenseKey: cleanCode,
        customerName: cleanEmail.split('@')[0],
        tier: 'Founders Edition VIP',
      });
    }

    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

    // 2. If Lemon Squeezy API key is not yet configured on Vercel
    if (!apiKey) {
      return res.status(200).json({
        verified: false,
        needsSetup: true,
        error: 'Lemon Squeezy order verification is pending store review. For testing, use your Founders activation code.',
      });
    }

    // 3. Try Lemon Squeezy License Key activation endpoint
    try {
      const licenseRes = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          license_key: cleanCode,
          instance_name: `Kibo-${cleanEmail}`,
        }).toString(),
      });

      if (licenseRes.ok) {
        const licData = await licenseRes.json();
        if (licData.activated) {
          const licCustomerEmail = String(
            licData?.meta?.customer_email || licData?.license_key?.user_email || ''
          ).toLowerCase();

          // If email matches or was registered with this license
          if (!licCustomerEmail || licCustomerEmail === cleanEmail) {
            return res.status(200).json({
              verified: true,
              email: cleanEmail,
              licenseKey: cleanCode,
              customerName: licData?.meta?.customer_name || cleanEmail.split('@')[0],
              tier: 'Founders Edition License',
            });
          }
        }
      }
    } catch (licErr) {
      console.warn('License API check failed, falling back to orders check:', licErr);
    }

    // 4. Query Lemon Squeezy Orders API matching this email and order number / identifier
    const apiUrl = `https://api.lemonsqueezy.com/v1/orders?filter[user_email]=${encodeURIComponent(cleanEmail)}`;
    const lsResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!lsResponse.ok) {
      const errText = await lsResponse.text();
      console.error('Lemon Squeezy API error:', lsResponse.status, errText);
      return res.status(502).json({
        verified: false,
        error: 'Unable to connect to order verification service right now. Please try again.',
      });
    }

    const lsData = await lsResponse.json();
    const orders = lsData?.data || [];

    // Find any paid order that matches the code provided (order_number, id, or identifier)
    const matchingOrder = orders.find((o: any) => {
      const status = o?.attributes?.status?.toLowerCase();
      if (status !== 'paid' && status !== 'completed') return false;

      const orderAttr = o?.attributes || {};
      const orderNum = String(orderAttr.order_number || '');
      const orderId = String(o?.id || '');
      const orderIdentifier = String(orderAttr.identifier || '').toUpperCase();

      return (
        cleanCode === orderNum ||
        cleanCode === orderId ||
        cleanCode === orderIdentifier ||
        cleanCode.endsWith(orderNum)
      );
    });

    if (matchingOrder) {
      const orderAttr = matchingOrder.attributes || {};
      return res.status(200).json({
        verified: true,
        email: cleanEmail,
        orderId: matchingOrder.id,
        orderNumber: orderAttr.identifier || orderAttr.order_number,
        customerName: orderAttr.user_name || cleanEmail.split('@')[0],
        tier: 'Founders Edition Order',
      });
    }

    // If order was found for email but the code did not match
    const hasAnyOrder = orders.some((o: any) => {
      const status = o?.attributes?.status?.toLowerCase();
      return status === 'paid' || status === 'completed';
    });

    if (hasAnyOrder) {
      return res.status(200).json({
        verified: false,
        error: 'An order was found for this email, but the Order # or License Key did not match. Please verify your receipt.',
      });
    }

    return res.status(200).json({
      verified: false,
      error: `No paid order matching "${cleanEmail}" was found. Please check your purchase receipt or buy Founders Edition.`,
    });
  } catch (err: any) {
    console.error('Verify email handler error:', err);
    return res.status(500).json({
      verified: false,
      error: 'An unexpected verification error occurred. Please try again.',
    });
  }
}
