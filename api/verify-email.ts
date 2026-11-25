// api/verify-email.ts
// Polar.sh License Key & Order Verification Endpoint for Kibo Founders Edition
import type { VercelRequest, VercelResponse } from '@vercel/node';

const FOUNDER_TEST_CODES = new Set([
  'FOUNDER-2026',
  'FOUNDER2026',
  'KIBO-FOUNDER',
  'BETA-FOUNDER',
  'KIBO-2026',
  'FOUNDER-VIP',
  'FOUNDER21921',
  'FOUNDER-21921',
  'KIBO-VIP',
]);

async function resolvePolarOrganizationId(accessToken?: string): Promise<string> {
  const envOrgId = String(process.env.POLAR_ORGANIZATION_ID || '').trim();
  if (envOrgId) return envOrgId;
  if (!accessToken) return '';

  try {
    const res = await fetch('https://api.polar.sh/v1/organizations/?limit=5', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      const firstOrg = Array.isArray(data?.items) ? data.items[0] : null;
      if (firstOrg?.id) return String(firstOrg.id);
    }
  } catch (err) {
    console.warn('Could not resolve Polar organization id:', err);
  }
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
        ? req.body?.code || req.body?.licenseKey || req.body?.orderNumber
        : req.query?.code || req.query?.licenseKey || req.query?.orderNumber;

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
        error: 'Please enter your Kibo License Key (KIBO-...) or Order ID from your Polar confirmation email.',
      });
    }

    // 1. Authorized founder / VIP test keys
    if (FOUNDER_TEST_CODES.has(cleanCode)) {
      return res.status(200).json({
        verified: true,
        email: cleanEmail,
        licenseKey: cleanCode,
        customerName: cleanEmail.split('@')[0],
        tier: 'Founders Edition VIP',
      });
    }

    const polarToken = String(process.env.POLAR_ACCESS_TOKEN || '').trim();
    const polarOrgId = await resolvePolarOrganizationId(polarToken);

    if (!polarOrgId && !polarToken) {
      return res.status(200).json({
        verified: false,
        needsSetup: true,
        error:
          'Polar verification is not yet configured on the server. Add POLAR_ORGANIZATION_ID (and optional POLAR_ACCESS_TOKEN) in Vercel environment variables.',
      });
    }

    // 2. Polar Public Customer-Portal License Key Validation & Activation
    //    Works with just POLAR_ORGANIZATION_ID (no secret required), verifies KIBO-... keys live against Polar.
    if (polarOrgId) {
      try {
        const validateRes = await fetch('https://api.polar.sh/v1/customer-portal/license-keys/validate', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: cleanCode,
            organization_id: polarOrgId,
          }),
        });

        if (validateRes.ok) {
          const lic = await validateRes.json();
          const status = String(lic?.status || '').toLowerCase();
          const notExpired = !lic?.expires_at || new Date(lic.expires_at).getTime() > Date.now();

          if (status === 'granted' && notExpired) {
            const licEmail = String(
              lic?.customer?.email || lic?.user?.email || ''
            ).trim().toLowerCase();

            if (!licEmail || licEmail === cleanEmail) {
              // Best-effort device activation slot reservation (if activations are enabled on the benefit)
              let activationId: string | undefined;
              try {
                const actRes = await fetch('https://api.polar.sh/v1/customer-portal/license-keys/activate', {
                  method: 'POST',
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    key: cleanCode,
                    organization_id: polarOrgId,
                    label: `Kibo-${cleanEmail}`,
                  }),
                });
                if (actRes.ok) {
                  const actData = await actRes.json();
                  activationId = actData?.id ? String(actData.id) : undefined;
                }
              } catch {
                // Activation limit or non-activation key - validation already succeeded
              }

              return res.status(200).json({
                verified: true,
                email: cleanEmail,
                licenseKey: cleanCode,
                activationId,
                customerName:
                  lic?.customer?.name || lic?.user?.public_name || cleanEmail.split('@')[0],
                tier: 'Founders Edition License',
              });
            }

            return res.status(200).json({
              verified: false,
              error: 'That license key belongs to a different email address. Please enter the email used at checkout.',
            });
          }
        }
      } catch (licErr) {
        console.warn('Polar license key validation failed, checking orders fallback:', licErr);
      }
    }

    // 3. Polar Orders API Fallback (if buyer enters their Order ID / Invoice Number instead of License Key)
    if (polarToken) {
      try {
        const orderParams = new URLSearchParams({
          query: cleanEmail,
          limit: '25',
        });
        if (polarOrgId) orderParams.set('organization_id', polarOrgId);

        const ordersRes = await fetch(`https://api.polar.sh/v1/orders/?${orderParams.toString()}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${polarToken}`,
          },
        });

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          const items: any[] = Array.isArray(ordersData?.items) ? ordersData.items : [];

          const matchingOrder = items.find((o) => {
            const paid = o?.paid === true || String(o?.status || '').toLowerCase() === 'paid';
            if (!paid) return false;
            const orderEmail = String(o?.customer?.email || o?.email || '').trim().toLowerCase();
            if (orderEmail && orderEmail !== cleanEmail) return false;

            const orderId = String(o?.id || '').toUpperCase();
            const invoiceNum = String(o?.invoice_number || '').toUpperCase();
            return (
              cleanCode === orderId ||
              cleanCode === invoiceNum ||
              (invoiceNum && invoiceNum.endsWith(cleanCode)) ||
              (orderId && orderId.startsWith(cleanCode) && cleanCode.length >= 8)
            );
          });

          if (matchingOrder) {
            return res.status(200).json({
              verified: true,
              email: cleanEmail,
              orderId: matchingOrder.id,
              orderNumber: matchingOrder.invoice_number || matchingOrder.id,
              customerName: matchingOrder?.customer?.name || cleanEmail.split('@')[0],
              tier: 'Founders Edition Order',
            });
          }

          const hasPaidOrderForEmail = items.some((o) => {
            const paid = o?.paid === true || String(o?.status || '').toLowerCase() === 'paid';
            const orderEmail = String(o?.customer?.email || o?.email || '').trim().toLowerCase();
            return paid && orderEmail === cleanEmail;
          });

          if (hasPaidOrderForEmail) {
            return res.status(200).json({
              verified: false,
              error:
                'We found a Kibo order for this email, but that key did not match. Please paste your KIBO-... license key from your Polar receipt.',
            });
          }
        }
      } catch (ordErr) {
        console.warn('Polar orders API check failed:', ordErr);
      }
    }

    return res.status(200).json({
      verified: false,
      error:
        'This license key is not eligible or was not recognized. Please check your Polar purchase confirmation email for your KIBO-... license key.',
    });
  } catch (err) {
    console.error('Error verifying Polar purchase:', err);
    return res.status(500).json({
      verified: false,
      error: 'Internal verification error. Please try again shortly.',
    });
  }
}
