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
