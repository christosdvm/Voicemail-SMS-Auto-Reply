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
