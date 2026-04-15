import { Request, Response } from 'express';
import CourseAutomationConfig from '../models/CourseAutomationConfig';
import { syncCourseAutomationConfigsFromWebsiteCourses } from '../service/courseAutomationConfig.service';

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const validateQuestions = (questions: unknown): string[] => {
  if (!Array.isArray(questions)) {
    return ['whatsappQuestions must be an array'];
  }

  const errors: string[] = [];

  questions.forEach((question, index) => {
    const current = question as {
      id?: unknown;
      text?: unknown;
      options?: unknown;
    };

    if (typeof current.id !== 'string' || current.id.trim() === '') {
      errors.push(`Question ${index + 1}: id is required`);
    }

    if (typeof current.text !== 'string' || current.text.trim() === '') {
      errors.push(`Question ${index + 1}: text is required`);
    }

    if (!Array.isArray(current.options) || current.options.length === 0) {
      errors.push(`Question ${index + 1}: at least one option is required`);
      return;
    }

    current.options.forEach((option, optionIndex) => {
      const currentOption = option as { key?: unknown; label?: unknown };
      if (typeof currentOption.key !== 'string' || currentOption.key.trim() === '') {
        errors.push(`Question ${index + 1}, option ${optionIndex + 1}: key is required`);
      }
      if (typeof currentOption.label !== 'string' || currentOption.label.trim() === '') {
        errors.push(`Question ${index + 1}, option ${optionIndex + 1}: label is required`);
      }
    });
  });

  return errors;
};

const buildPayload = (body: Record<string, unknown>) => ({
  courseSlug: typeof body.courseSlug === 'string' ? body.courseSlug.trim().toLowerCase() : '',
  courseTitle: typeof body.courseTitle === 'string' ? body.courseTitle.trim() : '',
  curriculumUrl: typeof body.curriculumUrl === 'string' ? body.curriculumUrl.trim() : '',
  aliases: normalizeStringArray(body.aliases),
  metaCampaignNames: normalizeStringArray(body.metaCampaignNames),
  metaAdsetNames: normalizeStringArray(body.metaAdsetNames),
  metaAdNames: normalizeStringArray(body.metaAdNames),
  whatsappQuestions: Array.isArray(body.whatsappQuestions) ? body.whatsappQuestions : [],
  isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
});

export const getCourseAutomationConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    await syncCourseAutomationConfigsFromWebsiteCourses();

    const { page = 1, limit = 20, search, isActive } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    if (typeof isActive === 'string') {
      filter.isActive = isActive === 'true';
    }

    if (typeof search === 'string' && search.trim() !== '') {
      filter.$or = [
        { courseSlug: { $regex: search.trim(), $options: 'i' } },
        { courseTitle: { $regex: search.trim(), $options: 'i' } },
        { aliases: { $elemMatch: { $regex: search.trim(), $options: 'i' } } },
      ];
    }

    const [configs, total] = await Promise.all([
      CourseAutomationConfig.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CourseAutomationConfig.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Course automation configs retrieved successfully',
      data: configs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get course automation configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve course automation configs',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
    });
  }
};

export const getCourseAutomationConfigById = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await CourseAutomationConfig.findById(req.params.id);
    if (!config) {
      res.status(404).json({
        success: false,
        message: 'Course automation config not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Course automation config retrieved successfully',
      data: config,
    });
  } catch (error) {
    console.error('Get course automation config by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve course automation config',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
    });
  }
};

export const createCourseAutomationConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = buildPayload(req.body as Record<string, unknown>);

    if (!payload.courseSlug || !payload.courseTitle || !payload.curriculumUrl) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields',
        errors: ['courseSlug, courseTitle, and curriculumUrl are required'],
      });
      return;
    }

    const questionErrors = validateQuestions(payload.whatsappQuestions);
    if (questionErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid WhatsApp questions',
        errors: questionErrors,
      });
      return;
    }

    const existing = await CourseAutomationConfig.findOne({ courseSlug: payload.courseSlug });
    if (existing) {
      res.status(400).json({
        success: false,
        message: 'Course automation config already exists',
        errors: [`A config for slug "${payload.courseSlug}" already exists`],
      });
      return;
    }

    const config = await CourseAutomationConfig.create(payload);

    res.status(201).json({
      success: true,
      message: 'Course automation config created successfully',
      data: config,
    });
  } catch (error) {
    console.error('Create course automation config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course automation config',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
    });
  }
};

export const updateCourseAutomationConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await CourseAutomationConfig.findById(req.params.id);
    if (!config) {
      res.status(404).json({
        success: false,
        message: 'Course automation config not found',
      });
      return;
    }

    const payload = buildPayload({
      ...config.toObject(),
      ...req.body,
    });

    if (!payload.courseSlug || !payload.courseTitle || !payload.curriculumUrl) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields',
        errors: ['courseSlug, courseTitle, and curriculumUrl are required'],
      });
      return;
    }

    const questionErrors = validateQuestions(payload.whatsappQuestions);
    if (questionErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid WhatsApp questions',
        errors: questionErrors,
      });
      return;
    }

    const duplicate = await CourseAutomationConfig.findOne({
      courseSlug: payload.courseSlug,
      _id: { $ne: config._id },
    });

    if (duplicate) {
      res.status(400).json({
        success: false,
        message: 'Course automation config already exists',
        errors: [`A config for slug "${payload.courseSlug}" already exists`],
      });
      return;
    }

    Object.assign(config, payload);
    await config.save();

    res.status(200).json({
      success: true,
      message: 'Course automation config updated successfully',
      data: config,
    });
  } catch (error) {
    console.error('Update course automation config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course automation config',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
    });
  }
};

export const deleteCourseAutomationConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await CourseAutomationConfig.findById(req.params.id);
    if (!config) {
      res.status(404).json({
        success: false,
        message: 'Course automation config not found',
      });
      return;
    }

    await CourseAutomationConfig.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Course automation config deleted successfully',
    });
  } catch (error) {
    console.error('Delete course automation config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course automation config',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
    });
  }
};
