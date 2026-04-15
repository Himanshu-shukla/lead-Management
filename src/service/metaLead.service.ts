import axios from 'axios';
import mongoose from 'mongoose';
import Lead from '../models/Lead';
import User from '../models/User';
import { buildLeadPersonalizationSummary, extractMetaFormAnswers } from './whatsapp.service';
import type {
  ILead,
  MetaLeadDetailResponse,
  MetaLeadFieldData,
  MetaWebhookPayload,
  NormalizedMetaLeadData,
} from '../types';

const META_SOURCE = 'Meta';
const META_FOLDER = 'Meta Lead Ads';
const META_GRAPH_FIELDS = [
  'id',
  'created_time',
  'ad_id',
  'form_id',
  'field_data',
  'campaign_name',
  'adset_name',
  'ad_name',
].join(',');

const normalizeEmail = (value?: string): string => (value || '').trim().toLowerCase();

const normalizePhone = (value?: string): string =>
  (value || '').replace(/[^\d+\-\(\)\.\s]/g, '').replace(/\s+/g, ' ').trim();

const normalizeFieldValue = (value?: string): string => (value || '').trim();

const findFieldValue = (fieldData: MetaLeadFieldData[], candidates: string[]): string => {
  const candidateSet = new Set(candidates.map((candidate) => candidate.toLowerCase()));
  const matchedField = fieldData.find((field) => candidateSet.has(field.name.toLowerCase()));

  if (!matchedField) {
    return '';
  }

  const firstValue = matchedField.values.find((item) => normalizeFieldValue(item) !== '');
  return normalizeFieldValue(firstValue);
};

const buildLeadName = (fieldData: MetaLeadFieldData[]): string => {
  const fullName = findFieldValue(fieldData, ['full_name', 'name']);
  if (fullName) {
    return fullName;
  }

  const firstName = findFieldValue(fieldData, ['first_name']);
  const lastName = findFieldValue(fieldData, ['last_name']);

  return [firstName, lastName].filter(Boolean).join(' ').trim();
};

const normalizeMetaLeadData = (
  leadDetails: MetaLeadDetailResponse,
  fallback: { leadgenId: string; formId?: string; pageId?: string; adId?: string }
): NormalizedMetaLeadData => {
  const fieldData = leadDetails.field_data || [];
  const email = normalizeEmail(findFieldValue(fieldData, ['email']));
  const phone = normalizePhone(findFieldValue(fieldData, ['phone_number', 'phone']));
  const name = buildLeadName(fieldData);

  const normalizedLead: NormalizedMetaLeadData = {
    metaLeadId: leadDetails.id || fallback.leadgenId,
    name,
    email,
    phone,
    rawFieldData: fieldData,
    metaFormAnswers: extractMetaFormAnswers(fieldData),
  };

  const formId = leadDetails.form_id || fallback.formId;
  const pageId = fallback.pageId;
  const adId = leadDetails.ad_id || fallback.adId;
  const campaignName = normalizeFieldValue(leadDetails.campaign_name);
  const adsetName = normalizeFieldValue(leadDetails.adset_name);
  const adName = normalizeFieldValue(leadDetails.ad_name);

  if (formId) {
    normalizedLead.formId = formId;
  }
  if (pageId) {
    normalizedLead.pageId = pageId;
  }
  if (adId) {
    normalizedLead.adId = adId;
  }
  if (campaignName) {
    normalizedLead.campaignName = campaignName;
  }
  if (adsetName) {
    normalizedLead.adsetName = adsetName;
  }
  if (adName) {
    normalizedLead.adName = adName;
  }
  if (leadDetails.created_time) {
    normalizedLead.createdTime = leadDetails.created_time;
  }

  normalizedLead.personalizationSummary = buildLeadPersonalizationSummary(normalizedLead.metaFormAnswers);

  return normalizedLead;
};

const buildMetaAuditNote = (leadData: NormalizedMetaLeadData): string => {
  const details = [
    `Meta lead synced instantly via webhook.`,
    `Lead ID: ${leadData.metaLeadId}`,
    leadData.formId ? `Form ID: ${leadData.formId}` : '',
    leadData.pageId ? `Page ID: ${leadData.pageId}` : '',
    leadData.adId ? `Ad ID: ${leadData.adId}` : '',
    leadData.createdTime ? `Meta Created Time: ${leadData.createdTime}` : '',
  ].filter(Boolean);

  return details.join(' ');
};

const getSystemUserId = async (): Promise<mongoose.Types.ObjectId | null> => {
  const systemUser = await User.findOne({ email: 'system@leadmanager.com' }).select('_id');
  return systemUser?._id ? new mongoose.Types.ObjectId(String(systemUser._id)) : null;
};

const fetchMetaLeadDetails = async (
  leadgenId: string
): Promise<MetaLeadDetailResponse> => {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  const graphApiVersion = process.env.META_GRAPH_API_VERSION || 'v23.0';

  if (!accessToken) {
    const error: NodeJS.ErrnoException = new Error('META_PAGE_ACCESS_TOKEN is not configured');
    error.code = 'META_CONFIG_MISSING';
    throw error;
  }

  const response = await axios.get<MetaLeadDetailResponse>(
    `https://graph.facebook.com/${graphApiVersion}/${leadgenId}`,
    {
      params: {
        access_token: accessToken,
        fields: META_GRAPH_FIELDS,
      },
      timeout: 10000,
    }
  );

  return response.data;
};

