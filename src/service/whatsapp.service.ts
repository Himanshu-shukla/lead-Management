import axios from 'axios';
import type {
  ICourseAutomationConfig,
  ILead,
  ILeadFormAnswer,
  WhatsAppWebhookMessage,
  WhatsAppWebhookPayload,
} from '../types';

const CONTACT_FIELD_NAMES = new Set([
  'full_name',
  'name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'phone_number',
].map((fieldName) => fieldName.replace(/[_-]+/g, ' ')));

const compactWhitespace = (value?: string): string => (value || '').replace(/\s+/g, ' ').trim();

export const normalizeForMatch = (value?: string): string =>
  compactWhitespace(value).toLowerCase().replace(/[_-]+/g, ' ');

const getGraphApiVersion = (): string => compactWhitespace(process.env.WHATSAPP_GRAPH_API_VERSION) || 'v23.0';

const getPhoneNumberId = (): string => compactWhitespace(process.env.WHATSAPP_PHONE_NUMBER_ID);

const getAccessToken = (): string => compactWhitespace(process.env.WHATSAPP_ACCESS_TOKEN);

const getTemplateName = (): string => compactWhitespace(process.env.WHATSAPP_TEMPLATE_NAME);

const getTemplateLanguageCode = (): string =>
  compactWhitespace(process.env.WHATSAPP_TEMPLATE_LANGUAGE_CODE) || 'en';

const isWarmLeadMessagingEnabled = (): boolean =>
  process.env.WHATSAPP_WARM_LEAD_ENABLED !== 'false';

const normalizePhoneForMeta = (phone?: string): string =>
  compactWhitespace(phone).replace(/[^\d]/g, '');

export const extractMetaFormAnswers = (
  rawFieldData: Array<{ name: string; values: string[] }>
): ILeadFormAnswer[] =>
  rawFieldData
    .map((field) => ({
      question: compactWhitespace(field.name),
      answer: compactWhitespace(field.values.find((value) => compactWhitespace(value) !== '')),
    }))
    .filter(
      (field) =>
        field.question !== '' &&
        field.answer !== '' &&
        !CONTACT_FIELD_NAMES.has(normalizeForMatch(field.question))
    );

export const buildLeadPersonalizationSummary = (answers: ILeadFormAnswer[]): string => {
  const priorityPatterns = [
    'why data analytics',
    'why do you want',
    'why do you wish',
    'domain',
    'career goal',
    'goal',
  ];

  const matched = answers.find(({ question }) =>
    priorityPatterns.some((pattern) => normalizeForMatch(question).includes(pattern))
  );

  return compactWhitespace(matched?.answer || answers[0]?.answer).slice(0, 500);
};

const buildIntroText = (lead: ILead, courseConfig: ICourseAutomationConfig): string => {
  const firstName = compactWhitespace(lead.name).split(' ')[0] || 'there';
  const introLines = [
    `Hi ${firstName}, we've received your interest in our ${courseConfig.courseTitle}.`,
    `Here is the curriculum: ${courseConfig.curriculumUrl}`,
  ];

  if (compactWhitespace(lead.personalizationSummary)) {
    introLines.push(`You mentioned: ${compactWhitespace(lead.personalizationSummary)}`);
  }

  return introLines.join('\n');
};

const getMetaApiUrl = (): string => {
  const phoneNumberId = getPhoneNumberId();
  if (!phoneNumberId) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured');
  }

  return `https://graph.facebook.com/${getGraphApiVersion()}/${phoneNumberId}/messages`;
};

const sendPayload = async (payload: Record<string, unknown>) => {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');
  }

  await axios.post(getMetaApiUrl(), payload, {
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

const sendWarmLeadTemplateMessage = async (
  lead: ILead,
  courseConfig: ICourseAutomationConfig,
  questionId: string
): Promise<void> => {
  const templateName = getTemplateName();
  if (!templateName) {
    throw new Error('WHATSAPP_TEMPLATE_NAME is not configured');
  }

  const question = courseConfig.whatsappQuestions.find((item) => item.id === questionId);
  if (!question || question.options.length < 3) {
    throw new Error('Warm lead template requires the first question to have at least 3 options');
  }

  const personalization = compactWhitespace(lead.personalizationSummary) || 'your learning goals';

  await sendPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneForMeta(lead.phone),
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: getTemplateLanguageCode(),
      },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: courseConfig.courseTitle },
            { type: 'text', text: courseConfig.curriculumUrl },
            { type: 'text', text: personalization },
          ],
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '0',
          parameters: [
            {
              type: 'payload',
              payload: `${question.id}:${question.options[0].key}`,
            },
          ],
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '1',
          parameters: [
            {
              type: 'payload',
              payload: `${question.id}:${question.options[1].key}`,
            },
          ],
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '2',
          parameters: [
            {
              type: 'payload',
              payload: `${question.id}:${question.options[2].key}`,
            },
          ],
        },
      ],
    },
  });
};

