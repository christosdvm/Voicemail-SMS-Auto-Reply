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
