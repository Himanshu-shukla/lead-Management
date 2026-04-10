import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Status from '../models/Status';
import connectDatabase from '../utils/database';

// Load environment variables
dotenv.config();

const defaultStatuses = [
  { name: 'New', isDefault: true, order: 0 },
  { name: 'Contacted', isDefault: true, order: 1 },
  { name: 'Follow-up', isDefault: true, order: 2 },
  { name: 'Interested', isDefault: true, order: 3 },
  { name: 'Qualified', isDefault: true, order: 4 },
  { name: 'Proposal Sent', isDefault: true, order: 5 },
  { name: 'Negotiating', isDefault: true, order: 6 },
  { name: 'Sales Done', isDefault: true, order: 7 },
  { name: 'DNP', isDefault: true, order: 8 },
  { name: 'Not Interested', isDefault: true, order: 9 },
  { name: 'Wrong Number', isDefault: true, order: 10 }
];

async function seedStatuses() {
  try {
    // Connect to database
    await connectDatabase();
    console.log('Connected to MongoDB');

    // Check if statuses already exist
    const existingStatuses = await Status.countDocuments();
    
    if (existingStatuses > 0) {
      console.log(`Statuses already exist (${existingStatuses} found). Skipping seed.`);
      await mongoose.connection.close();
      process.exit(0);
    }

    // Insert default statuses
    await Status.insertMany(defaultStatuses);
    console.log(`Successfully seeded ${defaultStatuses.length} default statuses`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding statuses:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedStatuses();
