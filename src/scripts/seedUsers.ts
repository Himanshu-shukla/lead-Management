import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../utils/database';
import User from '../models/User';

// Load environment variables
dotenv.config();

const seedUsers = async () => {
  try {
    console.log('🌱 Starting user seeding...');
    
    // Connect to database
    await connectDatabase();
    
    // Clear existing users (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing users...');
    await User.deleteMany({});
    
    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@leadmanager.com',
      password: 'admin123456',
      role: 'admin'
    });
    
    await adminUser.save();
    console.log('✅ Admin user created:', adminUser.email);
    
    // Create regular user
    const regularUser = new User({
      name: 'Regular User',
      email: 'user@leadmanager.com',
      password: 'user123456',
      role: 'user'
    });
    
    await regularUser.save();
    console.log('✅ Regular user created:', regularUser.email);
  
    
    console.log('\n🎉 User seeding completed successfully!');
    console.log('\n📝 Demo Credentials:');
    console.log('Admin: admin@leadmanager.com / admin123456');
    console.log('User:  user@leadmanager.com / user123456');
    
    // Ensure system user exists for import operations
    const systemUser = await User.findOne({ email: 'system@leadmanager.com' });
    if (!systemUser) {
      const systemUserData = {
        name: 'System Import',
        email: 'system@leadmanager.com',
        password: 'systemPassword123!',
        role: 'admin' as const,
        isActive: true
      };
      
      const newSystemUser = new User(systemUserData);
      await newSystemUser.save();
      console.log('✅ System user created for import operations');
    } else {
      console.log('✅ System user already exists');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
};

// Run the seed function
seedUsers();
