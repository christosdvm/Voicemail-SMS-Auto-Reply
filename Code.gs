/**
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 *
 * Edit the ordered modules in src/ and run `npm run build`.
 * Code.gs remains the copy-paste and clasp-compatible deployment artifact.
 */

// Source: src/00_config.gs

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

// Source: src/10_operations.gs

/**
 * Prepares Gmail labels and a signing secret. It deliberately leaves call
 * tracking disabled until the script has been deployed as a private web app.
 */
function prepareCallTrackingWithoutSending() {
  ensureInitialized_();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('CALL_TRACKING_ENABLED', 'false');
  ensureCallTrackingSecret_();
  ensureCallTrackingLabels_();

  const result = {
    ok: true,
    enabled: false,
    webAppUrlDetected: Boolean(getCallTrackingWebAppUrl_()),
    message:
      'Gmail labels are ready. Call tracking remains disabled until a private web-app deployment is configured.',
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Enable call-status buttons after a private web-app deployment exists. */
function enableCallTracking() {
  ensureInitialized_();
  const props = PropertiesService.getScriptProperties();
  const webAppUrl = getCallTrackingWebAppUrl_();
  if (!webAppUrl) {
    throw new Error(
      'No web-app URL was found. Deploy the script as a private web app first.'
    );
  }
  ensureCallTrackingSecret_();
  ensureCallTrackingLabels_();
  props.setProperty('CALL_TRACKING_ENABLED', 'true');

  const result = {
    ok: true,
    enabled: true,
    webAppUrlConfigured: true,
    message: 'Gmail call tracking is enabled.',
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Disable Gmail call buttons without affecting voicemail/SMS processing. */
function disableCallTracking() {
  PropertiesService.getScriptProperties().setProperty(
    'CALL_TRACKING_ENABLED',
    'false'
  );
  const result = {
    ok: true,
    enabled: false,
    message: 'Gmail call tracking is disabled.',
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Apply the current communication wording and missed-call delay safely. */
function applyCommunicationPolicyUpdate() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SMS_ENCODING', 'gsm');
  props.setProperty('SMS_REPLY_TEXT', APP.defaultSmsText);
  props.setProperty('MISSED_CALL_SMS_TEXT', APP.defaultMissedCallSmsText);
  props.setProperty('MISSED_CALL_DELAY_MINUTES', '15');
  props.setProperty('PHONE_REPLY_COOLDOWN_HOURS', '24');

  const result = {
    ok: true,
    smsEncoding: 'gsm',
    missedCallDelayMinutes: 15,
    phoneReplyCooldownHours: 24,
    voicemailSmsSegments: estimateSmsSegments_(APP.defaultSmsText, 'gsm'),
    missedCallSmsSegments: estimateSmsSegments_(
      APP.defaultMissedCallSmsText,
      'gsm'
    ),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Prepare an inbox test that can target only TEST_PHONE. This never installs
 * a trigger and deliberately keeps SMS_DRY_RUN enabled.
 */
function prepareSingleRecipientTest() {
  ensureInitialized_();
  const props = PropertiesService.getScriptProperties();
  const testPhone = normalizePhoneE164_(
    props.getProperty('TEST_PHONE') || '',
    getRuntimeConfig_().defaultCountryCode
  );
  const triggerCount = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === APP.triggerHandler;
  }).length;

  if (!testPhone) {
    throw new Error('TEST_PHONE must contain a valid recipient number.');
  }
  if (triggerCount) {
    throw new Error('Safe test preparation requires zero active automation triggers.');
  }

  props.setProperty('AUTOMATION_ENABLED', 'false');
  props.setProperty('SMS_DRY_RUN', 'true');
  props.setProperty('TEST_RECIPIENT_LOCK_ENABLED', 'true');
  props.setProperty('TEST_STARTED_AT', new Date().toISOString());
  props.deleteProperty('LIVE_TEST_CONFIRMATION');

  const result = {
    ok: true,
    phoneMasked: maskPhone_(testPhone),
    recipientLockEnabled: true,
    smsDryRun: true,
    triggerCount: 0,
    message:
      'Safe test mode is ready. Only TEST_PHONE is allowed and live delivery has not been armed.',
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * One-shot live inbox test. It requires an explicit confirmation property,
 * zero triggers and the single-recipient lock. DRY RUN is restored in finally.
 */
function runSingleRecipientLiveTest() {
  return runOwnerVoicemailLiveTest();
}

/** Safest one-shot live test: process only the oldest eligible test-recipient voicemail. */
function runOwnerVoicemailLiveTest() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error('Another test or processing run is active. Try again later.');
  }
  try {
    ensureInitialized_();
    const props = PropertiesService.getScriptProperties();
    const testPhone = normalizePhoneE164_(
      props.getProperty('TEST_PHONE') || '',
      getRuntimeConfig_().defaultCountryCode
    );
    const triggerCount = getAutomationTriggerCount_();
    if (!isTrue_(props.getProperty('TEST_RECIPIENT_LOCK_ENABLED')) || !testPhone) {
      throw new Error('Single-recipient test mode has not been prepared correctly.');
    }
    if (triggerCount || isTrue_(props.getProperty('AUTOMATION_ENABLED'))) {
      throw new Error(
        'A live test requires paused automation and zero active triggers.'
      );
    }
    if (props.getProperty('LIVE_TEST_CONFIRMATION') !== 'YES') {
      throw new Error('Set the one-shot LIVE_TEST_CONFIRMATION=YES property first.');
    }
    validateLiveSmsConfiguration_();
    if (!isSmsSendWindowOpen_()) {
      throw new Error('Live tests are allowed only inside the configured SMS send window.');
    }

    const activatedAt = getActivationTimestamp_();
    const messages = flattenMatchingMessages_(
      GmailApp.search(getGmailQueryForType_('voicemail'), 0, APP.maxThreadsPerRun)
    )
      .filter(function (message) {
        return getMessageType_(message.getSubject()) === 'voicemail';
      })
      .filter(function (message) {
        return message.getDate().getTime() > activatedAt;
      })
      .filter(isMessageAllowedForCurrentTest_)
      .filter(function (message) {
        return !isTerminalMessageState_(getMessageState_(message.getId()));
      })
      .sort(function (a, b) {
        return a.getDate().getTime() - b.getDate().getTime();
      });
    if (!messages.length) {
      throw new Error('No new unprocessed voicemail from TEST_PHONE was found.');
    }

    props.deleteProperty('LIVE_TEST_CONFIRMATION');
    props.setProperty('SMS_DRY_RUN', 'false');
    const result = processSingleVoicemail_(messages[0]);
    const redacted = redactProcessingResult_(result);
    console.log(JSON.stringify(redacted, null, 2));
    return redacted;
  } finally {
    PropertiesService.getScriptProperties().setProperty('SMS_DRY_RUN', 'true');
    lock.releaseLock();
  }
}

/**
 * Installs a one-minute trigger in DRY RUN only.
 */
function activateAutomation() {
  const props = PropertiesService.getScriptProperties();
  ensureInitialized_();
  props.setProperty('SMS_DRY_RUN', 'true');
  props.deleteProperty('PRODUCTION_ACTIVATION_CONFIRMATION');

  const validation = validateConfiguration_();
  if (!validation.ok) {
    throw new Error('Automation cannot be activated: ' + validation.errors.join(' | '));
  }

  removeAutomationTriggers_();
  ScriptApp.newTrigger(APP.triggerHandler).timeBased().everyMinutes(1).create();
  props.setProperty('AUTOMATION_ENABLED', 'true');

  const result = {
    ok: true,
    dryRun: true,
    message:
      'Automation is active in dry-run mode. Gmail is checked every minute without sending SMS.',
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Production activation is separate and requires a one-shot confirmation. */
function activateProductionAutomation() {
  ensureInitialized_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error('Another operation is already running. Try again later.');
  }
  const props = PropertiesService.getScriptProperties();
  try {
    if (props.getProperty('PRODUCTION_ACTIVATION_CONFIRMATION') !== 'ENABLE') {
      throw new Error(
        'Set the one-shot PRODUCTION_ACTIVATION_CONFIRMATION=ENABLE property first.'
      );
    }
    validateProductionConfiguration_();
    clearLiveConfirmations_();
    props.setProperties({
      AUTOMATION_ENABLED: 'false',
      SMS_DRY_RUN: 'true',
      TEST_RECIPIENT_LOCK_ENABLED: 'false',
      ACTIVATED_AT: new Date().toISOString(),
    });
    removeAutomationTriggers_();
    try {
      ScriptApp.newTrigger(APP.triggerHandler).timeBased().everyMinutes(1).create();
      props.setProperty('SMS_DRY_RUN', 'false');
      props.setProperty('AUTOMATION_ENABLED', 'true');
    } catch (error) {
      props.setProperty('AUTOMATION_ENABLED', 'false');
      props.setProperty('SMS_DRY_RUN', 'true');
      removeAutomationTriggers_();
      throw error;
    }
    const result = {
      ok: true,
      automationEnabled: true,
      smsDryRun: false,
      activatedAt: props.getProperty('ACTIVATED_AT'),
      triggerCount: getAutomationTriggerCount_(),
      message: 'Production mode is active for newly received emails only.',
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** Pause processing but keep the installed trigger. */
function pauseAutomation() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({ AUTOMATION_ENABLED: 'false', SMS_DRY_RUN: 'true' });
  clearLiveConfirmations_();
  const result = {
    ok: true,
    smsDryRun: true,
    message: 'Automation is paused and SMS delivery is locked.',
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Stop processing and remove the installed trigger. */
function deactivateAutomation() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({ AUTOMATION_ENABLED: 'false', SMS_DRY_RUN: 'true' });
  clearLiveConfirmations_();
  const removed = removeAutomationTriggers_();
  const result = {
    ok: true,
    removedTriggers: removed,
    smsDryRun: true,
    message: 'Automation is disabled and SMS delivery is locked.',
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Entry point used by the time-driven trigger. */
function processNewVoicemails() {
  ensureInitialized_();
  const props = PropertiesService.getScriptProperties();
  if (!isTrue_(props.getProperty('AUTOMATION_ENABLED'))) {
    return { ok: true, skipped: true, reason: 'automation_disabled' };
  }
  if (!isTrue_(props.getProperty('SMS_DRY_RUN'))) {
    validateProductionConfiguration_();
  }
  return processCandidateMessages_(false);
}

/**
 * Manual processing entry point. It uses the same activation time and state,
 * but can be run while the automation is paused. DRY RUN is still respected.
 */
function processNewVoicemailsNow() {
  ensureInitialized_();
  const props = PropertiesService.getScriptProperties();
  if (!isTrue_(props.getProperty('SMS_DRY_RUN'))) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      throw new Error('Another operation is already running. Try again later.');
    }
    try {
      if (props.getProperty('MANUAL_LIVE_CONFIRMATION') !== 'YES') {
        throw new Error(
          'A manual live run requires MANUAL_LIVE_CONFIRMATION=YES.'
        );
      }
      validateProductionConfiguration_();
      if (!isSmsSendWindowOpen_()) {
        throw new Error('Manual live runs are allowed only inside the SMS send window.');
      }
      props.deleteProperty('MANUAL_LIVE_CONFIRMATION');
    } finally {
      lock.releaseLock();
    }
  }
  return processCandidateMessages_(true);
}

/**
 * Safe test of the newest matching email. It never sends SMS and never marks
 * the message as processed. It can transcribe the attachment when configured.
 */
function testLatestMatchingEmail() {
  return testMatchingEmailByOrder_('newest');
}

/**
 * Safe test of the oldest matching voicemail in the active test window.
 * It never sends SMS and never marks the message as processed.
 */
function testOldestMatchingEmail() {
  return testMatchingEmailByOrder_('oldest');
}

function testMatchingEmailByOrder_(order) {
  ensureInitialized_();
  const threads = GmailApp.search(
    getGmailQueryForType_('voicemail'),
    0,
    APP.maxThreadsPerRun
  );
  const messages = flattenMatchingMessages_(threads)
    .filter(function (message) {
      return getMessageType_(message.getSubject()) === 'voicemail';
    })
    .filter(isMessageAllowedForCurrentTest_)
    .sort(function (a, b) {
      const delta = a.getDate().getTime() - b.getDate().getTime();
      return order === 'oldest' ? delta : -delta;
    });

  if (!messages.length) {
    throw new Error(
      'No new voicemail email was found for the allowed test recipient.'
    );
  }

  const message = messages[0];
  const parsed = parseVoicemailMessage_(message);
  const transcription = attemptTranscription_(parsed.audio);

  const result = {
    ok: Boolean(parsed.phoneE164),
    smsSent: false,
    dryRun: true,
    phoneMasked: maskPhone_(parsed.phoneE164),
    audioFilename: parsed.audio ? parsed.audio.getName() : '',
    transcriptAvailable: Boolean(transcription.transcript),
    transcriptCharacters: Array.from(transcription.transcript || '').length,
    transcriptionError: transcription.error,
    subject: message.getSubject(),
  };

  attemptInternalNotification_(message, parsed, {
    status: 'safe_test',
    smsResult: { accepted: false, dryRun: true, providerMessageId: '' },
    transcript: transcription.transcript,
    transcriptionError: transcription.error,
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Safe parser test for the newest missed-call email. No SMS or email is sent. */
function testLatestMissedCallEmail() {
  ensureInitialized_();
  const threads = GmailApp.search(
    getGmailQueryForType_('missed_call'),
    0,
    APP.maxThreadsPerRun
  );
  const messages = flattenMatchingMessages_(threads)
    .filter(function (message) {
      return getMessageType_(message.getSubject()) === 'missed_call';
    })
    .filter(isMessageAllowedForCurrentTest_)
    .sort(function (a, b) {
      return b.getDate().getTime() - a.getDate().getTime();
    });

  if (!messages.length) {
    throw new Error('No matching missed-call email was found.');
  }

  const message = messages[0];
  const parsed = parseVoicemailMessage_(message);
  const result = {
    ok: Boolean(parsed.phoneE164),
    smsSent: false,
    dryRun: true,
    messageType: 'missed_call',
    phoneMasked: maskPhone_(parsed.phoneE164),
    ageMinutes: Math.max(
      0,
      Math.floor((Date.now() - message.getDate().getTime()) / 60000)
    ),
    subject: message.getSubject(),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Live provider test. This sends one real SMS only when the user has set
 * LIVE_TEST_CONFIRMATION=YES and TEST_PHONE in Script Properties.
 */
function testModulusSms() {
  return testSmsProvider();
}

/** Provider-neutral live SMS test. It is guarded by an explicit confirmation. */
function testSmsProvider() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('LIVE_TEST_CONFIRMATION') !== 'YES') {
    throw new Error('Set LIVE_TEST_CONFIRMATION=YES for a one-shot live test.');
  }

  const phone = normalizePhoneE164_(
    props.getProperty('TEST_PHONE') || '',
    getRuntimeConfig_().defaultCountryCode
  );
  if (!phone) {
    throw new Error('TEST_PHONE is not a valid phone number.');
  }

  validateLiveSmsConfiguration_();
  props.deleteProperty('LIVE_TEST_CONFIRMATION');
  const result = sendSms_(
    phone,
    'Voicemail SMS Auto-Reply provider test. No action is required.',
    'manual-live-test'
  );
  console.log(JSON.stringify(redactSmsResult_(result), null, 2));
  return redactSmsResult_(result);
}

/** Show safe/redacted operational status. */
function showStatus() {
  ensureInitialized_();
  const props = PropertiesService.getScriptProperties();
  const validation = validateConfiguration_();
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === APP.triggerHandler;
  }).length;

  const status = {
    automationEnabled: isTrue_(props.getProperty('AUTOMATION_ENABLED')),
    smsDryRun: isTrue_(props.getProperty('SMS_DRY_RUN')),
    transcriptionEnabled: isTranscriptionEnabled_(),
    internalTranscriptIncluded: isTrue_(
      props.getProperty('INTERNAL_NOTIFICATION_INCLUDE_TRANSCRIPT')
    ),
    missedCallsEnabled: isTrue_(props.getProperty('MISSED_CALLS_ENABLED')),
    smsEncoding: getSmsEncoding_(),
    smsSendWindow: getSmsSendWindow_(),
    missedCallDelayMinutes: clamp_(
      Number(props.getProperty('MISSED_CALL_DELAY_MINUTES') || 15),
      1,
      60
    ),
    phoneReplyCooldownHours: clamp_(
      Number(props.getProperty('PHONE_REPLY_COOLDOWN_HOURS') || 24),
      1,
      168
    ),
    activatedAt: props.getProperty('ACTIVATED_AT') || '',
    stateRetentionDays: getRuntimeConfig_().stateRetentionDays,
    allowedSenderEmailsConfigured: Boolean(
      String(props.getProperty('ALLOWED_SENDER_EMAILS') || '').trim()
    ),
    triggerCount: triggers,
    openAiKeyConfigured: Boolean(props.getProperty('OPENAI_API_KEY')),
    smsProvider: getSmsProvider_(),
    smsProviderConfigured: isSmsProviderConfigured_(),
    modulusKeyConfigured: Boolean(props.getProperty('MODULUS_API_KEY')),
    senderConfigured: Boolean(props.getProperty('SMS_SENDER_ID')),
    notificationEmailConfigured: Boolean(
      props.getProperty('NOTIFICATION_EMAIL')
    ),
    callTrackingEnabled: isTrue_(
      props.getProperty('CALL_TRACKING_ENABLED')
    ),
    callTrackingWebAppConfigured: Boolean(getCallTrackingWebAppUrl_()),
    testRecipientLockEnabled: isTrue_(
      props.getProperty('TEST_RECIPIENT_LOCK_ENABLED')
    ),
    testPhoneConfigured: Boolean(
      normalizePhoneE164_(
        props.getProperty('TEST_PHONE') || '',
        getRuntimeConfig_().defaultCountryCode
      )
    ),
    testStartConfigured: Boolean(props.getProperty('TEST_STARTED_AT')),
    voicemailSmsSegments: estimateSmsSegments_(
      getSmsReplyText_(),
      getSmsEncoding_()
    ),
    missedCallSmsSegments: estimateSmsSegments_(
      getMissedCallSmsText_(),
      getSmsEncoding_()
    ),
    valid: validation.ok,
    warnings: validation.warnings,
    errors: validation.errors,
  };
  console.log(JSON.stringify(status, null, 2));
  return status;
}

/** Offline self-tests. No email, OpenAI, or SMS request is made. */
function runSelfTests() {
  const tests = [];
  function expect(name, actual, expected) {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    tests.push({ name: name, pass: pass, actual: actual, expected: expected });
    if (!pass) {
      throw new Error(
        name + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)
      );
    }
  }

  expect(
    'phone from Greek label',
    extractPhoneFromText_('Από τον αριθμό: 6980000001'),
    '+306980000001'
  );
  expect(
    'phone from missed-call sample',
    extractPhoneFromText_(
      'Αγαπητέ συνδρομητή, είχατε μια εισερχόμενη κλήση. Από τον αριθμό: 6932024022 Προς τον αριθμό: 00302118001111'
    ),
    '+306932024022'
  );
  expect(
    'phone with country code',
    extractPhoneFromText_('Από τον αριθμό: +30 698 000 0002'),
    '+306980000002'
  );
  expect(
    'phone from attachment filename',
    extractPhoneFromFilename_('00302118001111-6980000003-20260907-181425.wav'),
    '+306980000003'
  );
  expect('reject landline', normalizeGreekMobile_('2108001111'), '');
  expect(
    'exact subject',
    isMatchingSubject_('modulus VoIP Services - Νέο ηχητικό μήνυμα'),
    true
  );
  expect(
    'exact missed-call subject',
    getMessageType_('modulus VoIP Services - Υπηρεσία Ειδοποίησης Κλήσεων'),
    'missed_call'
  );
  expect(
    'reject reply subject',
    isMatchingSubject_('Re: modulus VoIP Services - Νέο ηχητικό μήνυμα'),
    false
  );
  expect(
    'transcript never changes client SMS',
    buildClientSms_('πρώτη μεταγραφή'),
    buildClientSms_('εντελώς διαφορετική μεταγραφή')
  );
  expect(
    'voicemail reply fits one GSM SMS',
    estimateSmsSegments_(APP.defaultSmsText, 'gsm'),
    1
  );
  expect(
    'missed-call reply fits one GSM SMS',
    estimateSmsSegments_(APP.defaultMissedCallSmsText, 'gsm'),
    1
  );
  expect(
    'notification HTML is escaped',
    escapeHtml_('<script>"&\''),
    '&lt;script&gt;&quot;&amp;&#39;'
  );
  expect(
    'signed values use exact comparison',
    constantTimeEqual_('abc123', 'abc123') &&
      !constantTimeEqual_('abc123', 'abc124'),
    true
  );
  expect(
    'test recipient lock allows configured phone',
    recipientMatchesTestPhone_('+306980000007', '6980000007'),
    true
  );
  expect(
    'test recipient lock blocks every other phone',
    recipientMatchesTestPhone_('+306980000001', '6980000007'),
    false
  );
  expect(
    'same phone is suppressed inside 24-hour cooldown',
    isWithinReplyCooldown_(1000000, 1000000 + 23 * 3600000, 24),
    true
  );
  expect(
    'same phone is eligible after 24-hour cooldown',
    isWithinReplyCooldown_(1000000, 1000000 + 24 * 3600000, 24),
    false
  );

  const result = { ok: true, passed: tests.length, tests: tests };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// Source: src/20_processor.gs

function processCandidateMessages_(manualRun) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return { ok: true, skipped: true, reason: 'another_run_in_progress' };
  }

  try {
    const props = PropertiesService.getScriptProperties();
    maybeCleanupState_();
    const activatedAt = getActivationTimestamp_();
    const testLockEnabled = isTrue_(
      props.getProperty('TEST_RECIPIENT_LOCK_ENABLED')
    );
    const maxMessages = clamp_(
      Number(props.getProperty('MAX_MESSAGES_PER_RUN') || APP.maxMessagesPerRun),
      1,
      20
    );
    const threads = GmailApp.search(
      getRuntimeConfig_().gmailQuery,
      0,
      APP.maxThreadsPerRun
    );
    const allMessages = flattenMatchingMessages_(threads);
    const candidates = allMessages
      .filter(function (message) {
        return message.getDate().getTime() > activatedAt;
      })
      .filter(function (message) {
        return !testLockEnabled || isMessageAllowedForCurrentTest_(message);
      })
      .filter(function (message) {
        return !isTerminalMessageState_(getMessageState_(message.getId()));
      })
      .sort(function (a, b) {
        return a.getDate().getTime() - b.getDate().getTime();
      })
      .slice(0, maxMessages);

    const results = [];
    candidates.forEach(function (message) {
      try {
        const messageType = getMessageType_(message.getSubject());
        if (messageType === 'missed_call') {
          if (isTrue_(props.getProperty('MISSED_CALLS_ENABLED'))) {
            results.push(processSingleMissedCall_(message, allMessages));
          } else {
            const state = {
              messageId: message.getId(),
              status: 'missed_call_disabled',
              updatedAt: new Date().toISOString(),
            };
            setMessageState_(message.getId(), state);
            results.push(state);
          }
        } else if (messageType === 'voicemail') {
          results.push(processSingleVoicemail_(message));
        }
      } catch (error) {
        const failure = {
          messageId: message.getId(),
          status: 'review_required',
          error: safeErrorMessage_(error),
          updatedAt: new Date().toISOString(),
        };
        try {
          setMessageState_(message.getId(), failure);
        } catch (stateError) {
          failure.stateSaveError = safeErrorMessage_(stateError);
        }
        try {
          const parsed = parseVoicemailMessage_(message);
          const notification = attemptInternalNotification_(message, parsed, {
            status: failure.status,
            smsResult: null,
            transcript: '',
            transcriptionError: '',
            processingError:
              failure.error +
              (failure.stateSaveError
                ? ' | State could not be saved: ' + failure.stateSaveError
                : ''),
          });
          failure.notificationSent = notification.sent;
          failure.notificationError = notification.error;
        } catch (notificationError) {
          failure.notificationError = safeErrorMessage_(notificationError);
        }
        results.push(failure);
      }
    });

    const result = {
      ok: true,
      manualRun: Boolean(manualRun),
      found: candidates.length,
      results: results.map(redactProcessingResult_),
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function processSingleVoicemail_(message) {
  const messageId = message.getId();
  const parsed = parseVoicemailMessage_(message);
  const startedAt = new Date().toISOString();

  setMessageState_(messageId, {
    messageId: messageId,
    status: 'processing',
    phoneMasked: maskPhone_(parsed.phoneE164),
    startedAt: startedAt,
    updatedAt: startedAt,
  });

  if (!parsed.phoneE164) {
    const transcription = attemptTranscription_(parsed.audio);
    const state = {
      messageId: messageId,
      status: 'review_required',
      reason: 'phone_not_found_or_not_supported',
      updatedAt: new Date().toISOString(),
    };
    setMessageState_(messageId, state);
    attemptInternalNotification_(message, parsed, {
      status: state.status,
      smsResult: null,
      transcript: transcription.transcript,
      transcriptionError: transcription.error,
    });
    return state;
  }

  if (!isSmsRecipientAllowed_(parsed.phoneE164)) {
    const state = {
      messageId: messageId,
      status: 'blocked_by_test_recipient_lock',
      phoneMasked: maskPhone_(parsed.phoneE164),
      reason: 'recipient_not_equal_to_test_phone',
      updatedAt: new Date().toISOString(),
    };
    setMessageState_(messageId, state);
    attemptInternalNotification_(message, parsed, {
      status: state.status,
      smsResult: null,
      transcript: '',
      transcriptionError: 'Transcription was skipped because the test-recipient lock is active.',
    });
    return state;
  }

  if (shouldDeferLiveSms_()) {
    return deferMessageUntilSmsWindow_(messageId, parsed.phoneE164);
  }

  if (hasRecentSuccessfulReply_(parsed.phoneE164)) {
    const transcription = attemptTranscription_(parsed.audio);
    const state = {
      messageId: messageId,
      status: 'suppressed_recent_reply',
      phoneMasked: maskPhone_(parsed.phoneE164),
      reason: 'same_number_replied_within_cooldown',
      updatedAt: new Date().toISOString(),
    };
    setMessageState_(messageId, state);
    attemptInternalNotification_(message, parsed, {
      status: state.status,
      smsResult: null,
      transcript: transcription.transcript,
      transcriptionError: transcription.error,
    });
    return state;
  }

  const smsText = buildClientSms_();
  const dryRun = isTrue_(
    PropertiesService.getScriptProperties().getProperty('SMS_DRY_RUN')
  );
  let smsResult;

  if (dryRun) {
    smsResult = {
      accepted: false,
      dryRun: true,
      providerMessageId: '',
      providerStatus: 'DRY_RUN',
    };
  } else {
    validateLiveSmsConfiguration_();
    setMessageState_(messageId, {
      messageId: messageId,
      status: 'sending',
      phoneMasked: maskPhone_(parsed.phoneE164),
      updatedAt: new Date().toISOString(),
      note: 'Do not automatically retry this state; delivery may be uncertain.',
    });
    reserveReply_(parsed.phoneE164, messageId, 'voicemail');
    try {
      smsResult = sendSms_(parsed.phoneE164, smsText, messageId);
    } catch (error) {
      const transcription = attemptTranscription_(parsed.audio);
      const state = {
        messageId: messageId,
        status: 'review_required',
        phoneMasked: maskPhone_(parsed.phoneE164),
        reason: 'sms_failed_or_delivery_uncertain',
        error: safeErrorMessage_(error),
        updatedAt: new Date().toISOString(),
      };
      setMessageState_(messageId, state);
      attemptInternalNotification_(message, parsed, {
        status: state.status,
        smsResult: null,
        transcript: transcription.transcript,
        transcriptionError: transcription.error,
        processingError: state.error,
      });
      return state;
    }
  }

  const terminalStatus = dryRun ? 'dry_run' : 'sms_sent';
  setMessageState_(messageId, {
    messageId: messageId,
    status: terminalStatus,
    phoneMasked: maskPhone_(parsed.phoneE164),
    providerMessageId: smsResult.providerMessageId || '',
    providerStatus: smsResult.providerStatus || '',
    updatedAt: new Date().toISOString(),
  });
  if (!dryRun) {
    try {
      recordSuccessfulReply_(parsed.phoneE164, messageId, 'voicemail');
    } catch (error) {
      console.warn('Could not record successful SMS: ' + safeErrorMessage_(error));
    }
  }

  const transcription = attemptTranscription_(parsed.audio);

  const notification = attemptInternalNotification_(message, parsed, {
    status: terminalStatus,
    smsResult: smsResult,
    transcript: transcription.transcript,
    transcriptionError: transcription.error,
  });

  return {
    messageId: messageId,
    status: terminalStatus,
    phoneMasked: maskPhone_(parsed.phoneE164),
    audioFound: Boolean(parsed.audio),
    transcriptAvailable: Boolean(transcription.transcript),
    priorityKeywordsDetected: detectUrgency_(transcription.transcript),
    providerMessageId: smsResult.providerMessageId || '',
    notificationSent: notification.sent,
    notificationError: notification.error,
  };
}

function processSingleMissedCall_(message, allMessages) {
  const messageId = message.getId();
  const parsed = parseVoicemailMessage_(message);
  parsed.messageType = 'missed_call';
  const props = PropertiesService.getScriptProperties();
  const startedAt = new Date().toISOString();

  setMessageState_(messageId, {
    messageId: messageId,
    status: 'processing',
    phoneMasked: maskPhone_(parsed.phoneE164),
    startedAt: startedAt,
    updatedAt: startedAt,
  });

  if (!parsed.phoneE164) {
    const state = {
      messageId: messageId,
      status: 'review_required',
      reason: 'phone_not_found_or_not_supported',
      updatedAt: new Date().toISOString(),
    };
    setMessageState_(messageId, state);
    return state;
  }

  if (!isSmsRecipientAllowed_(parsed.phoneE164)) {
    const state = {
      messageId: messageId,
      status: 'blocked_by_test_recipient_lock',
      phoneMasked: maskPhone_(parsed.phoneE164),
      reason: 'recipient_not_equal_to_test_phone',
      updatedAt: new Date().toISOString(),
    };
    setMessageState_(messageId, state);
    return state;
  }

  if (shouldDeferLiveSms_()) {
    return deferMessageUntilSmsWindow_(messageId, parsed.phoneE164);
  }

  const delayMinutes = clamp_(
    Number(props.getProperty('MISSED_CALL_DELAY_MINUTES') || 15),
    1,
    60
  );
  const ageMs = Date.now() - message.getDate().getTime();
  if (ageMs < delayMinutes * 60000) {
    const state = {
      messageId: messageId,
      status: 'waiting_for_voicemail',
      phoneMasked: maskPhone_(parsed.phoneE164),
      retryAfter: new Date(
        message.getDate().getTime() + delayMinutes * 60000
      ).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMessageState_(messageId, state);
    return state;
  }

  if (hasRelatedVoicemail_(message, parsed.phoneE164, allMessages)) {
    const state = {
      messageId: messageId,
      status: 'suppressed_by_voicemail',
      phoneMasked: maskPhone_(parsed.phoneE164),
      reason: 'voicemail_received_for_same_call',
      updatedAt: new Date().toISOString(),
    };
    setMessageState_(messageId, state);
    return state;
  }

  if (hasRecentSuccessfulReply_(parsed.phoneE164)) {
    const state = {
      messageId: messageId,
      status: 'suppressed_recent_reply',
      phoneMasked: maskPhone_(parsed.phoneE164),
      reason: 'same_number_replied_within_cooldown',
      updatedAt: new Date().toISOString(),
    };
    setMessageState_(messageId, state);
    return state;
  }

  const smsText = getMissedCallSmsText_();
  const dryRun = isTrue_(props.getProperty('SMS_DRY_RUN'));
  let smsResult;
  if (dryRun) {
    smsResult = {
      accepted: false,
      dryRun: true,
      providerMessageId: '',
      providerStatus: 'DRY_RUN',
    };
  } else {
    validateLiveSmsConfiguration_();
    setMessageState_(messageId, {
      messageId: messageId,
      status: 'sending',
      phoneMasked: maskPhone_(parsed.phoneE164),
      updatedAt: new Date().toISOString(),
      note: 'Do not automatically retry this state; delivery may be uncertain.',
    });
    reserveReply_(parsed.phoneE164, messageId, 'missed_call');
    try {
      smsResult = sendSms_(parsed.phoneE164, smsText, messageId);
    } catch (error) {
      const state = {
        messageId: messageId,
        status: 'review_required',
        phoneMasked: maskPhone_(parsed.phoneE164),
        reason: 'sms_failed_or_delivery_uncertain',
        error: safeErrorMessage_(error),
        updatedAt: new Date().toISOString(),
      };
      setMessageState_(messageId, state);
      const notification = attemptInternalNotification_(message, parsed, {
        status: state.status,
        smsResult: null,
        transcript: '',
        transcriptionError: '',
        processingError: state.error,
      });
      state.notificationSent = notification.sent;
      state.notificationError = notification.error;
      return state;
    }
  }

  const terminalStatus = dryRun ? 'dry_run' : 'sms_sent';
  setMessageState_(messageId, {
    messageId: messageId,
    status: terminalStatus,
    phoneMasked: maskPhone_(parsed.phoneE164),
    providerMessageId: smsResult.providerMessageId || '',
    providerStatus: smsResult.providerStatus || '',
    updatedAt: new Date().toISOString(),
  });
  if (!dryRun) {
    try {
      recordSuccessfulReply_(parsed.phoneE164, messageId, 'missed_call');
    } catch (error) {
      console.warn('Could not record successful SMS: ' + safeErrorMessage_(error));
    }
  }

  const notification = attemptInternalNotification_(message, parsed, {
    status: terminalStatus,
    smsResult: smsResult,
    transcript: '',
    transcriptionError: '',
  });

  return {
    messageId: messageId,
    status: terminalStatus,
    phoneMasked: maskPhone_(parsed.phoneE164),
    audioFound: false,
    transcriptAvailable: false,
    priorityKeywordsDetected: false,
    providerMessageId: smsResult.providerMessageId || '',
    notificationSent: notification.sent,
    notificationError: notification.error,
  };
}

function hasRelatedVoicemail_(missedCallMessage, phoneE164, allMessages) {
  const missedAt = missedCallMessage.getDate().getTime();
  const latestRelatedAt = missedAt + 30 * 60000;
  return allMessages.some(function (candidate) {
    if (getMessageType_(candidate.getSubject()) !== 'voicemail') return false;
    const receivedAt = candidate.getDate().getTime();
    if (receivedAt < missedAt - 60000 || receivedAt > latestRelatedAt) return false;
    return parseVoicemailMessage_(candidate).phoneE164 === phoneE164;
  });
}

function flattenMatchingMessages_(threads) {
  const messages = [];
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      if (isTrustedInboundMessage_(message)) {
        messages.push(message);
      }
    });
  });
  return messages;
}

/**
 * Optional exact sender allowlisting. An empty allowlist keeps the adapter
 * provider-neutral and relies on the configured Gmail query and subject
 * patterns instead.
 */
function isTrustedInboundMessage_(message) {
  if (!message || !isMatchingSubject_(message.getSubject())) return false;
  const configured = String(
    getRuntimeConfig_().allowedSenderEmails || ''
  ).trim();
  if (!configured) return true;

  const allowed = configured
    .split(/[|,]/)
    .map(function (email) {
      return email.trim().toLowerCase();
    })
    .filter(Boolean);
  const from = String(message.getFrom ? message.getFrom() : '').toLowerCase();
  const matches =
    from.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/g) || [];
  return matches.some(function (email) {
    return allowed.indexOf(email) !== -1;
  });
}

/** Compatibility helper for tests and the Modulus preset only. */
function isTrustedModulusMessage_(message) {
  if (!message || !isMatchingSubject_(message.getSubject())) return false;
  const from = String(message.getFrom ? message.getFrom() : '').toLowerCase();
  const matches =
    from.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/g) || [];
  return matches.indexOf('no-reply@modulus.gr') !== -1;
}

function isMatchingSubject_(subject) {
  return Boolean(getMessageType_(subject));
}

function getMessageType_(subject) {
  const normalized = normalizeWhitespace_(subject);
  const config = getRuntimeConfig_();
  if (matchesConfiguredPattern_(normalized, config.voicemailSubjectPattern)) {
    return 'voicemail';
  }
  if (matchesConfiguredPattern_(normalized, config.missedCallSubjectPattern)) {
    return 'missed_call';
  }
  return '';
}

function getGmailQueryForType_(messageType) {
  const props = PropertiesService.getScriptProperties();
  const specificKey =
    messageType === 'missed_call'
      ? 'MISSED_CALL_GMAIL_QUERY'
      : 'VOICEMAIL_GMAIL_QUERY';
  return props.getProperty(specificKey) || getRuntimeConfig_().gmailQuery;
}

// Source: src/30_parsing.gs

function matchesConfiguredPattern_(value, pattern) {
  const candidate = String(pattern || '').trim();
  if (!candidate) return false;
  if (/^(?:re|fw|fwd)\s*:/iu.test(String(value || ''))) return false;
  try {
    return new RegExp(candidate, 'iu').test(String(value || ''));
  } catch (error) {
    return false;
  }
}

function parseVoicemailMessage_(message) {
  const plainBody = message.getPlainBody ? message.getPlainBody() : '';
  const htmlBody = message.getBody ? message.getBody() : '';
  const bodyText = normalizeWhitespace_(plainBody || htmlToText_(htmlBody));
  const attachments = message.getAttachments({
    includeInlineImages: false,
    includeAttachments: true,
  });
  const audio = findSupportedAudioAttachment_(attachments);

  let phone = extractPhoneFromText_(bodyText);
  if (!phone) {
    for (let i = 0; i < attachments.length && !phone; i += 1) {
      phone = extractPhoneFromFilename_(attachments[i].getName());
    }
  }
  if (!phone && message.getFrom) {
    phone = extractPhoneFromText_(message.getFrom());
  }

  return {
    phoneE164: phone,
    bodyText: bodyText,
    audio: audio,
    messageType: getMessageType_(message.getSubject()),
  };
}

function extractPhoneFromText_(text) {
  const value = String(text || '');
  const config = getRuntimeConfig_();
  const labels = String(config.callerNumberLabels || '')
    .split('|')
    .map(function (label) {
      return escapeRegExp_(label.trim());
    })
    .filter(Boolean)
    .join('|');
  if (labels) {
    const labelMatch = value.match(
      new RegExp(
        '(?:' +
          labels +
          ')\\s*[:#-]?\\s*((?:\\+|00)?[0-9][0-9\\s().-]{6,}[0-9])',
        'iu'
      )
    );
    if (labelMatch) {
      const labeledPhone = normalizePhoneE164_(
        labelMatch[1],
        config.defaultCountryCode
      );
      if (labeledPhone && !isExcludedPhone_(labeledPhone)) return labeledPhone;
    }
  }
  return extractAnyPhone_(value, config.defaultCountryCode);
}

function extractPhoneFromFilename_(filename) {
  const value = String(filename || '');
  const config = getRuntimeConfig_();
  const candidates = []
    .concat(value.match(/(?:\+|00)\s*\d[\d\s().]{6,}\d/g) || [])
    .concat(value.match(/(?:^|[^0-9])\d{8,15}(?=[^0-9]|$)/g) || []);
  const normalized = candidates
    .map(function (candidate) {
      return normalizePhoneE164_(candidate, config.defaultCountryCode);
    })
    .filter(function (phone) {
      return phone && !isExcludedPhone_(phone);
    });
  return selectPreferredCallerNumber_(normalized);
}

function extractAnyGreekMobile_(text) {
  const match = String(text || '').match(
    /(?:^|\D)((?:(?:\+|00)30[\s().-]*)?69(?:[\s().-]*\d){8})(?!\d)/
  );
  return match ? normalizeGreekMobile_(match[1]) : '';
}

function normalizeGreekMobile_(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.indexOf('0030') === 0) digits = digits.slice(4);
  if (digits.indexOf('30') === 0 && digits.length === 12) digits = digits.slice(2);
  return /^69\d{8}$/.test(digits) ? '+30' + digits : '';
}

/** Normalize an international or local phone number to E.164. */
function normalizePhoneE164_(raw, defaultCountryCode) {
  let value = String(raw || '').trim();
  if (!value) return '';
  let digits = value.replace(/[^\d]/g, '');
  if (value.indexOf('+') === 0 || digits.indexOf('00') === 0) {
    if (digits.indexOf('00') === 0) digits = digits.slice(2);
  } else {
    const country = String(defaultCountryCode || APP.defaultCountryCode).replace(
      /\D/g,
      ''
    );
    if (!country) return '';
    if (digits.indexOf('0') === 0) digits = digits.slice(1);
    digits = country + digits;
  }
  return /^\d{8,15}$/.test(digits) ? '+' + digits : '';
}

function extractAnyPhone_(text, defaultCountryCode) {
  const candidates =
    String(text || '').match(/(?:\+|00)?\d[\d\s().-]{6,}\d/g) || [];
  const normalized = candidates
    .map(function (candidate) {
      return normalizePhoneE164_(candidate, defaultCountryCode);
    })
    .filter(function (phone) {
      return phone && !isExcludedPhone_(phone);
    });
  return selectPreferredCallerNumber_(normalized);
}

/**
 * Select a caller deterministically when a provider exposes more than one
 * number. A provider preset may supply a regex; generic mode keeps source
 * order and lets EXCLUDED_PHONE_NUMBERS remove known destination numbers.
 */
function selectPreferredCallerNumber_(phones) {
  const unique = (phones || []).filter(function (phone, index, all) {
    return phone && all.indexOf(phone) === index;
  });
  const pattern = getRuntimeConfig_().callerNumberPreferencePattern;
  if (pattern) {
    try {
      const matcher = new RegExp(pattern);
      const preferred = unique.find(function (phone) {
        return matcher.test(phone);
      });
      if (preferred) return preferred;
    } catch (error) {
      // Invalid optional preferences fail back to deterministic source order.
    }
  }
  return unique[0] || '';
}

function isExcludedPhone_(phoneE164) {
  const config = getRuntimeConfig_();
  const excluded = String(config.excludedPhoneNumbers || '')
    .split(/[|,]/)
    .map(function (phone) {
      return normalizePhoneE164_(phone, config.defaultCountryCode);
    })
    .filter(Boolean);
  return excluded.indexOf(phoneE164) !== -1;
}

function escapeRegExp_(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function recipientMatchesTestPhone_(recipient, testPhone) {
  const country = getRuntimeConfig_().defaultCountryCode;
  const normalizedRecipient = normalizePhoneE164_(recipient, country);
  const normalizedTestPhone = normalizePhoneE164_(testPhone, country);
  return Boolean(
    normalizedRecipient &&
      normalizedTestPhone &&
      normalizedRecipient === normalizedTestPhone
  );
}

function isSmsRecipientAllowed_(recipient) {
  const props = PropertiesService.getScriptProperties();
  if (!isTrue_(props.getProperty('TEST_RECIPIENT_LOCK_ENABLED'))) return true;
  return recipientMatchesTestPhone_(
    recipient,
    props.getProperty('TEST_PHONE') || ''
  );
}

function isMessageAllowedForCurrentTest_(message) {
  const props = PropertiesService.getScriptProperties();
  if (!isTrue_(props.getProperty('TEST_RECIPIENT_LOCK_ENABLED'))) return true;

  const testStartedAt = Date.parse(props.getProperty('TEST_STARTED_AT') || '');
  if (
    Number.isFinite(testStartedAt) &&
    message.getDate().getTime() <= testStartedAt
  ) {
    return false;
  }
  return isSmsRecipientAllowed_(parseVoicemailMessage_(message).phoneE164);
}

// Source: src/40_transcription.gs

function findSupportedAudioAttachment_(attachments) {
  const supportedExtensions = /\.(wav|mp3|mp4|mpeg|mpga|m4a|webm)$/i;
  const supportedMime = /^(audio\/(?:x-wav|wav|wave|mpeg|mp4|x-m4a|webm)|video\/mp4)$/i;
  for (let i = 0; i < attachments.length; i += 1) {
    const attachment = attachments[i];
    if (
      supportedExtensions.test(attachment.getName()) ||
      supportedMime.test(attachment.getContentType())
    ) {
      return attachment;
    }
  }
  return null;
}

function transcribeAudio_(audioBlob) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing from Script Properties.');
  }

  const bytes = audioBlob.getBytes();
  if (bytes.length > APP.maxAudioBytes) {
    throw new Error('The audio attachment exceeds the 25 MB limit.');
  }

  const payload = {
    model:
      props.getProperty('OPENAI_TRANSCRIPTION_MODEL') ||
      APP.defaultTranscriptionModel,
    file: audioBlob,
  };
  const language = String(props.getProperty('TRANSCRIPTION_LANGUAGE') || '').trim();
  if (language) payload.language = language;

  const response = UrlFetchApp.fetch(APP.openAiUrl, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: payload,
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const raw = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('OpenAI transcription HTTP ' + status + ': ' + safeApiError_(raw));
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error('The transcription provider returned an unexpected response.');
  }

  const text = normalizeWhitespace_(parsed.text || '');
  if (!text) {
    throw new Error('The transcription result was empty.');
  }
  return text;
}

function attemptTranscription_(audioBlob) {
  if (!audioBlob) {
    return {
      transcript: '',
      error: 'No supported audio attachment was found.',
    };
  }
  if (!isTranscriptionEnabled_() || !shouldIncludeTranscript_()) {
    return { transcript: '', error: 'Transcription is disabled.' };
  }
  try {
    return { transcript: transcribeAudio_(audioBlob), error: '' };
  } catch (error) {
    return { transcript: '', error: safeErrorMessage_(error) };
  }
}

function shouldIncludeTranscript_() {
  return isTrue_(
    PropertiesService.getScriptProperties().getProperty(
      'INTERNAL_NOTIFICATION_INCLUDE_TRANSCRIPT'
    )
  );
}

// Source: src/50_sms_providers.gs

function getSmsProvider_() {
  return getRuntimeConfig_().smsProvider;
}

function sendSms_(phoneE164, text, correlationId) {
  const dryRun = isTrue_(
    PropertiesService.getScriptProperties().getProperty('SMS_DRY_RUN')
  );
  if (!dryRun && !isSmsSendWindowOpen_()) {
    throw new Error('SMS sending is blocked outside the configured send window.');
  }
  validateSmsPayloadText_(text, getSmsEncoding_());
  const provider = getSmsProvider_();
  if (provider === 'modulus') {
    return sendSmsViaModulus_(phoneE164, text, correlationId);
  }
  if (provider === 'twilio') {
    return sendSmsViaTwilio_(phoneE164, text, correlationId);
  }
  if (provider === 'vonage') {
    return sendSmsViaVonage_(phoneE164, text, correlationId);
  }
  if (provider === 'telnyx') {
    return sendSmsViaTelnyx_(phoneE164, text, correlationId);
  }
  if (provider === 'webhook' || provider === 'generic_webhook') {
    return sendSmsViaWebhook_(phoneE164, text, correlationId);
  }
  throw new Error(
    'Unsupported SMS_PROVIDER. Use modulus, twilio, vonage, telnyx, or webhook.'
  );
}

function sendSmsViaModulus_(phoneE164, text, correlationId) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('MODULUS_API_KEY');
  const sender = String(props.getProperty('SMS_SENDER_ID') || '').trim();
  const endpoint = props.getProperty('MODULUS_API_URL') || APP.modulusUrl;
  const routing = props.getProperty('MODULUS_ROUTING');
  const encoding = getSmsEncoding_();
  const msisdn = normalizePhoneE164_(
    phoneE164,
    getRuntimeConfig_().defaultCountryCode
  ).replace(/^\+/, '');

  if (!msisdn) throw new Error('The recipient number is invalid.');
  if (!isSmsRecipientAllowed_(phoneE164)) {
    throw new Error(
      'Delivery was blocked because the recipient does not match TEST_PHONE.'
    );
  }
  if (!isSmsSendWindowOpen_()) {
    throw new Error('SMS sending is blocked outside the configured send window.');
  }
  if (!apiKey) throw new Error('MODULUS_API_KEY is missing.');
  if (!sender) throw new Error('SMS_SENDER_ID is missing.');
  if (!isAllowedModulusEndpoint_(endpoint)) {
    throw new Error('MODULUS_API_URL must be the approved HTTPS endpoint.');
  }
  if (!isValidSenderId_(sender)) {
    throw new Error('SMS_SENDER_ID must contain 1–11 Latin letters, digits, or spaces.');
  }
  validateSmsPayloadText_(text, encoding);

  const payload = {
    priority: 2,
    recipients: [{ msisdn: msisdn }],
    sms: {
      sender: sender,
      text: String(text),
      encoding: encoding,
      validityPeriod: clamp_(
        Number(props.getProperty('SMS_VALIDITY_SECONDS') || 86400),
        15,
        86400
      ),
    },
    dlr: false,
    externalTags: ['call-auto-reply', hashText_(correlationId).slice(0, 20)],
  };
  if (routing) payload.routing = routing;

  let response;
  try {
    response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        Accept: 'application/json',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (error) {
    throw new Error(
      'Modulus delivery was not confirmed. Do not retry automatically: ' +
        safeErrorMessage_(error)
    );
  }

  const httpStatus = response.getResponseCode();
  const raw = response.getContentText();
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (error) {
    parsed = {};
  }

  if (httpStatus < 200 || httpStatus >= 300) {
    throw new Error('Modulus HTTP ' + httpStatus + ': ' + safeApiError_(raw));
  }

  const first = parsed.messages && parsed.messages[0];
  const providerCode = first && first.status ? Number(first.status.code) : NaN;
  if (!first || providerCode !== 10) {
    throw new Error(
      'Modulus did not confirm MESSAGE_ACCEPTED: ' + safeApiError_(raw)
    );
  }

  return {
    accepted: true,
    dryRun: false,
    providerMessageId: String(first.messageId || ''),
    providerStatus: String(first.status.reason || 'MESSAGE_ACCEPTED'),
    httpStatus: httpStatus,
  };
}

function sendSmsViaTwilio_(phoneE164, text, correlationId) {
  const props = PropertiesService.getScriptProperties();
  const sid = props.getProperty('TWILIO_ACCOUNT_SID');
  const token = props.getProperty('TWILIO_AUTH_TOKEN');
  const sender = props.getProperty('TWILIO_FROM');
  const messagingService = props.getProperty('TWILIO_MESSAGING_SERVICE_SID');
  const to = normalizePhoneForSms_(phoneE164);
  const endpoint =
    props.getProperty('TWILIO_API_URL') ||
    'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json';
  if (!sid) throw new Error('Missing TWILIO_ACCOUNT_SID.');
  if (!token) throw new Error('Missing TWILIO_AUTH_TOKEN.');
  if (!sender && !messagingService) {
    throw new Error(
      'Configure TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID.'
    );
  }
  if (!to) throw new Error('Invalid SMS recipient.');

  const payload = { To: to, Body: String(text) };
  if (messagingService) payload.MessagingServiceSid = messagingService;
  else payload.From = sender;
  const response = fetchFormSmsProvider_(endpoint, payload, {
    Authorization:
      'Basic ' + Utilities.base64Encode(sid + ':' + token),
  });
  const parsed = parseJsonSafely_(response.raw);
  if (response.httpStatus < 200 || response.httpStatus >= 300) {
    throw new Error(
      'Twilio HTTP ' + response.httpStatus + ': ' + safeApiError_(response.raw)
    );
  }
  return {
    accepted: true,
    dryRun: false,
    providerMessageId: String(parsed.sid || ''),
    providerStatus: String(parsed.status || 'accepted'),
    httpStatus: response.httpStatus,
    correlationId: String(correlationId || ''),
  };
}

function sendSmsViaVonage_(phoneE164, text, correlationId) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('VONAGE_API_KEY');
  const apiSecret = props.getProperty('VONAGE_API_SECRET');
  const sender = props.getProperty('VONAGE_FROM') || props.getProperty('SMS_SENDER_ID');
  const endpoint =
    props.getProperty('VONAGE_API_URL') || 'https://rest.nexmo.com/sms/json';
  const to = normalizePhoneForSms_(phoneE164).replace(/^\+/, '');
  if (!apiKey) throw new Error('Missing VONAGE_API_KEY.');
  if (!apiSecret) throw new Error('Missing VONAGE_API_SECRET.');
  if (!sender) throw new Error('Missing VONAGE_FROM.');
  if (!to) throw new Error('Invalid SMS recipient.');

  const response = fetchFormSmsProvider_(endpoint, {
    api_key: apiKey,
    api_secret: apiSecret,
    from: sender,
    to: to,
    text: String(text),
    'client-ref': String(correlationId || '').slice(0, 40),
  });
  const parsed = parseJsonSafely_(response.raw);
  const first = parsed.messages && parsed.messages[0];
  const providerCode = first && first.status != null ? String(first.status) : '';
  if (response.httpStatus < 200 || response.httpStatus >= 300 || providerCode !== '0') {
    throw new Error(
      'Vonage HTTP ' + response.httpStatus + ': ' + safeApiError_(response.raw)
    );
  }
  return {
    accepted: true,
    dryRun: false,
    providerMessageId: String((first && first['message-id']) || ''),
    providerStatus: 'accepted',
    httpStatus: response.httpStatus,
  };
}

function sendSmsViaTelnyx_(phoneE164, text, correlationId) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('TELNYX_API_KEY');
  const sender = props.getProperty('TELNYX_FROM') || props.getProperty('SMS_SENDER_ID');
  const endpoint =
    props.getProperty('TELNYX_API_URL') || APP.telnyxUrl;
  const to = normalizePhoneForSms_(phoneE164);
  if (!apiKey) throw new Error('Missing TELNYX_API_KEY.');
  if (!sender) throw new Error('Missing TELNYX_FROM or SMS_SENDER_ID.');
  if (!to) throw new Error('Invalid SMS recipient.');

  const response = fetchJsonSmsProvider_(endpoint, { from: sender, to: to, text: String(text) }, apiKey);
  const parsed = parseJsonSafely_(response.raw);
  if (response.httpStatus < 200 || response.httpStatus >= 300) {
    throw new Error(
      'Telnyx HTTP ' + response.httpStatus + ': ' + safeApiError_(response.raw)
    );
  }
  return {
    accepted: true,
    dryRun: false,
    providerMessageId: String(parsed.data && parsed.data.id ? parsed.data.id : ''),
    providerStatus: 'accepted',
    httpStatus: response.httpStatus,
    correlationId: String(correlationId || ''),
  };
}

function sendSmsViaWebhook_(phoneE164, text, correlationId) {
  const props = PropertiesService.getScriptProperties();
  const endpoint = props.getProperty('GENERIC_SMS_API_URL');
  const apiKey =
    props.getProperty('GENERIC_SMS_API_OAUTH_TOKEN') ||
    props.getProperty('GENERIC_SMS_API_KEY');
  const sender = props.getProperty('SMS_SENDER_ID') || '';
  const to = normalizePhoneForSms_(phoneE164);
  if (!endpoint) throw new Error('Missing GENERIC_SMS_API_URL.');
  if (!to) throw new Error('Invalid SMS recipient.');
  const payload = {
    to: to,
    text: String(text),
    senderId: sender,
    correlationId: String(correlationId || ''),
  };
  const response = fetchJsonSmsProvider_(endpoint, payload, apiKey || '');
  if (response.httpStatus < 200 || response.httpStatus >= 300) {
    throw new Error(
      'Generic SMS webhook HTTP ' + response.httpStatus + ': ' + safeApiError_(response.raw)
    );
  }
  const parsed = parseJsonSafely_(response.raw);
  return {
    accepted: true,
    dryRun: false,
    providerMessageId: String(parsed.id || parsed.messageId || ''),
    providerStatus: String(parsed.status || 'accepted'),
    httpStatus: response.httpStatus,
  };
}

function normalizePhoneForSms_(phoneE164) {
  return normalizePhoneE164_(
    phoneE164,
    getRuntimeConfig_().defaultCountryCode
  );
}

function fetchFormSmsProvider_(endpoint, payload, headers) {
  if (!isHttpsEndpoint_(endpoint)) {
    throw new Error('SMS provider endpoint must use HTTPS.');
  }
  let response;
  try {
    response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      headers: headers || {},
      payload: payload,
      muteHttpExceptions: true,
    });
  } catch (error) {
    throw new Error(
      'SMS provider request failed; do not retry automatically: ' +
        safeErrorMessage_(error)
    );
  }
  return { httpStatus: response.getResponseCode(), raw: response.getContentText() };
}

