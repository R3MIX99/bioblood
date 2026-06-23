const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendResetCode(toEmail, code) {
  await transporter.sendMail({
    from:    `"BioBlood" <${process.env.SMTP_USER}>`,
    to:      toEmail,
    subject: "Tu código de verificación — BioBlood",
    text:    `Tu código de verificación es: ${code}\n\nVálido por 15 minutos. Si no solicitaste este código, ignora este mensaje.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#C0392B;margin-bottom:8px">BioBlood</h2>
        <p style="color:#555;margin-bottom:24px">Código de verificación para restablecer tu contraseña:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111;
                    background:#f5f5f5;border-radius:8px;padding:16px 24px;
                    text-align:center;margin-bottom:24px">${code}</div>
        <p style="color:#888;font-size:13px">Válido por 15 minutos.<br>
        Si no solicitaste este código, puedes ignorar este correo.</p>
      </div>`,
  });
}

module.exports = { sendResetCode };
