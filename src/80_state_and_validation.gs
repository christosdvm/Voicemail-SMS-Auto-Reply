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
