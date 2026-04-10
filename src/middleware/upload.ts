import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

// Configure storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter for Excel files
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ];

  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  }
});

// Middleware for single file upload
export const uploadExcel = upload.single('file');

// Error handling middleware for multer
export const handleUploadError = (err: any, _req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          success: false,
          message: 'File too large',
          errors: ['File size cannot exceed 10MB']
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          success: false,
          message: 'Too many files',
          errors: ['Only one file can be uploaded at a time']
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          success: false,
          message: 'Unexpected file field',
          errors: ['File field name must be "file"']
        });
        return;
      default:
        res.status(400).json({
          success: false,
          message: 'File upload error',
          errors: [err.message]
        });
        return;
    }
  }

  if (err.message.includes('Invalid file type')) {
    res.status(400).json({
      success: false,
      message: 'Invalid file type',
      errors: [err.message]
    });
    return;
  }

  next(err);
};

// Middleware to validate file presence
export const validateFilePresence = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'No file uploaded',
      errors: ['Please select a file to upload']
    });
    return;
  }
  next();
};
