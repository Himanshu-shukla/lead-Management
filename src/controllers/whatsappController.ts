import { Request, Response } from 'express';
import type { WhatsAppWebhookPayload } from '../types';
import { processWhatsAppWebhookPayload } from '../service/leadAutomation.service';

export const verifyWhatsAppWebhook = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken || mode !== 'subscribe' || !token || token !== verifyToken || !challenge) {
    res.status(403).send('Forbidden');
    return;
  }

  res.status(200).send(challenge);
};

export const receiveWhatsAppWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body as WhatsAppWebhookPayload;
    const result = await processWhatsAppWebhookPayload(payload);

    res.status(200).json({
      success: true,
      message: 'WhatsApp webhook processed',
      data: result,
    });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(200).json({
      success: true,
      message: 'WhatsApp webhook accepted',
      data: {
        processed: 0,
        ignored: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      },
    });
  }
};
