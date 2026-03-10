---
name: channelkit
description: Integrate messaging channels (WhatsApp, SMS, Voice, Telegram, Email) with ChannelKit. Use when the user wants to send or receive messages, build chatbots, set up voice IVR, or connect their app to messaging platforms. ChannelKit is a local messaging gateway with MCP tools for channel and service management.
---

# ChannelKit Integration

ChannelKit is a self-hosted messaging gateway. Install it, connect channels, and your app can send/receive messages across WhatsApp, SMS, Voice, Telegram, and Email.

## Core Concepts

- **Channel**: A connection to a messaging platform (WhatsApp, Telegram, SMS, Voice, Email)
- **Service**: Routes messages between a channel and your app's webhook. Each service has its own STT/TTS config.
- **Routing mode**: `service` (one service per channel, direct routing) or `groups` (multiple services per channel, user selects via magic code or slash command)

## Message Flow

```
Inbound:  User sends message → ChannelKit → (STT if voice) → POSTs to your app's webhook
Outbound: Your app calls ChannelKit send API or MCP send_message → delivers via channel
```

## When to Use ChannelKit

Use when the app needs to:
- Send WhatsApp/SMS messages (verification codes, notifications, alerts)
- Receive messages and respond (chatbot, support, data queries)
- Handle voice calls (IVR, voice assistant, phone queries)
- Send/receive email programmatically

Don't use when:
- Push notifications are sufficient (use FCM/APNs)
- Only need SMTP email (use nodemailer)
- Need real-time audio/video streaming (use WebRTC)

## Getting Started

**IMPORTANT:** Before doing anything, check if you have ChannelKit MCP tools available (e.g. `get_status`, `send_message`, `add_channel`).

- If you **DO** have the MCP tools: start by calling `get_status` to check what channels and services are already configured.
- If you **DO NOT** have the MCP tools: **STOP.** Do not try to curl the API, read config files, or install ChannelKit. Instead, tell the user that the ChannelKit MCP server is not connected and ask them to add it. The MCP server URL is typically `http://localhost:4000/mcp` (or whatever host/port ChannelKit is running on). They can add it to their Claude Code MCP settings or run: `claude mcp add --transport http channelkit http://localhost:4000/mcp`

## MCP Tool Reference

| Task | Tool |
|------|------|
| Check status, version, connected channels | `get_status` |
| Add a messaging channel | `add_channel` |
| Remove a channel | `remove_channel` |
| List all channels | `list_channels` |
| Create a service (webhook routing) | `add_service` |
| Update a service | `update_service` |
| Remove a service | `remove_service` |
| List all services | `list_services` |
| Set routing mode (service/groups) | `set_channel_mode` |
| Send a message | `send_message` |
| Read message history | `get_messages` |
| Set config values (API keys, tunnel, etc.) | `set_config` |
| Restart ChannelKit | `restart` |
| Update to latest version | `update` |

## Setup Flow

1. **`get_status`** — check if ChannelKit is running, what channels exist, and get the API secret
2. **`add_channel`** — connect the needed platform
3. **`add_service`** — create a service pointing to the app's webhook URL
4. **`get_status`** — verify everything is connected

## Channel Setup Notes

### WhatsApp
- Links via QR code (like WhatsApp Web). After `add_channel(name, type="whatsapp")`, user scans QR at `http://localhost:4000/qr`
- No external credentials needed

### Telegram
- Requires a bot token from @BotFather
- `add_channel(name, type="telegram", config={"bot_token": "123:ABC..."})`

### SMS
- Requires Twilio account + phone number
- `add_channel(name, type="sms", config={"phone_number": "+1..."})`
- Set Twilio credentials: `set_config("settings.twilio_account_sid", "...")` and `set_config("settings.twilio_auth_token", "...")`
- Inbound SMS requires a public URL — see Tunnel Setup below

### Voice
- Requires Twilio account + phone number
- `add_channel(name, type="voice", config={"phone_number": "+1..."})`
- Same Twilio credentials as SMS
- **Requires a public URL** — see Tunnel Setup below
- Voice services need STT/TTS configured on the service

### Email
- **Gmail**: Uses OAuth2. Run `channelkit gmail-auth` CLI wizard to set up, then `add_channel(name, type="email", config={"provider": "gmail", ...})`
- **Resend**: API key based. `add_channel(name, type="email", config={"provider": "resend", "api_key": "re_..."})`

## Integration Patterns

### Pattern A: Outbound Only (app → user)

For: notifications, verification codes, alerts, reminders. No webhook/service needed.

Use the MCP tool directly:
```
send_message(channel="whatsapp", to="+972541234567", text="Your code is 123456")
```

Or via HTTP API:
```
POST http://localhost:4000/api/send/{channel}/{recipient}
Authorization: Bearer {API_SECRET}
Content-Type: application/json

{ "text": "Your verification code is 123456" }
```

- `{channel}` — channel name (e.g. "whatsapp", "sms")
- `{recipient}` — phone number for WhatsApp/SMS, chat ID for Telegram, email address for Email
- `API_SECRET` — from ChannelKit config. Get via `get_status` or read `~/.channelkit/config.yaml`
- Optional `"media"` field for attachments (URL)

