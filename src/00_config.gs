/**
 * Voicemail SMS Auto-Reply
 * Provider-neutral Google Apps Script automation for voicemail and missed-call
 * notifications received by email.
 *
 * Secrets are read only from Apps Script Properties. Never paste them here.
 */

const APP = Object.freeze({
  name: 'Voicemail SMS Auto-Reply',
  defaultGmailQuery:
    'label:voicemail-sms-auto-reply -in:spam -in:trash newer_than:30d',
  defaultVoicemailSubjectPattern:
    'voicemail|voice message|voice mail|ηχητικό μήνυμα|φωνητικό μήνυμα',
  defaultMissedCallSubjectPattern:
    'missed call|unanswered call|αναπάντητη κλήση|αναπάντητες κλήσεις',
  openAiUrl: 'https://api.openai.com/v1/audio/transcriptions',
  modulusUrl: 'https://messaging.modulus.gr/ott-api/message',
  telnyxUrl: 'https://api.telnyx.com/v2/messages',
  smsTimeZone: 'Etc/UTC',
  defaultTranscriptionModel: 'gpt-transcribe',
  defaultSmsText:
    'Thank you for your message. I am currently unavailable and will call you back as soon as possible.',
  defaultMissedCallSmsText:
    'Thank you for calling. I am currently unavailable and will call you back as soon as possible.',
  defaultCountryCode: '',
  defaultInboundParser: 'generic_email',
  defaultSmsProvider: 'webhook',
  maxThreadsPerRun: 50,
  maxMessagesPerRun: 10,
  maxAudioBytes: 25 * 1024 * 1024,
  maxNotificationTranscriptChars: 20000,
  defaultStateRetentionDays: 35,
  statePrefix: 'MESSAGE_STATE_',
  phoneReplyPrefix: 'PHONE_REPLY_',
  callTrackingSecretProperty: 'CALL_TRACKING_TOKEN_SECRET',
  callTrackingLabels: Object.freeze({
    pending: 'CALLS/PENDING',
    attempted: 'CALLS/ATTEMPTED',
    completed: 'CALLS/COMPLETED',
    retry: 'CALLS/CALL-BACK',
  }),
  triggerHandler: 'processNewVoicemails',
  terminalStatuses: Object.freeze([
    'sms_sent',
    'test_sms_sent',
    'dry_run',
    'review_required',
    'blocked_by_test_recipient_lock',
    'ignored_existing',
    'suppressed_by_voicemail',
    'suppressed_recent_reply',
    'missed_call_disabled',
  ]),
});

/**
 * First-run setup. Run this once before testing or activating the automation.
 * It deliberately starts in DRY RUN mode and ignores emails already received.
 */
