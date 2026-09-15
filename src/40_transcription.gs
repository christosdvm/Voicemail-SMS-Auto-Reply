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
