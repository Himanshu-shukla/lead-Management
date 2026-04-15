import mongoose, { Schema } from 'mongoose';


const holidaySchema = new Schema({
    name: { type: String, required: true },
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    type: { type: String, enum: ['Public', 'Company-Event'], default: 'Public' }
  });
  export const Holiday = mongoose.model('Holiday', holidaySchema);