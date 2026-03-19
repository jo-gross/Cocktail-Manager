import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../prisma/prisma';

/**
 * Demo Login API Endpoint
 *
 * This endpoint allows demo users (users without email addresses) to log in
 * when DEMO_MODE is enabled. It creates a session directly for the demo user.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Check if demo mode is enabled
  if (process.env.DEMO_MODE !== 'true') {
    return res.status(404).json({ message: 'Demo mode is not enabled' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }

  try {
    // Find the demo user (users without email)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Verify this is a demo user (no email)
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (user.email) {
      return res.status(403).json({ message: 'This is not a demo user' });
    }

    // Create a session token
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create session in database
    const session = await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        token: sessionToken,
        userId: user.id,
        expiresAt: expiresAt,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    // Set the session cookie
    // BetterAuth uses 'better-auth.session_token' as the cookie name by default
    const cookieName = 'better-auth.session_token';
    const isSecure = process.env.NODE_ENV === 'production';
    const cookieValue = `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${isSecure ? '; Secure' : ''}`;

    res.setHeader('Set-Cookie', cookieValue);

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error('Demo login error:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return res.status(500).json({ message: 'Internal server error', error: String(error) });
  }
}
