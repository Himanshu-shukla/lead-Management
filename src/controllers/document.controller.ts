// controllers/document.controller.ts
import { Request, Response } from 'express';

import mongoose from 'mongoose';
import { sendError } from '../utils/sendError';
import { DocumentService } from '../service/verification.service';

// Define the interface to exactly match the service's expectations
export interface DocumentFileData {
    documentType: string;
    documentName: string;
    fileUrl: string;
    fileKey: string;
    fileSize: number;
    mimeType: string;
    isMandatory: boolean;
    expiryDate?: Date | undefined; 
    notes?: string | undefined;    
}

/**
 * Upload document API - For development, accepts document number/link instead of actual file
 * POST /api/documents/upload
 */
export const uploadDocument = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return sendError(res, { 
        message: 'Unauthorized. Please login again.',
        statusCode: 401 
      });
    }

    // Extract fields from request body
    const { 
        documentType, 
        documentName, 
        documentNumber, 
        documentLink, 
        isMandatory, 
        expiryDate, 
        notes 
    } = req.body;

    // 1. Validate required fields
    if (!documentType) {
      return sendError(res, { 
        message: 'Document type is required',
        statusCode: 400 
      });
    }

    if (!documentNumber && !documentLink) {
      return sendError(res, { 
        message: 'Either document number or document link is required',
        statusCode: 400 
      });
    }

    // 2. Validate document type enum
    const validDocumentTypes = [
      'aadhar', 'pan', 'voter', 'passport', 'driving_license', 
      'education_certificate', 'experience_certificate', 'offer_letter',
      'appointment_letter', 'resignation_letter', 'relieving_letter',
      'salary_slip', 'bank_proof', 'other'
    ];

    if (!validDocumentTypes.includes(documentType)) {
      return sendError(res, { 
        message: `Invalid document type. Must be one of: ${validDocumentTypes.join(', ')}`,
        statusCode: 400 
      });
    }

    // 3. Prepare file data with strict Type Alignment
    // We explicitly handle the boolean conversion and the undefined types for TS strict mode
    const fileData: DocumentFileData = {
        documentType,
        documentName: documentName || `${documentType}_document`,
        fileUrl: documentLink || `https://dev-storage/${documentType}/${documentNumber}`,
        fileKey: documentNumber || `${documentType}_${Date.now()}`,
        fileSize: 0,
        mimeType: 'application/octet-stream',
        // Support both string 'true' from form-data or actual boolean from JSON
        isMandatory: isMandatory === 'true' || isMandatory === true,
        // Conversion logic: Date object or undefined (never null)
        expiryDate: expiryDate ? new Date(expiryDate as string) : undefined,
        notes: notes ? String(notes) : undefined
    };
      
    // 4. Call Service and Return Result
    const result = await DocumentService.uploadFile(userId, fileData);
    
    return res.status(201).json({
        success: true,
        message: 'Document processed successfully',
        data: result
    });
    
  } catch (error: any) {
    // 5. Centralized Error Handling
    console.error('Upload Document Error:', error);
    return sendError(res, error);
  }
};

/**
 * Verify document API (Admin only)
 * PATCH /api/documents/verify/:docId
 */
export const verifyDocument = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return sendError(res, { 
        message: 'Access denied. Only HR admins can verify documents.',
        statusCode: 403 
      });
    }

    const { docId } = req.params;
    const { status, rejectionReason } = req.body;
    const adminId = req.user.userId;

    // Validate document ID
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return sendError(res, { 
        message: 'Invalid document ID format',
        statusCode: 400 
      });
    }

    // Validate status
    if (!status || !['verified', 'rejected'].includes(status)) {
      return sendError(res, { 
        message: 'Invalid status. Must be either "verified" or "rejected"',
        statusCode: 400 
      });
    }

    // Validate rejection reason if status is rejected
    if (status === 'rejected' && !rejectionReason) {
      return sendError(res, { 
        message: 'Rejection reason is required when rejecting a document',
        statusCode: 400 
      });
    }

    const result = await DocumentService.verifyDoc(
      docId,
      status,
      adminId,
      rejectionReason
    );

    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Delete document API
 * DELETE /api/documents/:docId
 */
export const deleteDocument = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { docId } = req.params;
    const userId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';

    if (!userId) {
      return sendError(res, { 
        message: 'Unauthorized. Please login again.',
        statusCode: 401 
      });
    }

    // Validate document ID
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return sendError(res, { 
        message: 'Invalid document ID format',
        statusCode: 400 
      });
    }

    const result = await DocumentService.deleteDocument(docId, userId, isAdmin);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get all documents by user ID
 * GET /api/documents/user/:userId
 */
export const getUserDocuments = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';

    if (!userId) {
      return sendError(res, { 
        message: 'User ID is required',
        statusCode: 400 
      });
    }

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, { 
        message: 'Invalid user ID format',
        statusCode: 400 
      });
    }

    // Check authorization - users can only view their own documents, admins can view any
    if (!isAdmin && currentUserId !== userId) {
      return sendError(res, { 
        message: 'Access denied. You can only view your own documents.',
        statusCode: 403 
      });
    }

    const result = await DocumentService.getUserDocuments(userId);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get my documents (shortcut for current user)
 * GET /api/documents/me
 */
export const getMyDocuments = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return sendError(res, { 
        message: 'Unauthorized. Please login again.',
        statusCode: 401 
      });
    }

    const result = await DocumentService.getUserDocuments(userId);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get all pending verifications (Admin only)
 * GET /api/documents/pending-verifications
 */
export const getPendingVerifications = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (req.user?.role !== 'admin') {
      return sendError(res, { 
        message: 'Access denied. Only HR admins can view pending verifications.',
        statusCode: 403 
      });
    }

    const result = await DocumentService.getPendingVerifications();
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};