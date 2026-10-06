import tls from "node:tls";

function smtpConfig() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
  const port = Number(process.env.SMTP_PORT ?? 465);
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM || port !== 465) return null;
  return { host: SMTP_HOST, port, user: SMTP_USER, password: SMTP_PASSWORD, from: SMTP_FROM };
}

export function isEmailConfigured() {
  return smtpConfig() !== null;
}

export async function sendPasswordResetCode(to: string, code: string) {
  const config = smtpConfig();
  if (!config) throw new Error("Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM and SMTP_PORT=465 to send reset codes.");

  const socket = tls.connect({ host: config.host, port: config.port, servername: config.host });
  socket.setTimeout(15_000, () => socket.destroy(new Error("SMTP connection timed out")));
  let pending = "";
  const lines: string[] = [];
  const readers: ((line: string) => void)[] = [];
  socket.on("data", (chunk: Buffer) => {
    pending += chunk.toString("utf8");
    while (pending.includes("\n")) {
      const newline = pending.indexOf("\n");
      const line = pending.slice(0, newline).replace(/\r$/, "");
      pending = pending.slice(newline + 1);
      const reader = readers.shift();
      if (reader) reader(line);
      else lines.push(line);
    }
  });

  const readLine = () => new Promise<string>((resolve, reject) => {
    if (lines.length) return resolve(lines.shift()!);
    const onError = (error: Error) => reject(error);
    socket.once("error", onError);
    readers.push((line) => { socket.off("error", onError); resolve(line); });
  });
  const response = async () => {
    const first = await readLine();
    const expectedCode = first.slice(0, 3);
    let line = first;
    while (line[3] === "-") line = await readLine();
    return { code: Number(expectedCode), text: line.slice(4) };
  };
  const command = async (value: string, expected: number[]) => {
    socket.write(`${value}\r\n`);
    const result = await response();
    if (!expected.includes(result.code)) throw new Error(`SMTP command failed (${result.code} ${result.text})`);
  };

  try {
    const connected = await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    void connected;
    const greeting = await response();
    if (greeting.code !== 220) throw new Error(`SMTP greeting failed (${greeting.code})`);
    await command("EHLO barangay-dmms.local", [250]);
    await command("AUTH LOGIN", [334]);
    await command(Buffer.from(config.user).toString("base64"), [334]);
    await command(Buffer.from(config.password).toString("base64"), [235]);
    await command(`MAIL FROM:<${config.from}>`, [250]);
    await command(`RCPT TO:<${to}>`, [250, 251]);
    await command("DATA", [354]);
    const subject = "Barangay DMMS password reset code";
    const body = `Your password reset code is ${code}. It expires in 10 minutes and can only be used once. If you did not request this, you can ignore this email.`;
    const message = [
      `From: Barangay DMMS <${config.from}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      body,
    ].join("\r\n");
    socket.write(`${message}\r\n.\r\n`);
    const sent = await response();
    if (sent.code !== 250) throw new Error(`SMTP message rejected (${sent.code})`);
    await command("QUIT", [221]);
  } finally {
    socket.end();
  }
}
