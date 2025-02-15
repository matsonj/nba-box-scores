import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Security headers
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  try {
    const token = process.env.MOTHERDUCK_TOKEN;
    if (!token) throw new Error('MOTHERDUCK_TOKEN not configured');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({ token });
  } catch (error) {
    console.error('Token API error:', error);
    res.status(500).json({ error: 'Failed to retrieve database credentials' });
  }
}
