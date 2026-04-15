import { Request, Response } from 'express';
import type { MetaWebhookPayload } from '../types';
import { processMetaWebhookPayload, verifyMetaWebhook } from '../service/metaLead.service';

export const verifyMetaLeadWebhook = (req: Request, res: Response): void => {
  const challenge = verifyMetaWebhook(
    req.query['hub.mode'] as string | undefined,
    req.query['hub.verify_token'] as string | undefined,
    req.query['hub.challenge'] as string | undefined
  );

  if (!challenge) {
    res.status(403).send('Forbidden');
    return;
  }

  res.status(200).send(challenge);
};

export const receiveMetaLeadWebhook = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as MetaWebhookPayload;

  if (!payload || !Array.isArray(payload.entry)) {
    res.status(400).json({
      success: false,
      message: 'Invalid Meta webhook payload',
    });
    return;
  }

  try {
    const result = await processMetaWebhookPayload(payload);
    const message = result.errors.length > 0
      ? 'Meta webhook accepted with processing errors'
      : 'Meta webhook accepted';

    res.status(200).json({
      success: true,
      message,
      data: {
        created: result.created,
        updated: result.updated,
        duplicate: result.duplicate,
        ignored: result.ignored,
        processingErrors: result.errors,
      },
    });
  } catch (error) {
    console.error('Meta webhook handling error:', error);
    res.status(200).json({
      success: true,
      message: 'Meta webhook accepted',
      data: {
        created: 0,
        updated: 0,
        duplicate: 0,
        ignored: 0,
        processingErrors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      },
    });
  }
};
