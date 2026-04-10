import mongoose, { Schema } from 'mongoose';

const duplicateLeadSchema = new Schema(
  {
    originalData: {
      type: Object,
      required: true
    },
    reason: {
      type: String,
      enum: ['EMAIL_EXISTS', 'PHONE_EXISTS', 'EMAIL_PHONE_EXISTS'],
      required: true
    },
    existingLeadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead'
    }
  },
  {
    timestamps: true // ✅ adds createdAt & updatedAt automatically
  }
);

const DuplicateLead = mongoose.model('DuplicateLead', duplicateLeadSchema);
export default DuplicateLead;