const createMetaLead = async (
  leadData: NormalizedMetaLeadData,
  systemUserId: mongoose.Types.ObjectId | null
): Promise<ILead> => {
  const lead = new Lead({
    name: leadData.name,
    email: leadData.email,
    phone: leadData.phone,
    source: META_SOURCE,
    folder: META_FOLDER,
    status: 'New',
    priority: 'Medium',
    campaignName: leadData.campaignName || '',
    adsetName: leadData.adsetName || '',
    adName: leadData.adName || '',
    metaLeadId: leadData.metaLeadId,
    metaFormAnswers: leadData.metaFormAnswers,
    personalizationSummary: leadData.personalizationSummary || '',
    whatsappEngagement: {
      warmIntroStatus: 'pending',
    },
    assignedBy: systemUserId || undefined,
  });

  if (systemUserId) {
    lead.notes.push({
      id: new mongoose.Types.ObjectId().toString(),
      content: buildMetaAuditNote(leadData),
      createdBy: systemUserId,
      createdAt: new Date(),
    });
  }

  await lead.save();
  return lead;
};

const updateLeadFromMeta = async (
  lead: ILead,
  leadData: NormalizedMetaLeadData,
  systemUserId: mongoose.Types.ObjectId | null
): Promise<ILead> => {
  lead.metaLeadId = leadData.metaLeadId;
  lead.source = META_SOURCE;
  lead.folder = lead.folder || META_FOLDER;
  lead.status = lead.status || 'New';
  lead.priority = lead.priority || 'Medium';
  lead.campaignName = leadData.campaignName || lead.campaignName || '';
  lead.adsetName = leadData.adsetName || lead.adsetName || '';
  lead.adName = leadData.adName || lead.adName || '';
  lead.metaFormAnswers = leadData.metaFormAnswers;
  lead.personalizationSummary = leadData.personalizationSummary || lead.personalizationSummary || '';

  if (!lead.name && leadData.name) {
    lead.name = leadData.name;
  }
  if (!lead.email && leadData.email) {
    lead.email = leadData.email;
  }
  if (!lead.phone && leadData.phone) {
    lead.phone = leadData.phone;
  }

  if (!lead.whatsappEngagement) {
    lead.whatsappEngagement = {
      warmIntroStatus: 'pending',
      warmIntroError: '',
    };
  } else if (lead.whatsappEngagement.warmIntroStatus !== 'sent') {
    lead.whatsappEngagement.warmIntroStatus = 'pending';
    lead.whatsappEngagement.warmIntroError = '';
  }

  if (systemUserId) {
    const noteContent = buildMetaAuditNote(leadData);
    const alreadyHasSameNote = lead.notes.some((note) => note.content === noteContent);

    if (!alreadyHasSameNote) {
      lead.notes.push({
        id: new mongoose.Types.ObjectId().toString(),
        content: noteContent,
        createdBy: systemUserId,
        createdAt: new Date(),
      });
    }
  }

  await lead.save();
  return lead;
};

const upsertMetaLead = async (leadData: NormalizedMetaLeadData): Promise<'created' | 'updated' | 'duplicate'> => {
  if (!leadData.name || !leadData.email || !leadData.phone) {
    const error: NodeJS.ErrnoException = new Error('Meta lead is missing required name, email, or phone fields');
    error.code = 'META_REQUIRED_FIELDS_MISSING';
    throw error;
  }

  const systemUserId = await getSystemUserId();
  const existingByMetaLeadId = await Lead.findOne({ metaLeadId: leadData.metaLeadId });
  if (existingByMetaLeadId) {
    return 'duplicate';
  }

  const existingLead = await Lead.findOne({
    $or: [{ email: leadData.email }, { phone: leadData.phone }],
  });

  if (existingLead) {
    await updateLeadFromMeta(existingLead, leadData, systemUserId);
    return 'updated';
  }

  await createMetaLead(leadData, systemUserId);
  return 'created';
};

export const verifyMetaWebhook = (mode?: string, token?: string, challenge?: string): string | null => {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken || mode !== 'subscribe' || !token || token !== verifyToken || !challenge) {
    return null;
  }

  return challenge;
};

export const processMetaWebhookPayload = async (payload: MetaWebhookPayload) => {
  const entries = payload.entry || [];
  let created = 0;
  let updated = 0;
  let duplicate = 0;
  let ignored = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen' || !change.value?.leadgen_id) {
        ignored++;
        continue;
      }

      try {
        const leadDetails = await fetchMetaLeadDetails(change.value.leadgen_id);
        const fallbackIdentifiers: { leadgenId: string; formId?: string; pageId?: string; adId?: string } = {
          leadgenId: change.value.leadgen_id,
        };

        if (change.value.form_id) {
          fallbackIdentifiers.formId = change.value.form_id;
        }
        if (change.value.page_id) {
          fallbackIdentifiers.pageId = change.value.page_id;
        }
        if (change.value.ad_id) {
          fallbackIdentifiers.adId = change.value.ad_id;
        }

        const normalizedLead = normalizeMetaLeadData(leadDetails, fallbackIdentifiers);

        const result = await upsertMetaLead(normalizedLead);

        if (result === 'created') {
          created++;
        } else if (result === 'updated') {
          updated++;
        } else {
          duplicate++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Meta webhook error';
        errors.push(`leadgen_id ${change.value.leadgen_id}: ${message}`);
        console.error('Meta lead processing error:', {
          leadgenId: change.value.leadgen_id,
          error,
        });
      }
    }
  }

  return {
    created,
    updated,
    duplicate,
    ignored,
    errors,
  };
};
