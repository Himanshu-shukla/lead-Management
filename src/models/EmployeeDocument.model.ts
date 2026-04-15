import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeDocument extends Document {
  user: mongoose.Types.ObjectId;
  documents: {
    _id?: mongoose.Types.ObjectId;
    documentType: string;
    documentName: string;
    fileUrl: string;
    fileKey: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    verifiedBy?: mongoose.Types.ObjectId;
    verifiedAt?: Date;
    rejectionReason?: string;
    uploadedAt: Date;
    isMandatory: boolean;
    expiryDate?: Date; // Added for documents like passport
    notes?: string; // Optional notes for document
    fileSize?: number; // Track file size
    mimeType?: string; // Track file type
  }[];
  employmentDetails: {
    employeeId: string;
    joiningDate: Date;
    employmentType: 'full-time' | 'part-time' | 'contract' | 'probation' | 'intern' | 'trainee';
    department: string;
    designation: string;
    workLocation?: string; // Added work location
    reportingTo?: mongoose.Types.ObjectId; // Added reporting manager
    confirmationDate?: Date; // Added probation confirmation date
    employmentHistory: {
      _id?: mongoose.Types.ObjectId;
      companyName: string;
      designation: string;
      fromDate: Date;
      toDate?: Date;
      isCurrent?: boolean; // Flag for current employment
      verificationStatus: 'pending' | 'verified' | 'rejected';
      verifiedBy?: mongoose.Types.ObjectId; // Who verified this
      verifiedAt?: Date; // When it was verified
      documents?: mongoose.Types.ObjectId[]; // Reference to experience letters
    }[];
  };
  bankDetails: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    panNumber: string;
    uanNumber?: string; // PF account number
    esicNumber?: string; // ESIC number
    verificationStatus: 'pending' | 'verified' | 'rejected';
    verifiedBy?: mongoose.Types.ObjectId;
    verifiedAt?: Date;
    rejectionReason?: string;
  };
  emergencyContacts?: { // Added emergency contacts
    _id?: mongoose.Types.ObjectId;
    name: string;
    relationship: string;
    phone: string;
    alternatePhone?: string;
    address?: string;
  }[];
  notes?: string; // General notes about employee
  isActive?: boolean; // Employee status
  exitDate?: Date; // Date of leaving
  exitReason?: string; // Reason for leaving
}