function fetchJsonSmsProvider_(endpoint, payload, apiKey) {
  if (!isHttpsEndpoint_(endpoint)) {
    throw new Error('SMS provider endpoint must use HTTPS.');
  }
  let response;
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
  try {
    response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (error) {
    throw new Error(
      'SMS provider request failed; do not retry automatically: ' +
        safeErrorMessage_(error)
    );
  }
  return { httpStatus: response.getResponseCode(), raw: response.getContentText() };
}

function parseJsonSafely_(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

// Source: src/60_delivery_policy.gs

/** The transcript is intentionally ignored: the client receives fixed text. */
function buildClientSms_(_transcript) {
  return getSmsReplyText_();
}

function getSmsReplyText_() {
  return (
    PropertiesService.getScriptProperties().getProperty('SMS_REPLY_TEXT') ||
    APP.defaultSmsText
  );
}

function getMissedCallSmsText_() {
  return (
    PropertiesService.getScriptProperties().getProperty('MISSED_CALL_SMS_TEXT') ||
    APP.defaultMissedCallSmsText
  );
}

function getSmsEncoding_() {
  const value = String(
    PropertiesService.getScriptProperties().getProperty('SMS_ENCODING') || 'gsm'
  ).toLocaleLowerCase('en-US');
  return value === 'ucs2' ? 'ucs2' : 'gsm';
}

function getSmsSendWindow_() {
  const props = PropertiesService.getScriptProperties();
  const enabledValue = props.getProperty('SMS_SEND_WINDOW_ENABLED');
  return {
    enabled: enabledValue === null ? true : isTrue_(enabledValue),
    startHour: Number(props.getProperty('SMS_SEND_START_HOUR') || 9),
    endHour: Number(props.getProperty('SMS_SEND_END_HOUR') || 21),
    timeZone:
      String(props.getProperty('SMS_SEND_TIME_ZONE') || APP.smsTimeZone).trim() ||
      APP.smsTimeZone,
  };
}

function isValidSmsSendWindow_(window) {
  return Boolean(
    window &&
      Number.isInteger(window.startHour) &&
      Number.isInteger(window.endHour) &&
      window.startHour >= 0 &&
      window.startHour <= 23 &&
      window.endHour >= 1 &&
      window.endHour <= 24 &&
      window.startHour < window.endHour
  );
}

function isHourWithinSmsSendWindow_(hour, startHour, endHour) {
  return Boolean(
    Number.isInteger(hour) &&
      hour >= 0 &&
      hour <= 23 &&
      isValidSmsSendWindow_({ startHour: startHour, endHour: endHour }) &&
      hour >= startHour &&
      hour < endHour
  );
}

function isSmsSendWindowOpen_(date) {
  const window = getSmsSendWindow_();
  if (!window.enabled) return true;
  if (!isValidSmsSendWindow_(window)) return false;
  try {
    const hour = Number(
      Utilities.formatDate(date || new Date(), window.timeZone, 'H')
    );
    return isHourWithinSmsSendWindow_(hour, window.startHour, window.endHour);
  } catch (error) {
    // Fail closed if an invalid time-zone identifier is configured.
    return false;
  }
}

function shouldDeferLiveSms_() {
  const dryRun = isTrue_(
    PropertiesService.getScriptProperties().getProperty('SMS_DRY_RUN')
  );
  return !dryRun && !isSmsSendWindowOpen_();
}

function deferMessageUntilSmsWindow_(messageId, phoneE164) {
  const existing = getMessageState_(messageId);
  const state = {
    messageId: messageId,
    status: 'waiting_for_send_window',
    phoneMasked: maskPhone_(phoneE164),
    reason: 'outside_sms_send_window',
    updatedAt: new Date().toISOString(),
  };
  if (!existing || existing.status !== state.status) {
    setMessageState_(messageId, state);
  }
  return state;
}

/** Notification failures must never turn an accepted SMS into a retry risk. */
function attemptInternalNotification_(message, parsed, details) {
  const props = PropertiesService.getScriptProperties();
  const enabled = isTrue_(props.getProperty('SEND_INTERNAL_NOTIFICATION'));
  if (!enabled) return { sent: false, skipped: true, error: '' };
  if (!String(props.getProperty('NOTIFICATION_EMAIL') || '').trim()) {
    return { sent: false, skipped: true, error: '' };
  }
  try {
    sendInternalNotification_(message, parsed, details);
    return { sent: true, skipped: false, error: '' };
  } catch (error) {
    const safeError = safeErrorMessage_(error);
    console.warn('Internal notification failed: ' + safeError);
    return { sent: false, skipped: false, error: safeError };
  }
}

function sendInternalNotification_(message, parsed, details) {
  const props = PropertiesService.getScriptProperties();
  if (!isTrue_(props.getProperty('SEND_INTERNAL_NOTIFICATION'))) return;

  const to = String(props.getProperty('NOTIFICATION_EMAIL') || '').trim();
  if (!to) return;
  if (!isValidNotificationEmail_(to)) {
    throw new Error('NOTIFICATION_EMAIL is not a valid email address.');
  }

  const notificationDetails = Object.assign({}, details, {
    transcript: truncateTranscriptForNotification_(details.transcript || ''),
    transcriptionError: safeErrorMessage_(details.transcriptionError || ''),
    processingError: safeErrorMessage_(details.processingError || ''),
  });

  const priorityKeywordDetected = detectUrgency_(notificationDetails.transcript || '');
  const statusLabel = statusLabel_(notificationDetails.status);
  const subject =
    (priorityKeywordDetected ? '[PRIORITY KEYWORD] ' : '') +
    (parsed.messageType === 'missed_call' ? 'Missed call ' : 'Voicemail ') +
    maskPhone_(parsed.phoneE164) +
    ' — ' +
    statusLabel;
  const receivedAt = Utilities.formatDate(
    message.getDate(),
    Session.getScriptTimeZone() || APP.smsTimeZone,
    'yyyy-MM-dd HH:mm:ss z'
  );

  const lines = [
    'Caller: ' + maskPhone_(parsed.phoneE164),
    'Event: ' +
      (parsed.messageType === 'missed_call' ? 'missed call' : 'voicemail'),
    'Email received: ' + receivedAt,
    'SMS status: ' + statusLabel,
    'Message reference hash: ' + hashText_(message.getId()).slice(0, 20),
    '',
  ];

  if (notificationDetails.transcript) {
    lines.push('Transcript:');
    lines.push(notificationDetails.transcript);
    lines.push('');
  }
  if (notificationDetails.transcriptionError) {
    lines.push('Transcription note: ' + notificationDetails.transcriptionError);
    lines.push('');
  }
  if (notificationDetails.processingError) {
    lines.push('Processing error: ' + notificationDetails.processingError);
    lines.push('');
  }
  lines.push(
    'Priority keyword matching is a routing hint, not a determination of urgency.'
  );

  const tracking = buildCallTrackingContext_(
    message,
    parsed,
    notificationDetails.status
  );
  if (tracking.enabled) {
    lines.push('');
    lines.push(
      'Use the buttons in the HTML version of this email to update call status.'
    );
  }

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: lines.join('\n'),
    htmlBody: buildInternalNotificationHtml_(
      parsed,
      notificationDetails,
      statusLabel,
      receivedAt,
      tracking
    ),
    name: APP.name,
  });

  if (tracking.enabled) {
    try {
      setCallTrackingStatus_(message, 'pending');
    } catch (error) {
      console.warn(
        'Could not apply the pending-call label: ' + safeErrorMessage_(error)
      );
    }
  }
}

