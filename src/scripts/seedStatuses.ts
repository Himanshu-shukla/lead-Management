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
  { name: 'Wrong Number', isDefault: true, order: 10 },
  { name: 'Call Back', isDefault: true, order: 11 },
  {name :"Didn't Require", isDefault:true,order:12},
  {name:"Next Year",isDefault:true,order:13}
];

async function seedStatuses() {
  try {
    await connectDatabase();
    console.log('Connected to MongoDB');

    let addedCount = 0;
    let skippedCount = 0;

    for (const status of defaultStatuses) {
      // Look for the status by name
      const exists = await Status.findOne({ name: status.name });

      if (!exists) {
        await Status.create(status);
        addedCount++;
      } else {
        // Optional: Update the order if it has changed
        exists.order = status.order;
        await exists.save();
        skippedCount++;
      }
    }

    console.log(`Seed complete: Added ${addedCount}, Updated/Skipped ${skippedCount}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding statuses:', error);
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
    process.exit(1);
  }
}

seedStatuses();