function initializeWithoutSending() {
  const props = PropertiesService.getScriptProperties();
  const defaults = {
    AUTOMATION_ENABLED: 'false',
    SMS_DRY_RUN: 'true',
    TRANSCRIPTION_ENABLED: 'false',
    INTERNAL_NOTIFICATION_INCLUDE_TRANSCRIPT: 'false',
    MISSED_CALLS_ENABLED: 'true',
    SEND_INTERNAL_NOTIFICATION: 'false',
    CALL_TRACKING_ENABLED: 'false',
    CALL_TRACKING_WEB_APP_URL: '',
    CALL_ACTION_MAX_AGE_DAYS: '180',
    INBOUND_PARSER: APP.defaultInboundParser,
    GMAIL_QUERY: APP.defaultGmailQuery,
    VOICEMAIL_SUBJECT_PATTERN: APP.defaultVoicemailSubjectPattern,
    MISSED_CALL_SUBJECT_PATTERN: APP.defaultMissedCallSubjectPattern,
    CALLER_NUMBER_LABELS:
      'caller number|caller|from number|phone number|phone|Από τον αριθμό',
    CALLER_NUMBER_PREFERENCE_PATTERN: '',
    EXCLUDED_PHONE_NUMBERS: '',
    DEFAULT_COUNTRY_CODE: APP.defaultCountryCode,
    ALLOWED_SENDER_EMAILS: '',
    URGENCY_KEYWORDS:
      'urgent|emergency|time-sensitive|as soon as possible|priority',
    SMS_PROVIDER: APP.defaultSmsProvider,
    OPENAI_TRANSCRIPTION_MODEL: APP.defaultTranscriptionModel,
    TRANSCRIPTION_LANGUAGE: '',
    MODULUS_API_URL: APP.modulusUrl,
    TWILIO_API_URL: '',
    VONAGE_API_URL: 'https://rest.nexmo.com/sms/json',
    TELNYX_API_URL: APP.telnyxUrl,
    GENERIC_SMS_API_URL: '',
    GENERIC_SMS_API_OAUTH_TOKEN: '',
    GENERIC_SMS_API_KEY: '',
    SMS_REPLY_TEXT: APP.defaultSmsText,
    MISSED_CALL_SMS_TEXT: APP.defaultMissedCallSmsText,
    SMS_ENCODING: 'gsm',
    SMS_VALIDITY_SECONDS: '86400',
    MISSED_CALL_DELAY_MINUTES: '15',
    PHONE_REPLY_COOLDOWN_HOURS: '24',
    SMS_SEND_WINDOW_ENABLED: 'true',
    SMS_SEND_START_HOUR: '9',
    SMS_SEND_END_HOUR: '21',
    SMS_SEND_TIME_ZONE: APP.smsTimeZone,
    MAX_SMS_SEGMENTS: '1',
    STATE_RETENTION_DAYS: String(APP.defaultStateRetentionDays),
    MAX_MESSAGES_PER_RUN: String(APP.maxMessagesPerRun),
    TEST_RECIPIENT_LOCK_ENABLED: 'false',
  };

  Object.keys(defaults).forEach(function (key) {
    if (props.getProperty(key) === null) {
      props.setProperty(key, defaults[key]);
    }
  });

  const alreadyInitialized = Number.isFinite(
    Date.parse(props.getProperty('ACTIVATED_AT') || '')
  );
  if (!alreadyInitialized) {
    props.setProperty('ACTIVATED_AT', new Date().toISOString());
  }
  props.setProperty('AUTOMATION_ENABLED', 'false');
  props.setProperty('SMS_DRY_RUN', 'true');
  clearLiveConfirmations_();
  ensureCallTrackingSecret_();

  const result = {
    ok: true,
    message:
      'Initialization completed in dry-run mode. Existing emails are ignored and no SMS has been sent.',
    activationTime: props.getProperty('ACTIVATED_AT'),
    notificationEmailConfigured: Boolean(
      props.getProperty('NOTIFICATION_EMAIL')
    ),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Apply the generic email-source preset. Modulus is not required. */
function configureGenericEmailSource() {
  ensureInitialized_();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('INBOUND_PARSER', APP.defaultInboundParser);
  props.setProperty('GMAIL_QUERY', APP.defaultGmailQuery);
  props.setProperty(
    'VOICEMAIL_SUBJECT_PATTERN',
    APP.defaultVoicemailSubjectPattern
  );
  props.setProperty(
    'MISSED_CALL_SUBJECT_PATTERN',
    APP.defaultMissedCallSubjectPattern
  );
  props.setProperty(
    'CALLER_NUMBER_LABELS',
    'caller number|caller|from number|phone number|phone|Από τον αριθμό'
  );
  props.setProperty('CALLER_NUMBER_PREFERENCE_PATTERN', '');
  props.setProperty('EXCLUDED_PHONE_NUMBERS', '');
  props.setProperty('DEFAULT_COUNTRY_CODE', APP.defaultCountryCode);
  props.setProperty('ALLOWED_SENDER_EMAILS', '');
  return getPublicConfigurationSummary_();
}

/** Apply a compatibility preset for Modulus voicemail notification emails. */
function configureModulusEmailPreset() {
  ensureInitialized_();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('INBOUND_PARSER', 'modulus_email');
  props.setProperty(
    'GMAIL_QUERY',
    '{subject:"modulus VoIP Services - Νέο ηχητικό μήνυμα" subject:"modulus VoIP Services - Υπηρεσία Ειδοποίησης Κλήσεων"} -in:spam -in:trash newer_than:30d'
  );
  props.setProperty(
    'VOICEMAIL_SUBJECT_PATTERN',
    '^modulus VoIP Services - Νέο ηχητικό μήνυμα$'
  );
  props.setProperty(
    'MISSED_CALL_SUBJECT_PATTERN',
    '^modulus VoIP Services - Υπηρεσία Ειδοποίησης Κλήσεων$'
  );
  props.setProperty(
    'CALLER_NUMBER_LABELS',
    'Από τον αριθμό|caller number|from number|phone number'
  );
  props.setProperty('CALLER_NUMBER_PREFERENCE_PATTERN', '^\\+3069\\d{8}$');
  props.setProperty('ALLOWED_SENDER_EMAILS', 'no-reply@modulus.gr');
  props.setProperty('DEFAULT_COUNTRY_CODE', '30');
  return getPublicConfigurationSummary_();
}

function getRuntimeConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    inboundParser:
      props.getProperty('INBOUND_PARSER') || APP.defaultInboundParser,
    gmailQuery: props.getProperty('GMAIL_QUERY') || APP.defaultGmailQuery,
    voicemailSubjectPattern:
      props.getProperty('VOICEMAIL_SUBJECT_PATTERN') ||
      APP.defaultVoicemailSubjectPattern,
    missedCallSubjectPattern:
      props.getProperty('MISSED_CALL_SUBJECT_PATTERN') ||
      APP.defaultMissedCallSubjectPattern,
    callerNumberLabels:
      props.getProperty('CALLER_NUMBER_LABELS') ||
      'caller number|caller|from number|phone number|phone|Από τον αριθμό',
    callerNumberPreferencePattern:
      props.getProperty('CALLER_NUMBER_PREFERENCE_PATTERN') || '',
    excludedPhoneNumbers:
      props.getProperty('EXCLUDED_PHONE_NUMBERS') || '',
    allowedSenderEmails:
      props.getProperty('ALLOWED_SENDER_EMAILS') || '',
    defaultCountryCode:
      props.getProperty('DEFAULT_COUNTRY_CODE') || APP.defaultCountryCode,
    smsProvider:
      String(props.getProperty('SMS_PROVIDER') || APP.defaultSmsProvider)
        .trim()
        .toLowerCase(),
    transcriptionEnabled: isTranscriptionEnabled_(),
    includeTranscript: isTrue_(
      props.getProperty('INTERNAL_NOTIFICATION_INCLUDE_TRANSCRIPT')
    ),
    stateRetentionDays: clamp_(
      Number(
        props.getProperty('STATE_RETENTION_DAYS') ||
          APP.defaultStateRetentionDays
      ),
      7,
      180
    ),
  };
}

function getPublicConfigurationSummary_() {
  const config = getRuntimeConfig_();
  return {
    ok: true,
    inboundParser: config.inboundParser,
    smsProvider: config.smsProvider,
    gmailQuery: config.gmailQuery,
    transcriptionEnabled: config.transcriptionEnabled,
    internalTranscriptIncluded: config.includeTranscript,
    defaultCountryCode: config.defaultCountryCode,
    excludedPhoneNumbersConfigured: Boolean(config.excludedPhoneNumbers.trim()),
  };
}