// Source: src/70_call_tracking.gs

/**
 * Web-app entry point. The signed action is kept in the URL fragment, so
 * email security scanners cannot change a call status merely by fetching it.
 */
function doGet() {
  return HtmlService.createHtmlOutput(buildCallTrackingPage_())
    .setTitle('Call status')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Called only by the private Apps Script web page via google.script.run. */
function handleCallTrackingAction(token) {
  const props = PropertiesService.getScriptProperties();
  if (!isTrue_(props.getProperty('CALL_TRACKING_ENABLED'))) {
    throw new Error('Call tracking is not enabled.');
  }

  const action = verifyCallActionToken_(token);
  const message = GmailApp.getMessageById(action.messageId);
  if (!message) throw new Error('The related email could not be found.');
  if (!isTrustedInboundMessage_(message)) {
    throw new Error('The email does not satisfy the trusted sender and subject policy.');
  }

  const parsed = parseVoicemailMessage_(message);
  if (!parsed.phoneE164) {
    throw new Error('A valid caller number could not be identified.');
  }

  setCallTrackingStatus_(message, action.action);
  const existingState = getMessageState_(message.getId()) || {};
  existingState.callbackStatus = action.action;
  existingState.callbackUpdatedAt = new Date().toISOString();
  setMessageState_(message.getId(), existingState);

  const labels = {
    attempted: 'Call started',
    completed: 'Call completed',
    retry: 'No answer — callback required',
  };

  return {
    ok: true,
    action: action.action,
    status: labels[action.action],
    phoneMasked: maskPhone_(parsed.phoneE164),
    phoneDial: action.action === 'attempted' ? parsed.phoneE164 : '',
    completedUrl:
      action.action === 'attempted'
        ? buildCallActionUrl_(
            getCallTrackingWebAppUrl_(),
            message.getId(),
            'completed'
          )
        : '',
    retryUrl:
      action.action === 'attempted'
        ? buildCallActionUrl_(
            getCallTrackingWebAppUrl_(),
            message.getId(),
            'retry'
          )
        : '',
  };
}

function buildCallTrackingContext_(message, parsed, processingStatus) {
  if (
    processingStatus === 'safe_test' ||
    !parsed.phoneE164 ||
    !isTrue_(
      PropertiesService.getScriptProperties().getProperty(
        'CALL_TRACKING_ENABLED'
      )
    )
  ) {
    return { enabled: false };
  }

  const webAppUrl = getCallTrackingWebAppUrl_();
  if (!webAppUrl) return { enabled: false };

  return {
    enabled: true,
    callUrl: buildCallActionUrl_(webAppUrl, message.getId(), 'attempted'),
    completedUrl: buildCallActionUrl_(
      webAppUrl,
      message.getId(),
      'completed'
    ),
    retryUrl: buildCallActionUrl_(webAppUrl, message.getId(), 'retry'),
  };
}

function buildInternalNotificationHtml_(
  parsed,
  details,
  statusLabel,
  receivedAt,
  tracking
) {
  const typeLabel =
    parsed.messageType === 'missed_call'
      ? 'Missed call'
      : 'Voicemail';
  const transcriptHtml = details.transcript
    ? '<div style="margin-top:18px"><div style="font-weight:700;margin-bottom:6px">Transcript</div>' +
      '<div style="white-space:pre-wrap;line-height:1.55;background:#f6f8fa;padding:14px;border-radius:10px">' +
      escapeHtml_(details.transcript) +
      '</div></div>'
    : '';
  const warningHtml = details.transcriptionError
    ? '<p style="color:#7c5200"><strong>Transcription note:</strong> ' +
      escapeHtml_(details.transcriptionError) +
      '</p>'
    : '';
  const errorHtml = details.processingError
    ? '<p style="color:#b42318"><strong>Processing error:</strong> ' +
      escapeHtml_(details.processingError) +
      '</p>'
    : '';
  const buttonsHtml = tracking.enabled
    ? '<div style="margin-top:22px">' +
      notificationButtonHtml_(tracking.callUrl, '📞 Call now', '#0f766e') +
      '<div style="margin-top:12px">' +
      notificationButtonHtml_(
        tracking.completedUrl,
        '✅ Completed',
        '#2563eb'
      ) +
      notificationButtonHtml_(
        tracking.retryUrl,
        '🔁 No answer',
        '#b45309'
      ) +
      '</div></div>'
    : '';

  return (
    '<div style="font-family:Arial,sans-serif;color:#17212b;max-width:680px;margin:auto">' +
    '<div style="border:1px solid #dbe3ea;border-radius:14px;padding:22px">' +
    '<h2 style="margin:0 0 18px;font-size:20px">' +
    escapeHtml_(typeLabel) +
    '</h2>' +
    '<table style="border-collapse:collapse;width:100%;line-height:1.5">' +
    notificationRowHtml_('Caller', maskPhone_(parsed.phoneE164)) +
    notificationRowHtml_('Email received', receivedAt) +
    notificationRowHtml_('SMS status', statusLabel) +
    '</table>' +
    transcriptHtml +
    warningHtml +
    errorHtml +
    buttonsHtml +
    '<p style="font-size:12px;color:#667085;margin:20px 0 0">' +
    'Priority keyword matching is a routing hint, not a determination of urgency.' +
    '</p></div></div>'
  );
}

function notificationRowHtml_(label, value) {
  return (
    '<tr><td style="padding:5px 12px 5px 0;color:#667085;width:145px">' +
    escapeHtml_(label) +
    '</td><td style="padding:5px 0;font-weight:600">' +
    escapeHtml_(value) +
    '</td></tr>'
  );
}

function notificationButtonHtml_(url, label, color) {
  return (
    '<a href="' +
    escapeHtml_(url) +
    '" style="display:inline-block;background:' +
    color +
    ';color:#fff;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:9px;margin:0 8px 8px 0">' +
    escapeHtml_(label) +
    '</a>'
  );
}

function buildCallTrackingPage_() {
  return [
    '<!doctype html><html lang="en"><head>',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<style>',
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f7f8;color:#17212b;margin:0;padding:24px}',
    '.card{max-width:520px;margin:8vh auto;background:#fff;border:1px solid #dbe3ea;border-radius:18px;padding:28px;box-shadow:0 12px 36px rgba(16,24,40,.08)}',
    'h1{font-size:24px;margin:0 0 12px}.muted{color:#667085;line-height:1.5}',
    '.btn{display:none;background:#0f766e;color:white;text-decoration:none;font-weight:700;padding:14px 18px;border-radius:10px;margin-top:18px;text-align:center}',
    '.actions{display:none;margin-top:18px}.actions .choice{display:inline-block;color:#fff;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:9px;margin:0 8px 8px 0}.done{background:#2563eb}.retry{background:#b45309}',
    '.spinner{width:30px;height:30px;border:4px solid #dbe3ea;border-top-color:#0f766e;border-radius:50%;animation:s 1s linear infinite;margin:18px 0}',
    '@keyframes s{to{transform:rotate(360deg)}}',
    '</style></head><body><main class="card">',
    '<h1 id="title">Call status</h1>',
    '<div id="spinner" class="spinner"></div>',
    '<p id="message" class="muted">Recording your selection…</p>',
    '<a id="call" class="btn" href="#">📞 Call now</a>',
    '<div id="actions" class="actions"><p class="muted">After the call:</p><a id="done" class="choice done" href="#">✅ Completed</a><a id="retry" class="choice retry" href="#">🔁 No answer</a></div>',
    '</main><script>',
    '(function(){',
    'var p=new URLSearchParams(location.hash.slice(1)),t=p.get("token");',
    'function fail(e){document.getElementById("spinner").style.display="none";document.getElementById("title").textContent="Action not completed";document.getElementById("message").textContent=(e&&e.message)||"The link is invalid.";}',
    'function ok(r){var sp=document.getElementById("spinner"),m=document.getElementById("message"),b=document.getElementById("call"),a=document.getElementById("actions");sp.style.display="none";document.getElementById("title").textContent=r.status;m.textContent="Caller: "+r.phoneMasked;if(r.action==="attempted"&&r.phoneDial){b.href="tel:"+r.phoneDial;b.style.display="block";b.textContent="📞 Call "+r.phoneMasked;document.getElementById("done").href=r.completedUrl;document.getElementById("retry").href=r.retryUrl;a.style.display="block";setTimeout(function(){location.href=b.href;},250);}}',
    'if(!t){fail();return;}google.script.run.withSuccessHandler(ok).withFailureHandler(fail).handleCallTrackingAction(t);',
    '})();',
    '</script></body></html>',
  ].join('');
}

function buildCallActionUrl_(webAppUrl, messageId, action) {
  if (!isAllowedCallTrackingWebAppUrl_(webAppUrl)) {
    throw new Error('The call-tracking web app URL is not an approved Apps Script URL.');
  }
  return (
    String(webAppUrl).replace(/\/+$/, '') +
    '#token=' +
    encodeURIComponent(createCallActionToken_(messageId, action))
  );
}

function createCallActionToken_(messageId, action) {
  const allowed = ['attempted', 'completed', 'retry'];
  if (allowed.indexOf(action) === -1) throw new Error('Invalid call-tracking action.');
  const data = {
    version: 1,
    messageId: String(messageId),
    action: action,
    issuedAt: Date.now(),
  };
  const payload = stripBase64Padding_(
    Utilities.base64EncodeWebSafe(
      JSON.stringify(data),
      Utilities.Charset.UTF_8
    )
  );
  return payload + '.' + signCallActionPayload_(payload);
}

function verifyCallActionToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !constantTimeEqual_(signCallActionPayload_(parts[0]), parts[1])) {
    throw new Error('The call-tracking link is invalid.');
  }

  let data;
  try {
    data = JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()
    );
  } catch (error) {
    throw new Error('The call-tracking link is invalid.');
  }

  const allowed = ['attempted', 'completed', 'retry'];
  if (
    data.version !== 1 ||
    !data.messageId ||
    allowed.indexOf(data.action) === -1 ||
    !Number.isFinite(Number(data.issuedAt))
  ) {
    throw new Error('The call-tracking link is invalid.');
  }

  const maxAgeDays = clamp_(
    Number(
      PropertiesService.getScriptProperties().getProperty(
        'CALL_ACTION_MAX_AGE_DAYS'
      ) || 180
    ),
    1,
    365
  );
  const age = Date.now() - Number(data.issuedAt);
  if (age < -300000 || age > maxAgeDays * 86400000) {
    throw new Error('The call-tracking link has expired.');
  }

  return {
    messageId: String(data.messageId),
    action: data.action,
  };
}

