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
