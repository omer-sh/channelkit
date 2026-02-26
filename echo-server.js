const http = require("http");
const fs = require("fs");
const path = require("path");

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

/**
 * Parse a multipart/form-data body and return { fields, files }.
 * fields: { name: string_value }
 * files:  { name: { filename, mimetype, data: Buffer } }
 */
function parseMultipart(buf, boundary) {
  const fields = {};
  const files = {};
  const sep = Buffer.from(`--${boundary}`);

  // Split on boundary
  let start = 0;
  const parts = [];
  while (true) {
    const idx = buf.indexOf(sep, start);
    if (idx === -1) break;
    if (start > 0) parts.push(buf.slice(start, idx));
    start = idx + sep.length;
    // skip \r\n after boundary
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;
    // closing --
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break;
  }

  for (const part of parts) {
    // Find the blank line separating headers from body (\r\n\r\n)
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headerStr = part.slice(0, headerEnd).toString();
    // Body is between header end and trailing \r\n
    let body = part.slice(headerEnd + 4);
    if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
      body = body.slice(0, -2);
    }

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    if (filenameMatch) {
      const mimeMatch = headerStr.match(/Content-Type:\s*(.+)/i);
      files[name] = {
        filename: filenameMatch[1],
        mimetype: mimeMatch ? mimeMatch[1].trim() : "application/octet-stream",
        data: body,
      };
    } else {
      fields[name] = body.toString();
    }
  }
  return { fields, files };
}

function handleRequest(req, msg, savedFile) {
  const channel = msg.channel || "?";
  const type = msg.type || "text";
  const from = msg.from || "?";
  const text = msg.text || "(no text)";

  console.log(`\n📨 ${req.url} ← [${channel}] ${from}: ${text}`);
  if (type !== "text") console.log(`   Type: ${type}`);
  if (msg.senderName) console.log(`   Name: ${msg.senderName}`);
  if (msg.email?.subject) console.log(`   Subject: ${msg.email.subject}`);
  if (msg.media) console.log(`   Media: ${msg.media.mimetype || "unknown"} (${msg.media.filename || "no name"})`);
  if (savedFile) console.log(`   💾 Saved: ${savedFile}`);

  let reply;
  if (req.url.startsWith("/expenses")) {
    reply = { text: "💰 Onkosto: got your message!" };
  } else if (req.url.startsWith("/home")) {
    reply = { text: "🏠 Smart Home: got your message!" };
  } else if (req.url.startsWith("/support")) {
    // Demo: echo back with voice (triggers TTS if configured)
    reply = { text: `You said: ${text}`, voice: true };
  } else if (req.url.startsWith("/email")) {
    reply = {
      text: `Thanks for your email!`,
      email: { subject: `Re: ${msg.email?.subject || "Your message"}` },
    };
  } else if (channel === "voice") {
    // Voice: respond with text (will be spoken back via TTS or <Say>)
    reply = { text: `You said: ${text}`, voice: true };
  } else {
    reply = { text: `Echo [${channel}]: ${text}` };
  }

  if (savedFile) {
    reply.text += ` (attachment saved: ${path.basename(savedFile)})`;
  }

  console.log(`📤 ${reply.text}${reply.voice ? " 🔊" : ""}`);
  return reply;
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const contentType = req.headers["content-type"] || "";
    let msg = {};
    let savedFile = null;

    if (contentType.includes("multipart/form-data")) {
      // Parse multipart — ChannelKit sends: metadata (JSON) + file (binary)
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (boundaryMatch) {
        const buf = Buffer.concat(chunks);
        const { fields, files } = parseMultipart(buf, boundaryMatch[1]);

        if (fields.metadata) {
          try { msg = JSON.parse(fields.metadata); } catch {}
        }

        if (files.file) {
          const { filename, mimetype, data } = files.file;
          const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const dest = path.join(UPLOADS_DIR, safeName);
          fs.writeFileSync(dest, data);
          savedFile = dest;

          // Populate media info on msg so logging picks it up
          msg.media = { mimetype, filename };
        }
      }
    } else {
      // JSON body (the normal path)
      const raw = Buffer.concat(chunks).toString();
      if (raw.length) {
        try { msg = JSON.parse(raw); } catch {}
      }
    }

    const reply = handleRequest(req, msg, savedFile);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(reply));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🔗 Echo server listening on port ${PORT}\n`);
  console.log("   Routes:");
  console.log("   /expenses → Onkosto (text reply)");
  console.log("   /home     → Smart Home (text reply)");
  console.log("   /support  → Support (voice reply — TTS)");
  console.log("   /email    → Email (reply with subject)");
  console.log("   /*        → Generic echo");
  console.log("   voice     → Echo with TTS 🔊\n");
  console.log("   Supports: WhatsApp, Telegram, Gmail, Resend, SMS, Voice");
  console.log(`   Attachments saved to: ${UPLOADS_DIR}\n`);
});