function signCallActionPayload_(payload) {
  const secret = ensureCallTrackingSecret_();
  return stripBase64Padding_(
    Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(
        String(payload),
        secret,
        Utilities.Charset.UTF_8
      )
    )
  );
}

function stripBase64Padding_(value) {
  return String(value || '').replace(/=+$/g, '');
}

function constantTimeEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    mismatch |= (a.charCodeAt(i % Math.max(1, a.length)) || 0) ^
      (b.charCodeAt(i % Math.max(1, b.length)) || 0);
  }
  return mismatch === 0;
}

function ensureCallTrackingSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty(APP.callTrackingSecretProperty);
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty(APP.callTrackingSecretProperty, secret);
  }
  return secret;
}

function getCallTrackingWebAppUrl_() {
  const props = PropertiesService.getScriptProperties();
  const configured = String(
    props.getProperty('CALL_TRACKING_WEB_APP_URL') || ''
  ).trim();
  if (configured) {
    const normalized = configured.replace(/\/+$/, '');
    return isAllowedCallTrackingWebAppUrl_(normalized) ? normalized : '';
  }
  try {
    const detected = String(ScriptApp.getService().getUrl() || '').replace(/\/+$/, '');
    return isAllowedCallTrackingWebAppUrl_(detected) ? detected : '';
  } catch (error) {
    return '';
  }
}

