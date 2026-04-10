import { Response } from 'express';

export const sendError = (
  res: Response,
  error: any,
  defaultStatusCode = 400
) => {
  const statusCode =
    typeof error?.statusCode === 'number'
      ? error.statusCode
      : defaultStatusCode;

  return res.status(statusCode).json({
    success: false,
    message: error?.message || 'Something went wrong',
    details: error?.details ?? null
  });
};
