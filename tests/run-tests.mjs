import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
const fixture = (name) =>
  fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const scriptProperties = new Map();
const context = {
  console,
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty(key) {
          return scriptProperties.has(key) ? scriptProperties.get(key) : null;
        },
        setProperty(key, value) {
          scriptProperties.set(key, String(value));
        },
        setProperties(values) {
          Object.entries(values).forEach(([key, value]) => {
            scriptProperties.set(key, String(value));
          });
        },
        deleteProperty(key) {
          scriptProperties.delete(key);
        },
        getProperties() {
          return Object.fromEntries(scriptProperties.entries());
        },
      };
    },
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    base64Encode(value) {
      return Buffer.from(value).toString('base64');
    },
    base64EncodeWebSafe(value) {
      return Buffer.from(value).toString('base64url');
    },
    base64DecodeWebSafe(value) {
      return [...Buffer.from(value, 'base64url')];
    },
    computeHmacSha256Signature(value, key) {
      return [...crypto.createHmac('sha256', key).update(value).digest()];
    },
    computeDigest(_algorithm, value) {
      return [...crypto.createHash('sha256').update(String(value)).digest()];
    },
    getUuid() {
      return crypto.randomUUID();
    },
    newBlob(value) {
      return {
        getDataAsString() {
          return Buffer.from(value).toString('utf8');
        },
      };
    },
    formatDate(date, _timeZone, format) {
      if (format === 'H') return String(new Date(date).getUTCHours());
      return new Date(date).toISOString();
    },
  },
};

vm.createContext(context);
vm.runInContext(source, context, { filename: 'Code.gs' });

scriptProperties.set('DEFAULT_COUNTRY_CODE', '30');
scriptProperties.set('CALLER_NUMBER_LABELS', 'caller number|from number|Από τον αριθμό');

assert.equal(
  context.extractPhoneFromText_('Caller number: +44 7700 900123'),
  '+447700900123'
);
assert.equal(
  context.extractPhoneFromText_('Από τον αριθμό: 6980000001'),
  '+306980000001'
);
assert.equal(
  context.extractPhoneFromText_(
    'Incoming call. From number: 6932024022. Destination: 00302118001111'
  ),
  '+306932024022'
);
assert.equal(
  context.extractPhoneFromFilename_(
    '00302118001111-6980000004-20260907-181425.wav'
  ),
  '+306980000004'
);
assert.equal(context.extractAnyGreekMobile_('6980000005 no-reply@example.invalid'), '+306980000005');
assert.equal(context.normalizePhoneE164_('0030 698 000 0003', '30'), '+306980000003');
assert.equal(context.normalizePhoneE164_('07700 900123', '44'), '+447700900123');
assert.equal(context.normalizeGreekMobile_('2108001111'), '');
assert.equal(
  context.recipientMatchesTestPhone_('+306980000007', '6980000007'),
  true
);
assert.equal(
  context.recipientMatchesTestPhone_('+447700900123', '07700 900124'),
  false
);

scriptProperties.set('PHONE_REPLY_COOLDOWN_HOURS', '24');
context.recordSuccessfulReply_('+306980000007', 'message-1', 'voicemail');
assert.equal(context.hasRecentSuccessfulReply_('+306980000007'), true);
assert.equal(context.hasRecentSuccessfulReply_('+306980000001'), false);
assert.equal(
  context.isWithinReplyCooldown_(1_000_000, 1_000_000 + 24 * 3600000, 24),
  false
);

