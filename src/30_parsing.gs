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
