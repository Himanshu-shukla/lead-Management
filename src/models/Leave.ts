import mongoose, { Schema, Document } from 'mongoose';

export interface ILeave extends Document {
  user: mongoose.Types.ObjectId;
  leaveType: 'Sick' | 'Casual' | 'Paid' | 'Unpaid';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  approvedBy: mongoose.Types.ObjectId;
}

const leaveSchema = new Schema<ILeave>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: String, enum: ['Sick', 'Casual', 'Paid', 'Unpaid'], required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  totalDays: { type: Number, required: true },
  reason: { type: String },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const Leave = mongoose.model<ILeave>('Leave', leaveSchema);