const employeeDocumentSchema = new Schema<IEmployeeDocument>({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true,
    index: true 
  },
  
  documents: [{
    documentType: { 
      type: String, 
      required: true,
      enum: [
        'aadhar', 'pan', 'voter', 'passport', 'driving_license', 
        'education_certificate', 'experience_certificate', 'offer_letter',
        'appointment_letter', 'resignation_letter', 'relieving_letter',
        'salary_slip', 'bank_proof', 'other'
      ]
    },
    documentName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileKey: { type: String },
    verificationStatus: { 
      type: String, 
      enum: ['pending', 'verified', 'rejected'], 
      default: 'pending' 
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    isMandatory: { type: Boolean, default: false },
    expiryDate: { type: Date },
    notes: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String }
  }],
  
  employmentDetails: {
    employeeId: { 
      type: String, 
      unique: true,
      sparse: true,
      index: true 
    },
    joiningDate: { type: Date },
    employmentType: { 
      type: String, 
      enum: ['full-time', 'part-time', 'contract', 'probation', 'intern', 'trainee'],
      default: 'probation'
    },
    department: { type: String, index: true },
    designation: { type: String },
    workLocation: { type: String },
    reportingTo: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmationDate: { type: Date },
    employmentHistory: [{
      companyName: { type: String, required: true },
      designation: { type: String, required: true },
      fromDate: { type: Date, required: true },
      toDate: { type: Date },
      isCurrent: { type: Boolean, default: false },
      verificationStatus: { 
        type: String, 
        enum: ['pending', 'verified', 'rejected'], 
        default: 'pending' 
      },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      verifiedAt: { type: Date },
      documents: [{ type: Schema.Types.ObjectId, ref: 'EmployeeDocument' }]
    }]
  },
  
  bankDetails: {
    accountHolderName: { type: String },
    bankName: { type: String },
    accountNumber: { type: String },
    ifscCode: { 
      type: String,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please enter a valid IFSC code']
    },
    panNumber: { 
      type: String,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
    },
    uanNumber: { type: String },
    esicNumber: { type: String },
    verificationStatus: { 
      type: String, 
      enum: ['pending', 'verified', 'rejected'], 
      default: 'pending' 
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String }
  },
  
  emergencyContacts: [{
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    phone: { type: String, required: true },
    alternatePhone: { type: String },
    address: { type: String }
  }],
  
  notes: { type: String },
  isActive: { type: Boolean, default: true, index: true },
  exitDate: { type: Date },
  exitReason: { type: String }

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ========== INDEXES ==========

// Compound indexes for common queries
employeeDocumentSchema.index({ 'employmentDetails.department': 1, 'employmentDetails.employmentType': 1 });
employeeDocumentSchema.index({ 'documents.verificationStatus': 1, 'employmentDetails.employeeId': 1 });
employeeDocumentSchema.index({ 'bankDetails.verificationStatus': 1 });
employeeDocumentSchema.index({ isActive: 1, 'employmentDetails.department': 1 });

// ========== VIRTUALS ==========

// Virtual for document statistics
employeeDocumentSchema.virtual('documentStats').get(function(this: IEmployeeDocument) {
  const total = this.documents.length;
  const verified = this.documents.filter(d => d.verificationStatus === 'verified').length;
  const pending = this.documents.filter(d => d.verificationStatus === 'pending').length;
  const rejected = this.documents.filter(d => d.verificationStatus === 'rejected').length;
  
  return {
    total,
    verified,
    pending,
    rejected,
    completionPercentage: total > 0 ? (verified / total) * 100 : 0
  };
});

// Virtual for full employee name with ID
employeeDocumentSchema.virtual('displayId').get(function(this: IEmployeeDocument) {
  return `${this.employmentDetails.employeeId || 'N/A'} - ${this.employmentDetails.department || 'N/A'}`;
});

// ========== METHODS ==========

// Check if employee is fully verified
employeeDocumentSchema.methods.isFullyVerified = function(this: IEmployeeDocument): boolean {
  const mandatoryDocs = this.documents.filter(d => d.isMandatory);
  const verifiedMandatory = mandatoryDocs.filter(d => d.verificationStatus === 'verified');
  
  return mandatoryDocs.length === verifiedMandatory.length && 
         this.bankDetails.verificationStatus === 'verified';
};

// Get pending documents
employeeDocumentSchema.methods.getPendingDocuments = function(this: IEmployeeDocument) {
  return this.documents.filter(d => d.verificationStatus === 'pending');
};

// ========== STATICS ==========

// Find by employee ID
employeeDocumentSchema.statics.findByEmployeeId = function(employeeId: string) {
  return this.findOne({ 'employmentDetails.employeeId': employeeId });
};

// Find all pending verifications
employeeDocumentSchema.statics.findPendingVerifications = function() {
  return this.find({
    $or: [
      { 'documents.verificationStatus': 'pending' },
      { 'bankDetails.verificationStatus': 'pending' },
      { 'employmentDetails.employmentHistory.verificationStatus': 'pending' }
    ]
  }).populate('user', 'name email');
};

// Get department-wise statistics
employeeDocumentSchema.statics.getDepartmentStats = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$employmentDetails.department',
        totalEmployees: { $sum: 1 },
        verifiedEmployees: {
          $sum: {
            $cond: [
              { $eq: ['$bankDetails.verificationStatus', 'verified'] },
              1,
              0
            ]
          }
        },
        activeEmployees: {
          $sum: {
            $cond: [
              { $eq: ['$isActive', true] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        department: '$_id',
        totalEmployees: 1,
        verifiedEmployees: 1,
        activeEmployees: 1,
        verificationRate: {
          $multiply: [
            { $divide: ['$verifiedEmployees', '$totalEmployees'] },
            100
          ]
        }
      }
    }
  ]);
};

// ========== MIDDLEWARE ==========

// Pre-save middleware to generate employee ID if not exists
employeeDocumentSchema.pre('save', async function(next) {
  if (this.isNew && !this.employmentDetails.employeeId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('EmployeeDocument').countDocuments() + 1;
    this.employmentDetails.employeeId = `EMP${year}${count.toString().padStart(4, '0')}`;
  }
  next();
});

export const EmployeeDocument = mongoose.model<IEmployeeDocument>('EmployeeDocument', employeeDocumentSchema);