assert.equal(context.isHourWithinSmsSendWindow_(9, 9, 21), true);
assert.equal(context.isHourWithinSmsSendWindow_(21, 9, 21), false);
assert.equal(
  context.isValidSmsSendWindow_({ startHour: 9, endHour: 21 }),
  true
);
assert.equal(
  context.isValidSmsSendWindow_({ startHour: 21, endHour: 9 }),
  false
);
scriptProperties.set('SMS_SEND_WINDOW_ENABLED', 'true');
scriptProperties.set('SMS_SEND_START_HOUR', '9');
scriptProperties.set('SMS_SEND_END_HOUR', '21');
assert.equal(context.isSmsSendWindowOpen_(new Date(Date.UTC(2026, 0, 1, 10))), true);
assert.equal(context.isSmsSendWindowOpen_(new Date(Date.UTC(2026, 0, 1, 21))), false);
assert.equal(context.isValidSenderId_('Clinic01'), true);
assert.equal(context.isValidSenderId_('sender-with-too-many-characters'), false);
assert.equal(context.isValidNotificationEmail_('doctor@example.invalid'), true);
assert.equal(context.isValidNotificationEmail_('not-an-email'), false);
assert.match(
  context.sanitizeDiagnosticText_('synthetic +306980000001 doctor@example.invalid sk-testkey123456789'),
  /\[REDACTED_EMAIL\]/
);
assert.doesNotMatch(
  context.sanitizeDiagnosticText_('synthetic +306980000001 doctor@example.invalid sk-testkey123456789'),
  /306980000001|doctor@example\.invalid|sk-testkey123456789/
);
assert.equal(
  context.safeApiError_(
    JSON.stringify({ message: 'Send to +306980000001 failed for doctor@example.invalid' })
  ),
  'Send to ******0001 failed for [REDACTED_EMAIL]'
);
assert.equal(context.countGsmUnits_('^{}\\[~]|€'), 18);
assert.equal(context.estimateSmsSegments_('^'.repeat(81), 'gsm'), 2);
assert.equal(
  context.isAllowedModulusEndpoint_('https://messaging.modulus.gr/ott-api/message/'),
  true
);
assert.equal(
  context.isAllowedModulusEndpoint_('https://example.invalid/modulus'),
  false
);
assert.equal(
  context.isAllowedCallTrackingWebAppUrl_('https://script.google.com/macros/s/synthetic-id_123/exec'),
  true
);
assert.equal(
  context.isAllowedCallTrackingWebAppUrl_('https://script.google.com/macros/d/synthetic-id/edit'),
  false
);

const allowlistedMessage = {
  getSubject() {
    return 'New voicemail notification';
  },
  getFrom() {
    return 'Synthetic Provider <provider@example.invalid>';
  },
};
assert.equal(context.isTrustedInboundMessage_(allowlistedMessage), true);
assert.equal(
  context.isTrustedModulusMessage_({
    getSubject() {
      return 'New voicemail notification';
    },
    getFrom() {
      return 'Synthetic Provider <no-reply@modulus.gr>';
    },
  }),
  true
);
assert.equal(
  context.isTrustedModulusMessage_({
    getSubject() {
      return 'New voicemail notification';
    },
    getFrom() {
      return 'no-reply@modulus.gr.example.invalid';
    },
  }),
  false
);
scriptProperties.set('ALLOWED_SENDER_EMAILS', 'trusted@example.invalid');
assert.equal(context.isTrustedInboundMessage_(allowlistedMessage), false);
scriptProperties.set('ALLOWED_SENDER_EMAILS', 'provider@example.invalid');
assert.equal(context.isTrustedInboundMessage_(allowlistedMessage), true);
scriptProperties.delete('ALLOWED_SENDER_EMAILS');

scriptProperties.set('PHONE_REPLY_COOLDOWN_HOURS', '24');
context.reserveReply_('+306980000007', 'message-reserved', 'voicemail');
assert.equal(context.hasRecentSuccessfulReply_('+306980000007'), true);
context.setMessageState_('state-message-id', {
  messageId: 'state-message-id',
  status: 'dry_run',
  phoneMasked: '******0007',
  updatedAt: new Date().toISOString(),
});
const savedState = JSON.parse(scriptProperties.get(context.stateKey_('state-message-id')));
assert.equal(savedState.messageId, undefined);
assert.equal(typeof savedState.messageIdHash, 'string');
scriptProperties.set('STATE_RETENTION_DAYS', '7');
scriptProperties.set(
  context.stateKey_('old-message'),
  JSON.stringify({ status: 'dry_run', updatedAt: new Date(Date.now() - 8 * 86400000).toISOString() })
);
const cleanup = context.cleanupOldState_();
assert.equal(cleanup.removedMessageStates >= 1, true);
assert.equal(scriptProperties.has(context.stateKey_('old-message')), false);

assert.equal(context.getMessageType_('New voicemail from provider'), 'voicemail');
assert.equal(context.getMessageType_('Missed call notification'), 'missed_call');
assert.equal(context.isMatchingSubject_('Re: New voicemail from provider'), false);
assert.equal(context.getMessageType_('Unrelated message'), '');

scriptProperties.set('VOICEMAIL_SUBJECT_PATTERN', '^Provider Voice Event$');
assert.equal(context.getMessageType_('Provider Voice Event'), 'voicemail');
assert.equal(context.getMessageType_('New voicemail from provider'), '');
scriptProperties.delete('VOICEMAIL_SUBJECT_PATTERN');

