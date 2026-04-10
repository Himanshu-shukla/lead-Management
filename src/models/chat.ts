import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  phone: string;
  userName: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    platform: string;
    status: string;
  };
}

const ChatSchema: Schema = new Schema({
  phone: { type: String, required: true, index: true }, // Index for fast history lookup
  userName: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: {
    platform: { type: String, default: 'whatsapp' },
    status: { type: String, default: 'delivered' }
  }
});

// Using your primary connection to register the model
export const Chat = mongoose.model<IChat>('Chat', ChatSchema);