function isAllowedCallTrackingWebAppUrl_(url) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
    String(url || '').trim().replace(/\/+$/, '')
  );
}

function ensureCallTrackingLabels_() {
  Object.keys(APP.callTrackingLabels).forEach(function (key) {
    getOrCreateGmailLabel_(APP.callTrackingLabels[key]);
  });
}

function getOrCreateGmailLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function setCallTrackingStatus_(message, status) {
  const labelName = APP.callTrackingLabels[status];
  if (!labelName) throw new Error('Invalid call status.');
  const thread = message.getThread();
  Object.keys(APP.callTrackingLabels).forEach(function (key) {
    const label = GmailApp.getUserLabelByName(APP.callTrackingLabels[key]);
    if (label) thread.removeLabel(label);
  });
  thread.addLabel(getOrCreateGmailLabel_(labelName));
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidNotificationEmail_(email) {
  const value = String(email || '').trim();
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function truncateTranscriptForNotification_(transcript) {
  const value = String(transcript || '');
  if (value.length <= APP.maxNotificationTranscriptChars) return value;
  const suffix = '\n\n[Transcript truncated for safer internal email delivery.]';
  return value.slice(0, APP.maxNotificationTranscriptChars - suffix.length) + suffix;
}

function detectUrgency_(transcript) {
  const text = String(transcript || '').toLocaleLowerCase();
  if (!text) return false;
  const configured =
    PropertiesService.getScriptProperties().getProperty('URGENCY_KEYWORDS') ||
    'urgent|emergency|time-sensitive|as soon as possible|priority';
  const keywords = String(configured)
    .split('|')
    .map(function (keyword) {
      return keyword.trim().toLocaleLowerCase();
    })
    .filter(Boolean);
  return keywords.some(function (keyword) {
    return text.indexOf(keyword) !== -1;
  });
}

// Source: src/80_state_and_validation.gs

function validateConfiguration_() {
  const props = PropertiesService.getScriptProperties();
  const errors = [];
  const warnings = [];
  const dryRun = isTrue_(props.getProperty('SMS_DRY_RUN'));
  const supportedProviders = [
    'modulus',
    'twilio',
    'vonage',
    'telnyx',
    'webhook',
    'generic_webhook',
  ];

  if (supportedProviders.indexOf(getSmsProvider_()) === -1) {
    errors.push('Unsupported SMS_PROVIDER: ' + getSmsProvider_());
  }

  if (!Number.isFinite(Date.parse(props.getProperty('ACTIVATED_AT') || ''))) {
    errors.push('Run initializeWithoutSending() first.');
  }
  const countryCode = String(props.getProperty('DEFAULT_COUNTRY_CODE') || '').trim();
  if (!countryCode) {
    warnings.push('DEFAULT_COUNTRY_CODE is empty; local-format caller numbers will be ignored.');
  } else if (!/^\d{1,3}$/.test(countryCode)) {
    errors.push('DEFAULT_COUNTRY_CODE must contain one to three digits without a plus sign.');
  }
  const callerPreference = String(
    props.getProperty('CALLER_NUMBER_PREFERENCE_PATTERN') || ''
  ).trim();
  if (callerPreference) {
    try {
      new RegExp(callerPreference);
    } catch (error) {
      errors.push('CALLER_NUMBER_PREFERENCE_PATTERN must be a valid regular expression.');
    }
  }
  const sendWindow = getSmsSendWindow_();
  if (sendWindow.enabled && !isValidSmsSendWindow_(sendWindow)) {
    errors.push('SMS send window must use integer hours with 0 ≤ start < end ≤ 24.');
  }

  const notificationEmail = String(
    props.getProperty('NOTIFICATION_EMAIL') || ''
  ).trim();
  if (!notificationEmail) {
    if (isTrue_(props.getProperty('SEND_INTERNAL_NOTIFICATION'))) {
      warnings.push('Internal notifications are enabled but NOTIFICATION_EMAIL is empty.');
    }
  } else if (!isValidNotificationEmail_(notificationEmail)) {
    if (isTrue_(props.getProperty('SEND_INTERNAL_NOTIFICATION'))) {
      errors.push('NOTIFICATION_EMAIL is not a valid email address.');
    } else {
      warnings.push('NOTIFICATION_EMAIL is not a valid email address.');
    }
  }
  if (
    isTrue_(props.getProperty('CALL_TRACKING_ENABLED')) &&
    !isTrue_(props.getProperty('SEND_INTERNAL_NOTIFICATION'))
  ) {
    warnings.push(
      'Call tracking is enabled while internal notification emails are disabled.'
    );
  }
  if (
    isTrue_(props.getProperty('CALL_TRACKING_ENABLED')) &&
    !isAllowedCallTrackingWebAppUrl_(getCallTrackingWebAppUrl_())
  ) {
    errors.push('A valid private Apps Script web app URL is required for call tracking.');
  }
  if (isTranscriptionEnabled_() && !props.getProperty('OPENAI_API_KEY')) {
    warnings.push('OPENAI_API_KEY is missing; SMS delivery can continue without transcription.');
  }
  if (isTrue_(props.getProperty('TEST_RECIPIENT_LOCK_ENABLED'))) {
    const testPhone = normalizePhoneE164_(
      props.getProperty('TEST_PHONE') || '',
      getRuntimeConfig_().defaultCountryCode
    );
    if (!testPhone) {
      errors.push('TEST_RECIPIENT_LOCK_ENABLED requires a valid TEST_PHONE.');
    } else {
      warnings.push(
        'Test-recipient lock is active; SMS is allowed only to TEST_PHONE.'
      );
    }
  }
  Array.prototype.push.apply(errors, collectSmsConfigurationErrors_(!dryRun));
  const voicemailSegments = estimateSmsSegments_(getSmsReplyText_(), getSmsEncoding_());
  const missedSegments = estimateSmsSegments_(getMissedCallSmsText_(), getSmsEncoding_());
  if (voicemailSegments > 1) {
    warnings.push('The voicemail reply uses ' + voicemailSegments + ' SMS segments.');
  }
  if (isTrue_(props.getProperty('MISSED_CALLS_ENABLED')) && missedSegments > 1) {
    warnings.push('The missed-call reply uses ' + missedSegments + ' SMS segments.');
  }

  return { ok: errors.length === 0, errors: errors, warnings: warnings };
}

function validateLiveSmsConfiguration_() {
  const errors = collectSmsConfigurationErrors_(true);
  if (errors.length) {
    throw new Error('Invalid SMS configuration: ' + errors.join(' | '));
  }
}

function validateProductionConfiguration_() {
  const validation = validateConfiguration_();
  const errors = validation.errors.slice();
  Array.prototype.push.apply(errors, collectSmsConfigurationErrors_(true));
  const uniqueErrors = errors.filter(function (error, index, all) {
    return all.indexOf(error) === index;
  });
  if (uniqueErrors.length) {
    throw new Error('Production activation blocked: ' + uniqueErrors.join(' | '));
  }
  return true;
}

function collectSmsConfigurationErrors_(requireCredentials) {
  const props = PropertiesService.getScriptProperties();
  const provider = getSmsProvider_();
  const errors = [];

  getSmsProviderRequirements_().forEach(function (property) {
    if (requireCredentials && !props.getProperty(property)) {
      errors.push('Missing ' + property + '.');
    }
  });

  if (provider === 'modulus') {
    const endpoint = props.getProperty('MODULUS_API_URL') || APP.modulusUrl;
    const sender = props.getProperty('SMS_SENDER_ID') || '';
    if (!isAllowedModulusEndpoint_(endpoint)) {
      errors.push('MODULUS_API_URL must be the approved HTTPS endpoint.');
    }
    if (sender && !isValidSenderId_(sender)) {
      errors.push('SMS_SENDER_ID must contain 1–11 Latin letters, digits, or spaces.');
    }
  }

  const endpointPropertyByProvider = {
    twilio: 'TWILIO_API_URL',
    vonage: 'VONAGE_API_URL',
    telnyx: 'TELNYX_API_URL',
    webhook: 'GENERIC_SMS_API_URL',
    generic_webhook: 'GENERIC_SMS_API_URL',
  };
  const endpointProperty = endpointPropertyByProvider[provider];
  const configuredEndpoint = endpointProperty
    ? String(props.getProperty(endpointProperty) || '').trim()
    : '';
  if (configuredEndpoint && !isHttpsEndpoint_(configuredEndpoint)) {
    errors.push(endpointProperty + ' must use HTTPS.');
  }

  const rawEncoding = String(props.getProperty('SMS_ENCODING') || 'gsm').toLowerCase();
  if (rawEncoding !== 'gsm' && rawEncoding !== 'ucs2') {
    errors.push('SMS_ENCODING must be gsm or ucs2.');
  }

  try {
    validateSmsPayloadText_(getSmsReplyText_(), getSmsEncoding_());
  } catch (error) {
    errors.push('SMS_REPLY_TEXT: ' + safeErrorMessage_(error));
  }
  if (isTrue_(props.getProperty('MISSED_CALLS_ENABLED'))) {
    try {
      validateSmsPayloadText_(getMissedCallSmsText_(), getSmsEncoding_());
    } catch (error) {
      errors.push('MISSED_CALL_SMS_TEXT: ' + safeErrorMessage_(error));
    }
  }
  return errors;
}

function validateSmsPayloadText_(text, encoding) {
  const value = String(text || '');
  if (!value.trim()) throw new Error('message is empty.');
  const segments = estimateSmsSegments_(value, encoding);
  const maxSegments = getMaxSmsSegments_();
  if (segments > maxSegments) {
    throw new Error(
      'message requires ' + segments + ' SMS segments; limit is ' + maxSegments + '.'
    );
  }
  return true;
}

function getMaxSmsSegments_() {
  return clamp_(
    Number(
      PropertiesService.getScriptProperties().getProperty('MAX_SMS_SEGMENTS') || 1
    ),
    1,
    10
  );
}

function isAllowedModulusEndpoint_(endpoint) {
  return String(endpoint || '').trim().replace(/\/+$/, '') === APP.modulusUrl;
}

function isHttpsEndpoint_(endpoint) {
  return /^https:\/\/[^@\s/]+(?:[/?#]|$)/i.test(String(endpoint || '').trim());
}

function isValidSenderId_(sender) {
  const value = String(sender || '');
  return value === value.trim() && /^(?=.*[A-Za-z0-9])[A-Za-z0-9 ]{1,11}$/.test(value);
}

function getSmsProviderRequirements_() {
  const props = PropertiesService.getScriptProperties();
  const provider = getSmsProvider_();
  if (provider === 'modulus') return ['MODULUS_API_KEY', 'SMS_SENDER_ID'];
  if (provider === 'twilio') {
    const sender = props.getProperty('TWILIO_MESSAGING_SERVICE_SID')
      ? []
      : ['TWILIO_FROM'];
    return ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'].concat(sender);
  }
  if (provider === 'vonage') {
    return ['VONAGE_API_KEY', 'VONAGE_API_SECRET', 'VONAGE_FROM'];
  }
  if (provider === 'telnyx') return ['TELNYX_API_KEY', 'TELNYX_FROM'];
  if (provider === 'webhook' || provider === 'generic_webhook') {
    return ['GENERIC_SMS_API_URL'];
  }
  return ['SMS_PROVIDER'];
}

function isSmsProviderConfigured_() {
  return getSmsProviderRequirements_().every(function (property) {
    return Boolean(PropertiesService.getScriptProperties().getProperty(property));
  });
}

function ensureInitialized_() {
  if (
    !Number.isFinite(
      Date.parse(
        PropertiesService.getScriptProperties().getProperty('ACTIVATED_AT') || ''
      )
    )
  ) {
    throw new Error('Run initializeWithoutSending() first.');
  }
}

function getActivationTimestamp_() {
  const activatedAt = Date.parse(
    PropertiesService.getScriptProperties().getProperty('ACTIVATED_AT') || ''
  );
  if (!Number.isFinite(activatedAt)) {
    throw new Error('ACTIVATED_AT is invalid. Run initializeWithoutSending first.');
  }
  return activatedAt;
}

function isTranscriptionEnabled_() {
  const value = PropertiesService.getScriptProperties().getProperty(
    'TRANSCRIPTION_ENABLED'
  );
  return value === null ? false : isTrue_(value);
}

function getMessageState_(messageId) {
  const raw = PropertiesService.getScriptProperties().getProperty(
    stateKey_(messageId)
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { status: 'review_required', reason: 'invalid_saved_state' };
  }
}

function setMessageState_(messageId, state) {
  const safeState = Object.assign({}, state || {});
  delete safeState.messageId;
  if (safeState.providerMessageId) {
    safeState.providerMessageIdHash = hashText_(safeState.providerMessageId).slice(
      0,
      40
    );
  }
  delete safeState.providerMessageId;
  safeState.messageIdHash = hashText_(messageId).slice(0, 40);
  PropertiesService.getScriptProperties().setProperty(
    stateKey_(messageId),
    JSON.stringify(safeState)
  );
}

/** Remove old hashed state so operational metadata has a bounded lifetime. */
function purgeExpiredState_() {
  return cleanupOldState_();
}

function isTerminalMessageState_(state) {
  if (!state) return false;
  if (APP.terminalStatuses.indexOf(state.status) !== -1) return true;
  // Never retry an uncertain send automatically.
  return state.status === 'sending';
}

function stateKey_(messageId) {
  return APP.statePrefix + hashText_(messageId).slice(0, 40);
}

function phoneReplyKey_(phoneE164) {
  return APP.phoneReplyPrefix + hashText_(phoneE164).slice(0, 40);
}

function hasRecentSuccessfulReply_(phoneE164) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(phoneReplyKey_(phoneE164));
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    const sentAt = Date.parse(saved.sentAt || saved.reservedAt || '');
    const cooldownHours = clamp_(
      Number(props.getProperty('PHONE_REPLY_COOLDOWN_HOURS') || 24),
      1,
      168
    );
    return isWithinReplyCooldown_(sentAt, Date.now(), cooldownHours);
  } catch (error) {
    return false;
  }
}

/** Reserve before the provider request so ambiguous failures cannot auto-retry. */
function reserveReply_(phoneE164, messageId, messageType) {
  PropertiesService.getScriptProperties().setProperty(
    phoneReplyKey_(phoneE164),
    JSON.stringify({
      reservedAt: new Date().toISOString(),
      messageIdHash: hashText_(messageId).slice(0, 20),
      messageType: messageType,
      status: 'sending_or_uncertain',
    })
  );
}

function isWithinReplyCooldown_(sentAt, now, cooldownHours) {
  const windowMs = clamp_(Number(cooldownHours) || 24, 1, 168) * 3600000;
  return (
    Number.isFinite(sentAt) &&
    Number.isFinite(now) &&
    now >= sentAt &&
    now - sentAt < windowMs
  );
}

function recordSuccessfulReply_(phoneE164, messageId, messageType) {
  PropertiesService.getScriptProperties().setProperty(
    phoneReplyKey_(phoneE164),
    JSON.stringify({
      sentAt: new Date().toISOString(),
      messageIdHash: hashText_(messageId).slice(0, 20),
      messageType: messageType,
      status: 'accepted',
    })
  );
}

/** Safe manual cleanup; it never touches credentials or configuration. */
function cleanupOldStateNow() {
  ensureInitialized_();
  const result = cleanupOldState_();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function maybeCleanupState_() {
  const props = PropertiesService.getScriptProperties();
  const lastCleanupAt = Date.parse(
    props.getProperty('LAST_STATE_CLEANUP_AT') || ''
  );
  if (
    !Number.isFinite(lastCleanupAt) ||
    Date.now() - lastCleanupAt >= 86400000
  ) {
    cleanupOldState_();
  }
}

function cleanupOldState_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const now = Date.now();
  const retentionDays = clamp_(
    Number(
      props.getProperty('STATE_RETENTION_DAYS') || APP.defaultStateRetentionDays
    ),
    7,
    180
  );
  const stateCutoff = now - retentionDays * 86400000;
  const cooldownHours = clamp_(
    Number(props.getProperty('PHONE_REPLY_COOLDOWN_HOURS') || 24),
    1,
    168
  );
  const phoneCutoff = now - cooldownHours * 3600000;
  let removedMessageStates = 0;
  let removedPhoneReplies = 0;

  Object.keys(all).forEach(function (key) {
    if (key.indexOf(APP.statePrefix) === 0) {
      const saved = parseSavedJson_(all[key]);
      const updatedAt = Date.parse(
        saved && (saved.updatedAt || saved.startedAt)
      );
      if (Number.isFinite(updatedAt) && updatedAt < stateCutoff) {
        props.deleteProperty(key);
        removedMessageStates += 1;
      }
    } else if (key.indexOf(APP.phoneReplyPrefix) === 0) {
      const saved = parseSavedJson_(all[key]);
      const repliedAt = Date.parse(
        saved && (saved.sentAt || saved.reservedAt)
      );
      if (Number.isFinite(repliedAt) && repliedAt < phoneCutoff) {
        props.deleteProperty(key);
        removedPhoneReplies += 1;
      }
    }
  });

  props.setProperty('LAST_STATE_CLEANUP_AT', new Date(now).toISOString());
  return {
    ok: true,
    removedMessageStates: removedMessageStates,
    removedPhoneReplies: removedPhoneReplies,
    retentionDays: retentionDays,
  };
}

function parseSavedJson_(raw) {
  try {
    return JSON.parse(String(raw || ''));
  } catch (error) {
    return null;
  }
}

function removeAutomationTriggers_() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === APP.triggerHandler) {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });
  return removed;
}

