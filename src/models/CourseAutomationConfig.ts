import { Schema, model } from 'mongoose';
import type { ICourseAutomationConfig } from '../types';

const optionSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [optionSchema],
      default: [],
    },
    allowsTextReply: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const courseAutomationConfigSchema = new Schema<ICourseAutomationConfig>(
  {
    courseSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    courseTitle: {
      type: String,
      required: true,
      trim: true,
    },
    curriculumUrl: {
      type: String,
      required: true,
      trim: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    metaCampaignNames: {
      type: [String],
      default: [],
    },
    metaAdsetNames: {
      type: [String],
      default: [],
    },
    metaAdNames: {
      type: [String],
      default: [],
    },
    whatsappQuestions: {
      type: [questionSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

courseAutomationConfigSchema.index({ aliases: 1 });
courseAutomationConfigSchema.index({ metaCampaignNames: 1 });
courseAutomationConfigSchema.index({ metaAdsetNames: 1 });
courseAutomationConfigSchema.index({ metaAdNames: 1 });

export default model<ICourseAutomationConfig>('CourseAutomationConfig', courseAutomationConfigSchema);
