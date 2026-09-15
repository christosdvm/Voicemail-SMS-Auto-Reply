import fs from 'node:fs';
import process from 'node:process';
import { loadRuntimeContext } from '../tests/helpers/runtime-context.mjs';

const scenarios = {
  voicemail: {
    fixture: 'generic-voicemail.txt',
    recentReply: false,
  },
  'missed-call': {
    fixture: 'generic-missed-call.txt',
    recentReply: false,
  },
  duplicate: {
    fixture: 'generic-voicemail.txt',
    recentReply: true,
  },
};

const selected = process.argv[2] || 'all';
if (selected !== 'all' && !scenarios[selected]) {
  console.error(`Unknown scenario: ${selected}`);
  console.error(`Choose one of: all, ${Object.keys(scenarios).join(', ')}`);
  process.exit(1);
}

const names = selected === 'all' ? Object.keys(scenarios) : [selected];
const results = names.map(runScenario);
console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));

function runScenario(name) {
  const scenario = scenarios[name];
  const fixturePath = new URL(`../tests/fixtures/${scenario.fixture}`, import.meta.url);
  const email = fs.readFileSync(fixturePath, 'utf8');
  const subject = email.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() || '';
  const { context } = loadRuntimeContext({
    DEFAULT_COUNTRY_CODE: '30',
    CALLER_NUMBER_LABELS: 'caller number|from number|phone|Από τον αριθμό',
    SMS_PROVIDER: 'webhook',
    SMS_DRY_RUN: 'true',
    PHONE_REPLY_COOLDOWN_HOURS: '24',
  });

  const eventType = context.getMessageType_(subject);
  const caller = context.extractPhoneFromText_(email);
  if (scenario.recentReply) {
    context.recordSuccessfulReply_(caller, 'synthetic-previous-message', eventType);
  }

  const duplicateSuppressed = context.hasRecentSuccessfulReply_(caller);
  const decision = duplicateSuppressed ? 'suppressed_recent_reply' : 'dry_run';

  return {
    scenario: name,
    input: {
      fixture: scenario.fixture,
      subject,
    },
    extraction: {
      eventType,
      callerMasked: context.maskPhone_(caller),
    },
    policy: {
      dryRun: true,
      duplicateSuppressed,
      decision,
    },
    delivery: {
      provider: 'webhook',
      attempted: false,
      reason: duplicateSuppressed ? 'caller cooldown' : 'dry run',
    },
  };
}