function getAutomationTriggerCount_() {
  return ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === APP.triggerHandler;
  }).length;
}

// Source: src/90_utilities.gs

function clearLiveConfirmations_() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('LIVE_TEST_CONFIRMATION');
  props.deleteProperty('MANUAL_LIVE_CONFIRMATION');
  props.deleteProperty('PRODUCTION_ACTIVATION_CONFIRMATION');
}

function hashText_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  )
    .map(function (byte) {
      const normalized = byte < 0 ? byte + 256 : byte;
      return ('0' + normalized.toString(16)).slice(-2);
    })
    .join('');
}

function htmlToText_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x20;/gi, ' ');
}

function normalizeWhitespace_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isTrue_(value) {
  return String(value || '').toLowerCase() === 'true';
}

function clamp_(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function maskPhone_(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return 'unknown';
  return '******' + digits.slice(-4);
}

function estimateSmsSegments_(text, encoding) {
  const selectedEncoding = encoding || getSmsEncoding_();
  if (selectedEncoding === 'gsm') {
    const gsmUnits = countGsmUnits_(text);
    if (!gsmUnits) return 0;
    return gsmUnits <= 160 ? 1 : Math.ceil(gsmUnits / 153);
  }
  const length = Array.from(String(text || '')).length;
  if (!length) return 0;
  return length <= 70 ? 1 : Math.ceil(length / 67);
}

function countGsmUnits_(text) {
  const extensionCharacters = '^{}\\[~]|€';
  return Array.from(String(text || '')).reduce(function (total, character) {
    return total + (extensionCharacters.indexOf(character) !== -1 ? 2 : 1);
  }, 0);
}

function statusLabel_(status) {
  const labels = {
    sms_sent: 'SMS accepted by provider',
    dry_run: 'dry run — no SMS sent',
    safe_test: 'safe test — no SMS sent',
    processing: 'processing',
    sending: 'sending — delivery may be uncertain',
    review_required: 'manual review required',
    waiting_for_send_window: 'waiting for the configured SMS send window',
    waiting_for_voicemail: 'waiting for a possible voicemail',
    suppressed_by_voicemail: 'suppressed — voicemail followed',
    suppressed_recent_reply: 'suppressed — recent reply already sent',
    missed_call_disabled: 'suppressed — missed calls are disabled',
    blocked_by_test_recipient_lock: 'blocked by test recipient lock',
    ignored_existing: 'ignored — received before activation',
  };
  return labels[status] || String(status || 'unknown status');
}

function safeApiError_(raw) {
  const value = String(raw || '').slice(0, 1000);
  let extracted = '';
  try {
    const parsed = JSON.parse(value);
    if (parsed.error && parsed.error.message) extracted = String(parsed.error.message);
    else if (parsed.message) extracted = String(parsed.message);
    else if (parsed.reason) extracted = String(parsed.reason);
  } catch (error) {
    // Fall through to a short sanitized string.
  }
  return sanitizeDiagnosticText_(extracted || value).slice(0, 300) || 'empty response';
}

function safeErrorMessage_(error) {
  return sanitizeDiagnosticText_(error && error.message ? error.message : error).slice(0, 500);
}

function sanitizeDiagnosticText_(value) {
  return String(value == null ? '' : value)
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_API_KEY]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{12,}={0,2}/gi, 'Bearer [REDACTED]')
    .replace(/[A-Za-z0-9_-]{8,}\$_\$[A-Za-z0-9_-]{8,}/g, '[REDACTED_API_KEY]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/(?:(?:\+|00)30[\s().-]*)?69(?:[\s().-]*\d){8}/g, function (phone) {
      return maskPhone_(phone);
    })
    .replace(/\b\d{10,15}\b/g, function (digits) {
      return '******' + digits.slice(-4);
    })
    .replace(/[\r\n]+/g, ' ');
}

function redactSmsResult_(result) {
  return {
    accepted: Boolean(result && result.accepted),
    dryRun: Boolean(result && result.dryRun),
    providerMessageId: result ? result.providerMessageId || '' : '',
    providerStatus: result ? result.providerStatus || '' : '',
    httpStatus: result ? result.httpStatus || null : null,
  };
}

function redactProcessingResult_(result) {
  return {
    status: result.status || '',
    phoneMasked: result.phoneMasked || '',
    audioFound: Boolean(result.audioFound),
    transcriptAvailable: Boolean(result.transcriptAvailable),
    priorityKeywordsDetected: Boolean(result.priorityKeywordsDetected),
    error: result.error || '',
  };
}
