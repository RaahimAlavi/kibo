// api/verify-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      return res.status(400).json({
        verified: false,
        error: 'Please enter a valid email address.',
      });
    }

    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

    // If Lemon Squeezy API key is not yet configured in Vercel Environment Variables
    if (!apiKey) {
      // In development / demo mode before API key is linked:
      return res.status(200).json({
        verified: false,
        needsSetup: true,
        error: 'Lemon Squeezy API key is not configured in Vercel environment variables yet.',
      });
    }

    // Query Lemon Squeezy for orders matching this email
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

    // Find any order that has paid status
    const paidOrder = orders.find((o: any) => {
      const status = o?.attributes?.status?.toLowerCase();
      return status === 'paid' || status === 'completed';
    });

    if (paidOrder) {
      const orderAttr = paidOrder.attributes || {};
      return res.status(200).json({
        verified: true,
        email: cleanEmail,
        orderId: paidOrder.id,
        orderNumber: orderAttr.identifier || orderAttr.order_number,
        createdAt: orderAttr.created_at,
        customerName: orderAttr.user_name || cleanEmail.split('@')[0],
      });
    }

    // No paid order exists for this email
    return res.status(200).json({
      verified: false,
      error: `No active Founders Edition order was found for ${cleanEmail}. Please ensure you enter the exact email used during checkout.`,
    });
  } catch (err: any) {
    console.error('Verify email handler error:', err);
    return res.status(500).json({
      verified: false,
      error: 'An unexpected verification error occurred. Please try again.',
    });
  }
}
