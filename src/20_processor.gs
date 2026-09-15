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