export const sendStructuredQuestionMessage = async (
  lead: ILead,
  courseConfig: ICourseAutomationConfig,
  questionId: string,
  includeIntro = false
): Promise<void> => {
  if (!isWarmLeadMessagingEnabled()) {
    throw new Error('WHATSAPP_WARM_LEAD_ENABLED is false');
  }

  if (includeIntro && getTemplateName()) {
    await sendWarmLeadTemplateMessage(lead, courseConfig, questionId);
    return;
  }

  const question = courseConfig.whatsappQuestions.find((item) => item.id === questionId);
  if (!question) {
    throw new Error(`Question "${questionId}" not found on course`);
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneForMeta(lead.phone),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: includeIntro ? `${buildIntroText(lead, courseConfig)}\n\n${question.text}` : question.text,
      },
      footer: {
        text: question.allowsTextReply
          ? 'Choose an option or reply with your preferred date and time.'
          : 'Choose one option to continue.',
      },
      action: {
        buttons: question.options.slice(0, 3).map((option) => ({
          type: 'reply',
          reply: {
            id: `${question.id}:${option.key}`,
            title: option.label.slice(0, 20),
          },
        })),
      },
    },
  };

  await sendPayload(payload);
};

export const sendStructuredTextFallback = async (
  lead: ILead,
  courseConfig: ICourseAutomationConfig,
  questionId: string
): Promise<void> => {
  const question = courseConfig.whatsappQuestions.find((item) => item.id === questionId);
  if (!question) {
    throw new Error(`Question "${questionId}" not found on course`);
  }

  const lines = [question.text];
  for (const option of question.options) {
    lines.push(`${option.key}. ${option.label}`);
  }

  await sendPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneForMeta(lead.phone),
    type: 'text',
    text: {
      preview_url: false,
      body: lines.join('\n'),
    },
  });
};

export const parseWhatsAppWebhookPayload = (
  payload: WhatsAppWebhookPayload
): Array<{ phone: string; message: WhatsAppWebhookMessage }> => {
  const directMessages = payload.messages || [];
  const nestedMessages =
    payload.entry?.flatMap((entry) =>
      (entry.changes || []).flatMap((change) => change.value?.messages || [])
    ) || [];

  const messages = [...directMessages, ...nestedMessages];

  return messages
    .map((message) => ({
      phone: compactWhitespace(message.from),
      message,
    }))
    .filter((entry) => entry.phone !== '');
};

export const extractReplyFromMessage = (
  message: WhatsAppWebhookMessage
): { answerKey: string; answerLabel: string; source: 'interactive' | 'text' } | null => {
  const interactiveReply = message.interactive?.button_reply;

  if (interactiveReply?.id) {
    const [questionId, answerKey] = interactiveReply.id.split(':');
    return {
      answerKey: answerKey || questionId || '',
      answerLabel: compactWhitespace(interactiveReply.title) || compactWhitespace(interactiveReply.id),
      source: 'interactive',
    };
  }

  const quickReplyPayload = compactWhitespace((message.button as { payload?: string; text?: string } | undefined)?.payload);
  if (quickReplyPayload) {
    const [questionId, answerKey] = quickReplyPayload.split(':');
    const buttonText = compactWhitespace((message.button as { payload?: string; text?: string } | undefined)?.text);
    return {
      answerKey: answerKey || questionId || '',
      answerLabel: buttonText || quickReplyPayload,
      source: 'interactive',
    };
  }

  const textBody = compactWhitespace(message.text?.body);
  if (textBody) {
    return {
      answerKey: textBody.toLowerCase(),
      answerLabel: textBody,
      source: 'text',
    };
  }

  return null;
};
