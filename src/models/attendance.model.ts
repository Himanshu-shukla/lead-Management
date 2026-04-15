import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  user: mongoose.Types.ObjectId;
  date: string; // Format: YYYY-MM-DD
  checkIn: Date;
  checkOut: Date | null; // Changed from optional to nullable
  workHours: number;
  location: {
    lat: number;
    lng: number;
  };
  status: 'Present' | 'Late' | 'Half-day';
}

const attendanceSchema = new Schema<IAttendance>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { 
    type: String, 
    required: true,
    trim: true,
    // Automatically cleans the string to YYYY-MM-DD format
    set: (v: string) => v.split('T')[0] 
  },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, default: null }, 
  workHours: { type: Number, default: 0 },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  status: { type: String, enum: ['Present', 'Late', 'Half-day'], default: 'Present' }
}, { timestamps: true });

attendanceSchema.index({ user: 1, date: 1, checkOut: 1 });

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);