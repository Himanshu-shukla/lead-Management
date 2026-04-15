import mongoose from 'mongoose';
import CourseAutomationConfig from '../models/CourseAutomationConfig';
import Lead from '../models/Lead';
import User from '../models/User';
import type { ICourseAutomationConfig, ILead, WhatsAppWebhookPayload } from '../types';
import {
  extractReplyFromMessage,
  normalizeForMatch,
  parseWhatsAppWebhookPayload,
  sendStructuredQuestionMessage,
  sendStructuredTextFallback,
} from './whatsapp.service';

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
    text: 'Which best describes your current stage in data analytics and GenAI?',
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
      { key: 'genai_projects', label: 'Build GenAI projects' },
    ],
  },
];

const ensureDefaultQuestionFlow = async (
  courseConfig: ICourseAutomationConfig
): Promise<ICourseAutomationConfig> => {
  if (courseConfig.whatsappQuestions.length > 0) {
    return courseConfig;
  }

  courseConfig.whatsappQuestions = DEFAULT_QUESTION_FLOW;
  await courseConfig.save();
  return courseConfig;
};

const getSystemUserId = async (): Promise<mongoose.Types.ObjectId | null> => {
  const systemUser = await User.findOne({ email: 'system@leadmanager.com' }).select('_id');
  return systemUser?._id ? new mongoose.Types.ObjectId(String(systemUser._id)) : null;
};

const addSystemNote = async (lead: ILead, content: string): Promise<void> => {
  const systemUserId = await getSystemUserId();
  if (!systemUserId) {
    return;
  }

  lead.notes.push({
    id: new mongoose.Types.ObjectId().toString(),
    content,
    createdBy: systemUserId,
    createdAt: new Date(),
  });
};

const buildMatchCandidates = (lead: ILead): string[] =>
  [
    lead.position,
    lead.campaignName,
    lead.adsetName,
    lead.adName,
    lead.folder,
  ]
    .map((value) => normalizeForMatch(value))
    .filter(Boolean);

const matchesCourse = (courseConfig: ICourseAutomationConfig, candidates: string[]): boolean => {
  const courseKeys = [
    courseConfig.courseTitle,
    courseConfig.courseSlug,
    ...courseConfig.aliases,
    ...courseConfig.metaCampaignNames,
    ...courseConfig.metaAdsetNames,
    ...courseConfig.metaAdNames,
  ]
    .map((value) => normalizeForMatch(value))
    .filter(Boolean);

  return candidates.some((candidate) =>
    courseKeys.some((courseKey) => candidate.includes(courseKey) || courseKey.includes(candidate))
  );
};

export const resolveLeadCourse = async (lead: ILead): Promise<ICourseAutomationConfig | null> => {
  if (lead.courseSlug) {
    const explicitCourseConfig = await CourseAutomationConfig.findOne({
      courseSlug: lead.courseSlug,
      isActive: true,
    });
    if (explicitCourseConfig) {
      return ensureDefaultQuestionFlow(explicitCourseConfig);
    }
  }

  const activeCourseConfigs = await CourseAutomationConfig.find({ isActive: true });
  const matchCandidates = buildMatchCandidates(lead);

  const matchedCourseConfig = activeCourseConfigs.find((courseConfig) =>
    matchesCourse(courseConfig, matchCandidates)
  );
  if (matchedCourseConfig) {
    lead.courseSlug = matchedCourseConfig.courseSlug;
    await lead.save();
    return ensureDefaultQuestionFlow(matchedCourseConfig);
  }

  return null;
};

const getNextQuestionId = (
  courseConfig: ICourseAutomationConfig,
  currentQuestionId: string
): string | null => {
  const currentIndex = courseConfig.whatsappQuestions.findIndex((item) => item.id === currentQuestionId);
  if (currentIndex < 0) {
    return courseConfig.whatsappQuestions[0]?.id || null;
  }

  return courseConfig.whatsappQuestions[currentIndex + 1]?.id || null;
};