### Pattern B: Inbound + Response (user → app → user)

For: chatbots, voice queries, support, data lookups. Requires a service with a webhook.

**Inbound webhook payload** (ChannelKit POSTs to your app):
```json
{
  "id": "msg_abc123",
  "channel": "whatsapp",
  "from": "+972541234567",
  "senderName": "John",
  "type": "text",
  "text": "How much did I spend this month?",
  "replyUrl": "http://localhost:4000/api/send/whatsapp/...",
  "timestamp": 1709856000
}
```

For email, additional fields: `email.subject`, `email.html`, `email.to`, `email.cc`, `email.attachments`

**Webhook response format** (your app responds with):
```json
{
  "text": "You spent $2,340 this month.",
  "voice": true,
  "media": {
    "url": "https://example.com/chart.png",
    "mimetype": "image/png"
  },
  "email": {
    "subject": "Re: Your Question",
    "html": "<p>HTML body here</p>"
  }
}
```

- `text` — required, the message text
- `voice` — set `true` to convert text to speech (for voice channel)
- `media` — optional attachment with URL and mimetype
- `email` — optional email-specific fields (subject, html body)

**Async replies**: Your app can also reply anytime by POSTing to the `replyUrl` from the inbound payload (same Bearer auth).

### Webhook URL Placeholders

Webhook URLs support dynamic placeholders:
- `[FROM]` — sender phone/ID
- `[CHANNEL]` — channel type
- `[SENDER_NAME]` — display name
- `[TEXT]` — message text
- `[GROUP_ID]` / `[GROUP_NAME]` — group info

Example: `http://myapp.com/webhook?from=[FROM]&channel=[CHANNEL]`

## Multi-Service Routing

When multiple services share one channel, use **groups mode**:

- **WhatsApp**: Each service gets a magic `code`. User sends the code → ChannelKit creates an auto-named group for that service. Subsequent messages in the group route to that service.
  ```
  add_service(name="expenses", channel="whatsapp", webhook="http://...", code="EXPENSES")
  ```

- **Telegram**: Each service gets a slash `command`. User sends `/expenses` → subsequent messages route to that service.
  ```
  add_service(name="expenses", channel="telegram", webhook="http://...", command="expenses")
  ```

Mode is auto-detected (1 service = direct, 2+ = groups), or set explicitly:
```
set_channel_mode(name="whatsapp", mode="groups")
```

## Configuration

### API Keys (via `set_config`)

```
set_config("settings.openai_api_key", "sk-...")        # For Whisper STT or OpenAI TTS
set_config("settings.google_api_key", "...")            # For Google STT/TTS
set_config("settings.elevenlabs_api_key", "...")        # For ElevenLabs TTS
set_config("settings.deepgram_api_key", "...")          # For Deepgram STT
set_config("settings.twilio_account_sid", "...")        # For SMS/Voice channels
set_config("settings.twilio_auth_token", "...")         # For SMS/Voice channels
set_config("settings.anthropic_api_key", "sk-ant-...")  # For AI formatting
```

### Tunnel Setup (for public URL)

Voice calls and SMS inbound require ChannelKit to be reachable from the internet. ChannelKit has built-in Cloudflare tunneling:

```
set_config("tunnel.token", "eyJ...")          # Cloudflare tunnel token
set_config("tunnel.auto_start", true)          # Start tunnel on boot
```

The public URL will appear in `get_status` output.

Alternatively, set a manual public URL: `set_config("tunnel.public_url", "https://ck.yourdomain.com")`

### STT/TTS on Services

Configure speech processing per service:
```
add_service(
  name="voice-bot",
  channel="voice",
  webhook="http://localhost:3000/voice",
  stt={"provider": "google", "language": "en-US"},
  tts={"provider": "elevenlabs", "voice": "21m00Tcm4TlvDq8ikWAM"}
)
```

STT providers: `google`, `whisper`, `deepgram`
TTS providers: `google`, `elevenlabs`, `openai`

### AI Formatting

Process incoming messages through an AI model before forwarding to webhook. Useful for extracting structured data from natural language. Configure on the service via the config file:

```yaml
services:
  expenses:
    format:
      provider: openai  # or anthropic, google
      prompt: "Extract expense amount and category as JSON"
```

## Troubleshooting

- **ChannelKit not running**: Run `channelkit` or check `get_status`
- **Channel not connecting**: Check `get_status` for channel status. For WhatsApp, rescan QR at `/qr`. For Telegram, verify bot token.
- **Webhook not receiving messages**: Verify service webhook URL is correct with `list_services`. Check that the app server is running. Use `get_messages` to see if messages are being received by ChannelKit.
- **Voice/SMS not working inbound**: Ensure tunnel is configured and public URL is set. Check `get_status` for the public URL.
- **STT/TTS not working**: Verify API keys are set via `set_config`. Check that the service has STT/TTS configured.
- **Messages not delivering**: Use `get_messages` to check message history and status.
