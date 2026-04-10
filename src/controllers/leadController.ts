import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Lead from '../models/Lead';
import type { 
  CreateLeadInput, 
  UpdateLeadInput, 
  AssignLeadInput, 
  AddNoteInput
} from '../types';
import { assignLeadsService, getDuplicateAndUncategorizedCountService, getDuplicateLeadsService, getLeadsService, getMyLeadsService, importLeadsFromGoogleSheetService, searchLeadsService } from '../service/lead.service';
import { sendError } from '../utils/sendError';




export const getLeads = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {

    console.log("we are in foder api")
    const pageNum = parseInt((req.query.page as string) || '1', 10);
    const limitNum = parseInt((req.query.limit as string) || '10', 10);

    //  Duplicate folder flow (UNCHANGED)
    if (req.query.folder === 'Duplicatelll') {
      const { leads, total } = await getDuplicateLeadsService(req);

      const totalPages = Math.ceil(total / limitNum);

      res.status(200).json({
        success: true,
        message: 'Duplicate leads retrieved successfully',
        data: leads,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages
        }
      });
      return;
    }

    // Normal leads flow (UNCHANGED)
    const { leads, total } = await getLeadsService(req);
    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      message: 'Leads retrieved successfully--;',
      data: leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leads',
      errors: [
        error instanceof Error
          ? error.message
          : 'Unknown error occurred'
      ]
    });
  }
};


export const searchLeads = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { leads, total } = await searchLeadsService(req);

    res.status(200).json({
      success: true,
      message: 'Leads searched successfully',
      data: leads,
      total
    });
  } catch (error) {
    console.error('Search leads error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to search leads',
      errors: [
        error instanceof Error ? error.message : 'Unknown error occurred'
      ]
    });
  }
};