export const triggerLeadWarmFlow = async (leadId: string): Promise<void> => {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    return;
  }

  if (lead.whatsappEngagement?.warmIntroStatus === 'sent') {
    return;
  }

  const courseConfig = await resolveLeadCourse(lead);
  if (!courseConfig) {
    lead.whatsappEngagement = {
      ...(lead.whatsappEngagement || {}),
      warmIntroStatus: 'failed',
      warmIntroError: 'No mapped course found in database for lead',
    };
    await addSystemNote(lead, 'WhatsApp warm flow skipped because no mapped course was found in the database.');
    await lead.save();
    return;
  }

  const firstQuestionId = courseConfig.whatsappQuestions[0]?.id;
  if (!firstQuestionId) {
    lead.whatsappEngagement = {
      ...(lead.whatsappEngagement || {}),
      warmIntroStatus: 'failed',
      warmIntroError: 'Course automation config has no WhatsApp questions configured',
    };
    await addSystemNote(
      lead,
      `WhatsApp warm flow failed because course automation config "${lead.courseSlug || 'unknown'}" has no configured questions.`
    );
    await lead.save();
    return;
  }

  try {
    await sendStructuredQuestionMessage(lead, courseConfig, firstQuestionId, true);
  } catch (error) {
    await sendStructuredTextFallback(lead, courseConfig, firstQuestionId);
  }

  lead.whatsappEngagement = {
    ...(lead.whatsappEngagement || {}),
    warmIntroSentAt: new Date(),
    warmIntroStatus: 'sent',
    warmIntroError: '',
    currentQuestionId: firstQuestionId,
    answers: lead.whatsappEngagement?.answers || [],
  };

  await addSystemNote(
    lead,
    `Warm WhatsApp flow started for course slug "${courseConfig.courseSlug}" and sent from the business WhatsApp number.`
  );
  await lead.save();
};

const findLeadByPhone = async (phone: string): Promise<ILead | null> => {
  const digits = phone.replace(/\D/g, '');
  const leads = await Lead.find({
    phone: { $exists: true, $ne: '' },
  }).sort({ createdAt: -1 });

  return (
    leads.find((lead) => lead.phone.replace(/\D/g, '').endsWith(digits) || digits.endsWith(lead.phone.replace(/\D/g, ''))) ||
    null
  );
};

export const processWhatsAppWebhookPayload = async (payload: WhatsAppWebhookPayload) => {
  const inboundMessages = parseWhatsAppWebhookPayload(payload);
  let processed = 0;
  let ignored = 0;
  const errors: string[] = [];

  for (const inbound of inboundMessages) {
    try {
      const lead = await findLeadByPhone(inbound.phone);
      if (!lead) {
        ignored++;
        continue;
      }

      const courseConfig = await resolveLeadCourse(lead);
      if (!courseConfig || !lead.whatsappEngagement?.currentQuestionId) {
        ignored++;
        continue;
      }

      const reply = extractReplyFromMessage(inbound.message);
      if (!reply) {
        ignored++;
        continue;
      }

      const currentQuestion = courseConfig.whatsappQuestions.find(
        (question) => question.id === lead.whatsappEngagement?.currentQuestionId
      );
      if (!currentQuestion) {
        ignored++;
        continue;
      }

      const selectedOption = currentQuestion.options.find(
        (option) => option.key === reply.answerKey || option.label.toLowerCase() === reply.answerLabel.toLowerCase()
      );

      const answerKey = selectedOption?.key || reply.answerKey;
      const answerLabel = selectedOption?.label || reply.answerLabel;

      lead.whatsappEngagement.answers = [
        ...(lead.whatsappEngagement.answers || []).filter(
          (answer) => answer.questionId !== currentQuestion.id
        ),
        {
          questionId: currentQuestion.id,
          question: currentQuestion.text,
          answerKey,
          answerLabel,
          source: reply.source,
          answeredAt: new Date(),
        },
      ];

      if (currentQuestion.id === 'preferred_call_slot') {
        await addSystemNote(
          lead,
          `Lead selected preferred call slot: ${answerLabel}.`
        );
      } else {
        await addSystemNote(
          lead,
          `Lead answered "${currentQuestion.text}" with "${answerLabel}".`
        );
      }

      const nextQuestionId = getNextQuestionId(courseConfig, currentQuestion.id);
      if (nextQuestionId) {
        try {
          await sendStructuredQuestionMessage(lead, courseConfig, nextQuestionId);
        } catch (error) {
          await sendStructuredTextFallback(lead, courseConfig, nextQuestionId);
        }
        lead.whatsappEngagement.currentQuestionId = nextQuestionId;
      } else {
        lead.whatsappEngagement.currentQuestionId = '';
        lead.whatsappEngagement.conversationCompletedAt = new Date();
        await addSystemNote(
          lead,
          'WhatsApp qualification flow completed. Sales team can review preferred slot and answer trail on the lead.'
        );
      }

      await lead.save();
      processed++;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown WhatsApp webhook error');
    }
  }

  return { processed, ignored, errors };
};