const voicemailFixture = fixture('generic-voicemail.txt');
const missedCallFixture = fixture('generic-missed-call.txt');
assert.equal(context.extractPhoneFromText_(voicemailFixture), '+447700900123');
assert.equal(context.extractPhoneFromText_(missedCallFixture), '+306980000009');
const fakeAudio = {
  getName() {
    return 'synthetic-voicemail.wav';
  },
  getContentType() {
    return 'audio/wav';
  },
};
const fakeMessage = {
  getPlainBody() {
    return voicemailFixture;
  },
  getBody() {
    return '';
  },
  getAttachments() {
    return [fakeAudio];
  },
  getSubject() {
    return 'New voicemail notification';
  },
};
const parsedFixture = context.parseVoicemailMessage_(fakeMessage);
assert.equal(parsedFixture.phoneE164, '+447700900123');
assert.equal(parsedFixture.audio.getName(), 'synthetic-voicemail.wav');
assert.equal(parsedFixture.messageType, 'voicemail');

assert.equal(context.getSmsProvider_(), 'modulus');
scriptProperties.set('SMS_PROVIDER', 'telnyx');
assert.equal(
  JSON.stringify(context.getSmsProviderRequirements_()),
  JSON.stringify(['TELNYX_API_KEY', 'TELNYX_FROM'])
);
scriptProperties.set('SMS_PROVIDER', 'webhook');
assert.equal(
  JSON.stringify(context.getSmsProviderRequirements_()),
  JSON.stringify(['GENERIC_SMS_API_URL'])
);
let lastRequest;
scriptProperties.set('SMS_SEND_WINDOW_ENABLED', 'false');
context.UrlFetchApp = {
  fetch(endpoint, options) {
    lastRequest = { endpoint, options };
    return {
      getResponseCode() {
        return 201;
      },
      getContentText() {
        return JSON.stringify({ id: 'synthetic-message-id', status: 'queued' });
      },
    };
  },
};
scriptProperties.set('SMS_PROVIDER', 'webhook');
scriptProperties.set('GENERIC_SMS_API_URL', 'https://sms.example.invalid/send');
const webhookResult = context.sendSms_('+447700900123', 'Synthetic test', 'test-1');
assert.equal(webhookResult.accepted, true);
assert.equal(lastRequest.endpoint, 'https://sms.example.invalid/send');
assert.equal(JSON.parse(lastRequest.options.payload).to, '+447700900123');
scriptProperties.set('SMS_PROVIDER', 'twilio');
scriptProperties.set('TWILIO_ACCOUNT_SID', 'ACsynthetic');
scriptProperties.set('TWILIO_AUTH_TOKEN', 'synthetic-token');
scriptProperties.set('TWILIO_FROM', 'ExampleSender');
const twilioResult = context.sendSms_('+447700900123', 'Synthetic test', 'test-2');
assert.equal(twilioResult.accepted, true);
assert.match(lastRequest.endpoint, /Accounts\/ACsynthetic\/Messages\.json$/);
assert.equal(lastRequest.options.payload.To, '+447700900123');
scriptProperties.delete('SMS_PROVIDER');

assert.equal(context.attemptTranscription_(null).transcript, '');
assert.equal(context.shouldIncludeTranscript_(), false);
assert.equal(context.maskPhone_('+447700900123'), '******0123');
assert.doesNotMatch(context.maskPhone_('+447700900123'), /447700900123/);
assert.equal(
  context.estimateSmsSegments_(context.buildClientSms_('ignored'), 'gsm'),
  1
);
assert.equal(context.detectUrgency_('The animal has difficulty breathing.'), true);
assert.equal(context.detectUrgency_('Το ζώο δεν αναπνέει καλά.'), true);
assert.equal(context.detectUrgency_('Θέλω να κλείσουμε ένα ραντεβού.'), false);
assert.equal(
  context.buildClientSms_('transcript must not alter the SMS'),
  'Thank you for your message. I am currently unavailable and will call you back as soon as possible.'
);
assert.equal(
  context.escapeHtml_('<script>"&\''),
  '&lt;script&gt;&quot;&amp;&#39;'
);
assert.equal(context.constantTimeEqual_('abc123', 'abc123'), true);
assert.equal(context.constantTimeEqual_('abc123', 'abc124'), false);
assert.match(context.buildCallTrackingPage_(), /handleCallTrackingAction/);
assert.doesNotMatch(context.buildCallTrackingPage_(), /messageId=/);
const validToken = context.createCallActionToken_('gmail-message-123', 'attempted');
assert.deepEqual(
  JSON.parse(JSON.stringify(context.verifyCallActionToken_(validToken))),
  { messageId: 'gmail-message-123', action: 'attempted' }
);
assert.throws(
  () => context.verifyCallActionToken_(validToken.slice(0, -1) + 'x'),
  /δεν είναι έγκυρος/
);

console.log('All parser, provider, deduplication, privacy, and safety tests passed.');