export const getLeadById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const lead = await Lead.findById(id)
      .populate('assignedToUser', 'name email')
      .populate('assignedByUser', 'name email')
      .populate('notes.createdBy', 'name email');

    if (!lead) {
      res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
      return;
    }

    // Check if user can access this lead
    if (req.user?.role !== 'admin' && String(lead.assignedTo) !== String(req.user?.userId)) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Lead retrieved successfully',
      data: lead
    });
  } catch (error) {
    console.error('Get lead by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const createLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const leadData: CreateLeadInput = req.body;

    // Validate required fields - only name, email, and phone are required
    const requiredFields = ['name', 'email', 'phone'];
    const missingFields = requiredFields.filter(field => !leadData[field as keyof CreateLeadInput]);
    
    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields',
        errors: [`Required fields: ${missingFields.join(', ')}`]
      });
      return;
    }

    // Check for duplicate email first, then phone only if email doesn't exist
    const existingEmail = await Lead.findOne({ email: leadData.email.toLowerCase().trim() });
    if (existingEmail) {
      res.status(400).json({
        success: false,
        message: 'Duplicate lead detected',
        errors: [`A lead with email "${leadData.email}" already exists`],
        data: {
          existingLead: {
            _id: existingEmail._id,
            name: existingEmail.name,
            email: existingEmail.email,
            phone: existingEmail.phone
          }
        }
      });
      return;
    }
    
    // Only check phone if email doesn't exist
    const existingPhone = await Lead.findOne({ phone: leadData.phone.trim() });
    if (existingPhone) {
      res.status(400).json({
        success: false,
        message: 'Duplicate lead detected',
        errors: [`A lead with phone number "${leadData.phone}" already exists`],
        data: {
          existingLead: {
            _id: existingPhone._id,
            name: existingPhone.name,
            email: existingPhone.email,
            phone: existingPhone.phone
          }
        }
      });
      return;
    }
    const {notes, ...leadFields} = leadData;
    // Create lead
    const lead = new Lead({
      ...leadFields,
      assignedBy: req.user?.userId
    });

    // Add initial note if provided
    if (notes) {
      lead.notes.push({
        id: new mongoose.Types.ObjectId().toString(),
        content: notes,
        createdBy: new mongoose.Types.ObjectId(req.user?.userId || ''),
        createdAt: new Date()
      });
    }

    await lead.save();

    // Populate the response
    await lead.populate('assignedByUser', 'name email');

    res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: lead
    });
  } catch (error: any) {
    console.error('Create lead error:', error);
    
    // Handle MongoDB duplicate key errors
    const duplicateError = (Lead as any).getDuplicateError(error);
    if (duplicateError) {
      res.status(400).json({
        success: false,
        message: 'Duplicate lead detected',
        errors: [duplicateError]
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create lead',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const updateLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData: UpdateLeadInput = req.body;

    const lead = await Lead.findById(id);
    if (!lead) {
      res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
      return;
    }

    // Check if user can update this lead
    if (req.user?.role !== 'admin' && String(lead.assignedTo) !== String(req.user?.userId)) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Check for duplicates if email or phone is being updated
    if (updateData.email) {
      const existingEmail = await Lead.findOne({ 
        email: updateData.email.toLowerCase().trim(),
        _id: { $ne: id }
      });
      if (existingEmail) {
        res.status(400).json({
          success: false,
          message: 'Duplicate lead detected',
          errors: [`A lead with email "${updateData.email}" already exists`],
          data: {
            existingLead: {
              _id: existingEmail._id,
              name: existingEmail.name,
              email: existingEmail.email,
              phone: existingEmail.phone
            }
          }
        });
        return;
      }
    }
    
    if (updateData.phone) {
      const existingPhone = await Lead.findOne({ 
        phone: updateData.phone.trim(),
        _id: { $ne: id }
      });
      if (existingPhone) {
        res.status(400).json({
          success: false,
          message: 'Duplicate lead detected',
          errors: [`A lead with phone number "${updateData.phone}" already exists`],
          data: {
            existingLead: {
              _id: existingPhone._id,
              name: existingPhone.name,
              email: existingPhone.email,
              phone: existingPhone.phone
            }
          }
        });
        return;
      }
    }

    // Update allowed fields
    const allowedFields = ['name', 'email', 'phone', 'position', 'folder', 'source', 'status', 'priority'];
    allowedFields.forEach(field => {
      if (updateData[field as keyof UpdateLeadInput] !== undefined) {
        (lead as any)[field] = updateData[field as keyof UpdateLeadInput];
      }
    });

    await lead.save();

    // Populate the response
    await lead.populate('assignedToUser', 'name email');
    await lead.populate('assignedByUser', 'name email');

    res.status(200).json({
      success: true,
      message: 'Lead updated successfully',
      data: lead
    });
  } catch (error: any) {
    console.error('Update lead error:', error);
    
    // Handle MongoDB duplicate key errors
    const duplicateError = (Lead as any).getDuplicateError(error);
    if (duplicateError) {
      res.status(400).json({
        success: false,
        message: 'Duplicate lead detected',
        errors: [duplicateError]
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update lead',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const deleteLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Only admins can delete leads
    if (req.user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
      return;
    }

    await Lead.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lead',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const assignLeads = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // ✅ Admin check
    if (req.user?.role !== 'admin') {
      const err: any = new Error('Admin access required');
      err.statusCode = 403;
      throw err;
    }

    const payload = req.body as AssignLeadInput;

    const result = await assignLeadsService(
      payload,
      req.user!.userId.toString()
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads assigned successfully`,
      data: result.leads
    });
  } catch (error) {
    console.error('Assign leads error:', error);
    sendError(res, error, 500);
  }
};

export const unassignLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadIds }: { leadIds: string[] } = req.body;

    // Only admins can unassign leads
    if (req.user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    // Validate input
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Lead IDs are required',
        errors: ['Please provide an array of lead IDs']
      });
      return;
    }

    // Update leads to unassign them
    const result = await Lead.updateMany(
      { _id: { $in: leadIds } },
      { 
        $unset: { 
          assignedTo: 1,
          assignedBy: 1
        },
        updatedAt: new Date()
      }
    );

    // Get updated leads
    const updatedLeads = await Lead.find({ _id: { $in: leadIds } })
      .populate('assignedToUser', 'name email')
      .populate('assignedByUser', 'name email');

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads unassigned successfully`,
      data: updatedLeads
    });
  } catch (error) {
    console.error('Unassign leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unassign leads',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const bulkUpdateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadIds, status }: { leadIds: string[]; status: string } = req.body;

    // Validate input
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Lead IDs are required',
        errors: ['Please provide an array of lead IDs']
      });
      return;
    }

    if (!status || typeof status !== 'string' || status.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Status is required',
        errors: ['Please provide a valid status']
      });
      return;
    }

    // Update leads' status
    const result = await Lead.updateMany(
      { _id: { $in: leadIds } },
      { 
        $set: { 
          status: status.trim(),
          // folder:status.trim(),
          updatedAt: new Date()
        }
      }
    );

    // Fetch updated leads
    const updatedLeads = await Lead.find({ _id: { $in: leadIds } })
      .populate('assignedToUser', 'name email')
      .populate('assignedByUser', 'name email');

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} lead${result.modifiedCount !== 1 ? 's' : ''} updated to "${status}"`,
      data: updatedLeads
    });
  } catch (error) {
    console.error('Bulk update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lead statuses',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const addNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId, content }: AddNoteInput = req.body;

    // Validate input
    if (!leadId || !content) {
      res.status(400).json({
        success: false,
        message: 'Lead ID and note content are required',
        errors: ['Please provide both lead ID and note content']
      });
      return;
    }

    if (content.trim().length < 1) {
      res.status(400).json({
        success: false,
        message: 'Note content cannot be empty',
        errors: ['Please provide valid note content']
      });
      return;
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
      return;
    }

    // Check if user can add notes to this lead
    if (req.user?.role !== 'admin' && String(lead.assignedTo) !== String(req.user?.userId)) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Add note using the model method
    if (!req.user?.userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        errors: ['Please provide a valid user ID']
      });
      return;
    }
    
    await lead.addNote(content.trim(), new mongoose.Types.ObjectId(req.user.userId));

    // Populate the response
    await lead.populate('assignedToUser', 'name email');
    await lead.populate('assignedByUser', 'name email');
    await lead.populate('notes.createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Note added successfully',
      data: lead
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};


export const getMyLeads = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await getMyLeadsService(req);

    const totalPages = Math.ceil(result.total / result.limit);

    res.status(200).json({
      success: true,
      message: 'My leads retrieved successfully',
      data: result.leads,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get my leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve your leads',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};


// Get distinct folders for filtering
export const getDistinctFolders = async (req: Request, res: Response): Promise<void> => {
  try {
    // Build filter based on user role
    const filter: any = {};
    
    // If user is not admin, only show folders from their assigned leads
    if (req.user?.role !== 'admin') {
      filter.assignedTo = req.user?.userId;
    }

    // Get distinct folders, excluding empty ones
    const folders = await Lead.distinct('folder', {
      ...filter,
      folder: { $nin: ['', null], $exists: true }
    });

    // Sort folders alphabetically
    folders.sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      success: true,
      message: 'Distinct folders retrieved successfully',
      data: folders
    });
  } catch (error) {
    console.error('Get distinct folders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve distinct folders',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

// Get stats for all leads assigned to the current user (independent of filters or pagination)
export const getMyLeadsStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = { assignedTo: req.user?.userId };
    const leads = await Lead.find(filter).lean();

    const total = leads.length;
    const newLeads = leads.filter(lead => lead.status === 'New').length;
    const inProgress = leads.filter(lead =>
      ['Contacted', 'Interested', 'Follow-up', 'Qualified', 'Proposal Sent', 'Negotiating'].includes(lead.status)
    ).length;
    const closed = leads.filter(lead =>
      ['Sales Done', 'DNP'].includes(lead.status)
    ).length;

    res.status(200).json({
      success: true,
      message: 'My leads stats retrieved successfully',
      data: { total, newLeads, inProgress, closed }
    });
  } catch (error) {
    console.error('Get my leads stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve your leads stats',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

// Get folder counts for leads (optimized for performance)
export const getFolderCounts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Build filter based on user role
    const baseFilter: any = {};
    
    // If user is not admin, only count their assigned leads
    if (req.user?.role !== 'admin') {
      baseFilter.assignedTo = req.user?.userId;
    }

    // Use aggregation pipeline for efficient counting
    const folderCounts = await Lead.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: {
            $cond: [
              { $or: [{ $eq: ['$folder', ''] }, { $eq: ['$folder', null] }, { $not: ['$folder'] }] },
              'Uncategorized',
              '$folder'
            ]
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Convert to object format
    const folderStats: Record<string, number> = {};
    folderCounts.forEach(item => {
      folderStats[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      message: 'Folder counts retrieved successfully',
      data: folderStats
    });
  } catch (error) {
    console.error('Get folder counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve folder counts',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};


export const importLeadsFromGoogleSheet = async (
  req: Request,
  res: Response
) => {
  try {
    const { sheetUrl } = req.body;

    const result = await importLeadsFromGoogleSheetService(sheetUrl);

    return res.status(200).json({
      success: true,
      message: 'Google Sheet processed successfully',
      ...result,
      note: 'Duplicate leads moved to duplicate collection'
    });
  } catch (error) {
    return sendError(res, error);
  }
};


export const getDuplicateAndUncategorizedCounts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const counts = await getDuplicateAndUncategorizedCountService(req);

    res.status(200).json({
      success: true,
      message: 'Lead counts retrieved successfully',
      data: counts
    });
  } catch (error) {
    console.error('Get lead counts error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead counts',
      errors: [
        error instanceof Error
          ? error.message
          : 'Unknown error occurred'
      ]
    });
  }
};
