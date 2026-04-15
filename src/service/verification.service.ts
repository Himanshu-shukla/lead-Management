// services/document.service.ts
import { EmployeeDocument } from '../models/EmployeeDocument.model';
import User from '../models/User';
import mongoose from 'mongoose';






export class UnauthorizedError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 403;
  }
}

// Types


// CUSTOM ERRORS (Ensure these are imported or defined)
export class ValidationError extends Error {
    statusCode = 400;
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  
  export class NotFoundError extends Error {
    statusCode = 404;
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }
// EXPORTED INTERFACE - This is the "Source of Truth"
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

export const DocumentService = {
  /**
   * Upload and process employee document
   */
  uploadFile: async (userId: string, fileData: DocumentFileData) => {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!fileData.documentType || !fileData.fileUrl || !fileData.documentName) {
        throw new ValidationError('Document type, file URL, and document name are required');
      }

      // Check if user exists
      const userExists = await User.findById(userId);
      if (!userExists) {
        throw new NotFoundError('User not found');
      }

      // Check for duplicate verified document of same type
      const existingDoc = await EmployeeDocument.findOne({
        user: userId,
        'documents.documentType': fileData.documentType,
        'documents.verificationStatus': 'verified'
      });

      if (existingDoc) {
        throw new ValidationError(`A verified ${fileData.documentType} document already exists. Please delete it first to re-upload.`);
      }

      // Find or create employee document record
      let employeeDoc = await EmployeeDocument.findOne({ user: userId });
      
      if (!employeeDoc) {
        const employeeId = `EMP${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        employeeDoc = new EmployeeDocument({
          user: new mongoose.Types.ObjectId(userId),
          documents: [],
          employmentDetails: {
            employeeId,
            joiningDate: new Date(),
            employmentType: 'probation',
            department: 'To be assigned',
            designation: 'To be assigned',
            workLocation: 'To be assigned',
            employmentHistory: []
          },
          bankDetails: {
            accountHolderName: '',
            bankName: '',
            accountNumber: '',
            ifscCode: '',
            panNumber: '',
            verificationStatus: 'pending'
          },
          emergencyContacts: []
        });
      }

      // 1. Prepare the object with normalized optional fields
      const newDocument = {
        documentType: fileData.documentType,
        documentName: fileData.documentName,
        fileUrl: fileData.fileUrl,
        fileKey: fileData.fileKey,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
        uploadedAt: new Date(),
        verificationStatus: 'pending' as const,
        isMandatory: fileData.isMandatory || false,
        expiryDate: fileData.expiryDate ?? undefined,
        notes: fileData.notes ?? undefined
      };

      // 2. FIX: Use 'as any' to push into Mongoose subdocument array
      // This bypasses TS(2379) exactOptionalPropertyTypes conflicts
      employeeDoc.documents.push(newDocument as any);
      
      await employeeDoc.save();

      const uploadedDoc = employeeDoc.documents[employeeDoc.documents.length - 1];

      return {
        success: true,
        message: 'Document uploaded successfully',
        data: {
          documentId: uploadedDoc._id,
          documentType: uploadedDoc.documentType,
          documentName: uploadedDoc.documentName,
          fileUrl: uploadedDoc.fileUrl,
          fileSize: uploadedDoc.fileSize,
          status: uploadedDoc.verificationStatus,
          uploadedAt: uploadedDoc.uploadedAt,
          isMandatory: uploadedDoc.isMandatory,
          expiryDate: uploadedDoc.expiryDate
        }
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      console.error('Error in uploadFile service:', error);
      throw new Error('Failed to upload document');
    }
  },


  /**
   * Verify a document (Admin only)
   */
  verifyDoc: async (docId: string, status: 'verified' | 'rejected', adminId: string, rejectionReason?: string) => {
    try {
      if (!docId || !status || !adminId) {
        throw new ValidationError('Document ID, status, and admin ID are required');
      }

      if (!mongoose.Types.ObjectId.isValid(docId) || !mongoose.Types.ObjectId.isValid(adminId)) {
        throw new ValidationError('Invalid ID format');
      }

      // Find the document
      const employeeDoc = await EmployeeDocument.findOne({
        'documents._id': docId
      }).populate('user', 'name email');

      if (!employeeDoc) {
        throw new NotFoundError('Document not found');
      }

      // Find the specific document in the array
      const documentIndex = employeeDoc.documents.findIndex(
        d => d._id && d._id.toString() === docId
      );

      if (documentIndex === -1) {
        throw new NotFoundError('Document not found in employee record');
      }

      const document = employeeDoc.documents[documentIndex];

      // Check if already verified
      if (document.verificationStatus === 'verified') {
        throw new ValidationError('Document is already verified');
      }

      // Update document status
      document.verificationStatus = status;
      document.verifiedBy = new mongoose.Types.ObjectId(adminId);
      document.verifiedAt = new Date();
      
      if (status === 'rejected' && rejectionReason) {
        document.rejectionReason = rejectionReason;
      }

      await employeeDoc.save();

      return {
        success: true,
        message: `Document ${status} successfully`,
        data: {
          documentId: document._id,
          documentType: document.documentType,
          documentName: document.documentName,
          status: document.verificationStatus,
          verifiedAt: document.verifiedAt,
          verifiedBy: adminId,
          rejectionReason: document.rejectionReason,
          employeeName: (employeeDoc.user as any)?.name,
          employeeEmail: (employeeDoc.user as any)?.email
        }
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete a document
   */
  deleteDocument: async (docId: string, userId: string, isAdmin: boolean) => {
    try {
      if (!docId) {
        throw new ValidationError('Document ID is required');
      }

      if (!mongoose.Types.ObjectId.isValid(docId)) {
        throw new ValidationError('Invalid document ID format');
      }

      // Find the document
      const employeeDoc = await EmployeeDocument.findOne({
        'documents._id': docId
      });

      if (!employeeDoc) {
        throw new NotFoundError('Document not found');
      }

      // Check authorization
      if (!isAdmin && employeeDoc.user.toString() !== userId) {
        throw new UnauthorizedError('You are not authorized to delete this document');
      }

      // Find the document index
      const documentIndex = employeeDoc.documents.findIndex(
        d => d._id && d._id.toString() === docId
      );

      if (documentIndex === -1) {
        throw new NotFoundError('Document not found in employee record');
      }

      const document = employeeDoc.documents[documentIndex];

      // Don't allow deletion of verified documents unless admin
      if (document.verificationStatus === 'verified' && !isAdmin) {
        throw new UnauthorizedError('Verified documents cannot be deleted. Please contact HR admin.');
      }

      // Get document info before deletion
      const docInfo = {
        documentId: document._id,
        documentName: document.documentName,
        documentType: document.documentType
      };

      // Remove the document
      employeeDoc.documents.splice(documentIndex, 1);
      await employeeDoc.save();

      return {
        success: true,
        message: 'Document deleted successfully',
        data: docInfo
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get all documents for a specific user
   */
  getUserDocuments: async (userId: string) => {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      // Find employee document record
      const employeeDoc = await EmployeeDocument.findOne({ user: userId })
        .populate('user', 'name email phone');

      if (!employeeDoc) {
        // Return empty array if no documents found
        return {
          success: true,
          message: 'No documents found for this user',
          data: {
            userId,
            documents: [],
            stats: {
              total: 0,
              verified: 0,
              pending: 0,
              rejected: 0
            }
          }
        };
      }

      // Format documents for response
      const documents = employeeDoc.documents.map(doc => ({
        id: doc._id,
        documentType: doc.documentType,
        documentName: doc.documentName,
        fileUrl: doc.fileUrl,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        status: doc.verificationStatus,
        uploadedAt: doc.uploadedAt,
        verifiedAt: doc.verifiedAt,
        isMandatory: doc.isMandatory,
        expiryDate: doc.expiryDate,
        rejectionReason: doc.rejectionReason,
        notes: doc.notes
      }));

      // Calculate statistics
      const stats = {
        total: documents.length,
        verified: documents.filter(d => d.status === 'verified').length,
        pending: documents.filter(d => d.status === 'pending').length,
        rejected: documents.filter(d => d.status === 'rejected').length
      };

      return {
        success: true,
        data: {
          userId,
          employeeId: employeeDoc.employmentDetails.employeeId,
          employeeName: (employeeDoc.user as any)?.name,
          employeeEmail: (employeeDoc.user as any)?.email,
          documents,
          stats,
          bankVerificationStatus: employeeDoc.bankDetails?.verificationStatus || 'pending'
        }
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get all pending verifications (Admin only)
   */
  getPendingVerifications: async () => {
    try {
      const pendingDocs = await EmployeeDocument.aggregate([
        { $unwind: '$documents' },
        { $match: { 'documents.verificationStatus': 'pending' } },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDetails'
          }
        },
        { $unwind: '$userDetails' },
        {
          $project: {
            documentId: '$documents._id',
            documentType: '$documents.documentType',
            documentName: '$documents.documentName',
            uploadedAt: '$documents.uploadedAt',
            userName: '$userDetails.name',
            userEmail: '$userDetails.email',
            employeeId: '$employmentDetails.employeeId',
            isMandatory: '$documents.isMandatory'
          }
        },
        { $sort: { uploadedAt: -1 } }
      ]);

      return {
        success: true,
        total: pendingDocs.length,
        data: pendingDocs
      };
    } catch (error) {
      throw error;
    }
  }
};