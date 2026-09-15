# Operations runbook

This runbook is for a small, human-owned deployment. It favors preventing duplicate or unintended SMS over automatic recovery.

## Lifecycle

| Mode | Automation | SMS delivery | How to enter |
| --- | --- | --- | --- |
| Initialized | off | blocked | `initializeWithoutSending()` |
| Dry-run automation | on | blocked | `activateAutomation()` |
| Single-recipient test | off | only `TEST_PHONE` | `prepareSingleRecipientTest()`, then one-shot live test |
| Production | on | allowed by policy | `activateProductionAutomation()` with one-shot confirmation |
| Paused | off | forced back to dry run | `pauseAutomation()` |
| Deactivated | off, trigger removed | forced back to dry run | `deactivateAutomation()` |

`showStatus()` is the first diagnostic command. It returns configuration warnings, active-trigger count, send-window settings, provider readiness, and no secret values.

## Message outcomes

| Status | Meaning | Operator action |
| --- | --- | --- |
| `dry_run` | Policy completed; no SMS request was made. | Review extraction and configuration. |
| `sms_sent` | The provider explicitly accepted the request. | No action unless delivery receipts are handled elsewhere. |
| `waiting_for_voicemail` | A missed call is inside the delay window. | None; the next trigger will reconsider it. |
| `waiting_for_send_window` | A live message arrived outside configured hours. | None unless the time zone/window is wrong. |
| `suppressed_by_voicemail` | The related voicemail owns the acknowledgement. | None. |
| `suppressed_recent_reply` | The caller is inside the cooldown. | Review only if the cooldown policy is inappropriate. |
| `blocked_by_test_recipient_lock` | The caller is not the configured test recipient. | Expected in test mode. |
| `review_required` | Parsing, configuration, or delivery is uncertain. | Inspect the redacted error and provider console before any manual resend. |
| `sending` | A provider request started but no terminal state was stored. | Treat delivery as uncertain; do not rerun automatically. |

## Ambiguous delivery

An HTTP timeout does not prove failure. The provider may have accepted the SMS before the connection was interrupted.

When a request is ambiguous:

1. Leave the caller reservation in place.
2. Check the SMS provider's message log using the correlation/reference information available there.
3. Confirm whether the message exists before considering a manual resend.
4. Record the operational decision outside this script if the provider offers no definitive status.

The automation intentionally has no “retry uncertain sends” command.

## Safe rollback

Run `pauseAutomation()` to stop processing immediately while keeping the trigger installed. This also forces `SMS_DRY_RUN=true` and clears one-shot confirmations.

Run `deactivateAutomation()` to remove the trigger as well. Provider credentials remain in Script Properties and should be rotated or deleted separately when required.

## Routine review

- Check Apps Script execution failures and provider rejection rates.
- Run `showStatus()` after configuration changes.
- Confirm the sender allowlist and Gmail query after a telephony provider changes its email format.
- Review `SMS_SEND_TIME_ZONE` after moving or changing the operating schedule.
- Run `cleanupOldStateNow()` if retention settings change.
- Keep real emails, phone numbers, audio, and transcripts out of GitHub issues.

## Incident response

For an unintended SMS, pause automation first. Preserve only the minimum provider metadata needed to investigate, rotate exposed credentials, and follow the organization's communication and privacy process.

For a leaked repository secret, revocation and rotation come before history cleanup. Removing a value from the latest commit does not invalidate it.
