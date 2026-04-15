import { Schema, model } from 'mongoose';

interface IWebsiteCourse {
  slug: string;
  title: string;
}

const websiteCourseSchema = new Schema<IWebsiteCourse>(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    collection: 'courses',
    versionKey: false,
  }
);

export default model<IWebsiteCourse>('WebsiteCourse', websiteCourseSchema);
