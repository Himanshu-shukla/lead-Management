import CourseAutomationConfig from '../models/CourseAutomationConfig';
import WebsiteCourse from '../models/WebsiteCourse';

const DEFAULT_QUESTION_FLOW = [
  {
    id: 'preferred_call_slot',
    text: 'What call timing suits you best for today?',
    options: [
      { key: 'first_half', label: 'First half of the day' },
      { key: 'second_half', label: 'Second half of the day' },
      { key: 'custom_datetime', label: 'I will choose custom date' },
    ],
    allowsTextReply: true,
  },
  {
    id: 'current_level',
    text: 'Which best describes your current stage in this course area?',
    options: [
      { key: 'beginner', label: 'Beginner' },
      { key: 'some_exposure', label: 'Some exposure' },
      { key: 'working_professional', label: 'Working professional' },
    ],
  },
  {
    id: 'primary_goal',
    text: 'What is your main goal for joining this course?',
    options: [
      { key: 'career_switch', label: 'Career switch' },
      { key: 'upskill', label: 'Upskill in current role' },
      { key: 'projects', label: 'Build practical projects' },
    ],
  },
];

const buildCurriculumUrl = (slug: string): string =>
  process.env.WHATSAPP_CURRICULUM_URL
    ? process.env.WHATSAPP_CURRICULUM_URL
    : `https://example.com/curriculum/${slug}`;

export const syncCourseAutomationConfigsFromWebsiteCourses = async (): Promise<{
  created: number;
}> => {
  const websiteCourses = await WebsiteCourse.find({}, { slug: 1, title: 1 }).lean();
  let created = 0;

  for (const course of websiteCourses) {
    const existing = await CourseAutomationConfig.findOne({ courseSlug: course.slug });
    if (existing) {
      continue;
    }

    await CourseAutomationConfig.create({
      courseSlug: course.slug,
      courseTitle: course.title,
      curriculumUrl: buildCurriculumUrl(course.slug),
      aliases: [course.title, course.slug.replace(/-/g, ' ')],
      metaCampaignNames: [course.slug.replace(/-/g, ' ')],
      metaAdsetNames: [],
      metaAdNames: [],
      whatsappQuestions: DEFAULT_QUESTION_FLOW,
      isActive: true,
    });

    created++;
  }

  return { created };
};
