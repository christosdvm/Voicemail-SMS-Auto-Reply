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
