import { Request, Response } from 'express';
import Status from '../models/Status';
import Lead from '../models/Lead';

// Get all statuses
export const getStatuses = async (_req: Request, res: Response): Promise<void> => {
  try {
    const statuses = await Status.find().sort({ order: 1, createdAt: 1 });
    
    res.json({
      success: true,
      data: statuses
    });
  } catch (error) {
    console.error('Error fetching statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statuses',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create a new status
export const createStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        message: 'Status name is required'
      });
      return;
    }

    // Check if status already exists
    const existingStatus = await Status.findOne({ name: name.trim() });
    if (existingStatus) {
      res.status(400).json({
        success: false,
        message: 'Status already exists'
      });
      return;
    }

    // Get the highest order number
    const highestOrder = await Status.findOne().sort({ order: -1 }).select('order');
    const newOrder = highestOrder ? highestOrder.order + 1 : 0;

    const status = await Status.create({
      name: name.trim(),
      isDefault: false,
      order: newOrder
    });

    res.status(201).json({
      success: true,
      message: 'Status created successfully',
      data: status
    });
  } catch (error) {
    console.error('Error creating status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete a status
export const deleteStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const status = await Status.findById(id);
    
    if (!status) {
      res.status(404).json({
        success: false,
        message: 'Status not found'
      });
      return;
    }

    // Prevent deletion of default statuses
    if (status.isDefault) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete default status'
      });
      return;
    }

    // Check if any leads are using this status
    const leadsCount = await Lead.countDocuments({ status: status.name });
    
    if (leadsCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete status. ${leadsCount} lead(s) are using this status. Please reassign them first.`
      });
      return;
    }

    await Status.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Status deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update status order (for drag-and-drop reordering)
export const updateStatusOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { statuses } = req.body; // Array of { id, order }

    if (!Array.isArray(statuses)) {
      res.status(400).json({
        success: false,
        message: 'Invalid input: statuses must be an array'
      });
      return;
    }

    // Update each status's order
    const updatePromises = statuses.map(({ id, order }) =>
      Status.findByIdAndUpdate(id, { order }, { new: true })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Status order updated successfully'
    });
  } catch (error) {
    console.error('Error updating status order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status order',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
