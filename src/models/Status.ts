import mongoose, { Schema, Document } from 'mongoose';

export interface IStatus extends Document {
  name: string;
  isDefault: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const statusSchema = new Schema<IStatus>({
  name: {
    type: String,
    required: [true, 'Status name is required'],
    trim: true,
    unique: true,
    maxlength: [50, 'Status name cannot exceed 50 characters']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries
statusSchema.index({ order: 1 });
statusSchema.index({ isDefault: 1 });

export default mongoose.model<IStatus>('Status', statusSchema);
