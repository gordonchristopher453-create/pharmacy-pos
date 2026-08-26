const nodemailer = require('nodemailer');
const logger = require('./logger');

const getSmtpUser = () => process.env.SMTP_USER || process.env.EMAIL_USER || process.env.MAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USERNAME || '';
const getSmtpPass = () => process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.MAIL_PASS || process.env.GMAIL_PASS || process.env.SMTP_PASSWORD || '';
const getSmtpHost = () => process.env.SMTP_HOST || process.env.EMAIL_HOST || process.env.MAIL_HOST || 'smtp.gmail.com';
const getSmtpPort = () => parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || process.env.MAIL_PORT || '587', 10);

const createTransporter = () => {
  const host = getSmtpHost();
  const port = getSmtpPort();
  const secure = port === 465 || process.env.SMTP_SECURE === 'true';
  const user = getSmtpUser();
  const pass = getSmtpPass();
  const service = process.env.SMTP_SERVICE || (host.includes('gmail') ? 'gmail' : undefined);

  if (service) {
    return nodemailer.createTransport({
      service,
      auth: (user && pass) ? { user, pass } : undefined,
      tls: { rejectUnauthorized: false }
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: (user && pass) ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false
    }
  });
};

const getFromAddress = (defaultLabel = 'Medicare HMS') => {
  const user = getSmtpUser();
  const fromAddr = process.env.SMTP_FROM || user || 'no-reply@pharmapos.co.ke';
  return `"${defaultLabel}" <${fromAddr}>`;
};

const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0f1117; font-family:'Segoe UI',Arial,sans-serif; color:#e2e8f0; }
    .wrapper { max-width:600px; margin:40px auto; background:#1a1d2e; border-radius:16px; overflow:hidden; border:1px solid #2d3748; }
    .header { background:linear-gradient(135deg,#6c63ff 0%,#3ecf8e 100%); padding:40px 32px; text-align:center; }
    .header h1 { font-size:26px; font-weight:800; color:#fff; letter-spacing:-0.5px; }
    .header p { font-size:14px; color:rgba(255,255,255,0.85); margin-top:6px; }
    .body { padding:40px 32px; }
    .greeting { font-size:20px; font-weight:700; color:#f7fafc; margin-bottom:8px; }
    .text { font-size:15px; color:#a0aec0; line-height:1.7; margin-bottom:24px; }
    .card { background:#0f1117; border:1px solid #2d3748; border-radius:12px; padding:24px; margin-bottom:24px; }
    .card-title { font-size:12px; font-weight:700; color:#6c63ff; text-transform:uppercase; letter-spacing:1px; margin-bottom:16px; }
    .cred-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #2d3748; }
    .cred-row:last-child { border-bottom:none; }
    .cred-label { font-size:13px; color:#718096; }
    .cred-value { font-size:14px; font-weight:600; color:#e2e8f0; font-family:monospace; background:#1a1d2e; padding:4px 10px; border-radius:6px; }
    .cred-value.highlight { color:#3ecf8e; }
    .btn { display:block; width:fit-content; margin:0 auto 32px; background:linear-gradient(135deg,#6c63ff,#3ecf8e); color:#fff; text-decoration:none; padding:14px 36px; border-radius:50px; font-size:15px; font-weight:700; text-align:center; }
    .warning { background:#2d1b00; border:1px solid #744210; border-radius:10px; padding:16px 20px; margin-bottom:24px; }
    .warning p { font-size:13px; color:#f6ad55; line-height:1.6; }
    .steps { margin-bottom:24px; }
    .step { display:flex; gap:16px; align-items:flex-start; margin-bottom:16px; }
    .step-num { background:#6c63ff; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0; }
    .step-text { font-size:14px; color:#a0aec0; line-height:1.6; padding-top:4px; }
    .step-text strong { color:#e2e8f0; }
    .divider { border:none; border-top:1px solid #2d3748; margin:24px 0; }
    .footer { background:#0f1117; padding:24px 32px; text-align:center; border-top:1px solid #2d3748; }
    .footer p { font-size:12px; color:#4a5568; line-height:1.6; }
    .footer a { color:#6c63ff; text-decoration:none; }
    .badge { display:inline-block; background:#1a1d2e; border:1px solid #3ecf8e; color:#3ecf8e; font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
    .stat-row { display:flex; gap:12px; margin-bottom:24px; }
    .stat { flex:1; background:#0f1117; border:1px solid #2d3748; border-radius:10px; padding:16px; text-align:center; }
    .stat-value { font-size:22px; font-weight:800; color:#6c63ff; }
    .stat-label { font-size:11px; color:#718096; margin-top:4px; text-transform:uppercase; letter-spacing:0.5px; }
  </style>
</head>
<body>
  <div class="wrapper">
    ${content}
    <div class="footer">
      <p>© ${new Date().getFullYear()} Medicare HMS · Built for modern healthcare facilities<br/>
      <a href="#">Support</a> · <a href="#">Documentation</a> · <a href="#">Privacy Policy</a></p>
    </div>
  </div>
</body>
</html>
`;

const welcomeEmailTemplate = ({ pharmacyName, adminName, adminEmail, adminPassword, loginUrl, plan, expiresAt }) => {
  const planColors = { trial: '#f6ad55', basic: '#63b3ed', premium: '#3ecf8e', enterprise: '#b794f4' };
  const planColor = planColors[plan] || '#6c63ff';
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' }) : 'Active';
  return baseTemplate(`
    <div class="header">
      <h1>💊 Medicare HMS</h1>
      <p>Official Facility Setup & Admin Onboarding</p>
    </div>
    <div class="body">
      <div class="badge" style="border-color:${planColor};color:${planColor};">${(plan || 'PREMIUM').toUpperCase()} SUBSCRIPTION</div>
      <div class="greeting">Welcome to Medicare HMS, ${adminName}! 🎉</div>
      <p class="text">Your facility <strong style="color:#e2e8f0">${pharmacyName}</strong> has been successfully set up and activated on the Medicare Hospital & Pharmacy Management System.</p>

      <div class="card" style="border-left: 4px solid #3ecf8e;">
        <div class="card-title">🔐 Admin Login Credentials</div>
        <div class="cred-row"><span class="cred-label">Portal Web Link</span><span class="cred-value highlight"><a href="${loginUrl}" style="color:#3ecf8e;text-decoration:underline;">${loginUrl}</a></span></div>
        <div class="cred-row"><span class="cred-label">Admin Email</span><span class="cred-value">${adminEmail}</span></div>
        <div class="cred-row"><span class="cred-label">Initial Password</span><span class="cred-value highlight">${adminPassword}</span></div>
        <div class="cred-row"><span class="cred-label">Active Plan</span><span class="cred-value" style="color:${planColor}">${(plan || 'PREMIUM').toUpperCase()}</span></div>
        <div class="cred-row"><span class="cred-label">Subscription Valid Until</span><span class="cred-value">${expiryDate}</span></div>
      </div>

      <div class="warning">
        <p>🔒 <strong>Security Advice:</strong> Log in using the credentials above and change your password under <strong>Settings → Change Password</strong> upon your first access.</p>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a class="btn" href="${loginUrl}" target="_blank">Access Medicare HMS Portal →</a>
      </div>

      <div class="divider"></div>

      <h3 style="color:#e2e8f0;margin-bottom:16px;font-size:16px;">🚀 Quick Start Administration Guide for ${pharmacyName}</h3>
      
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text">
            <strong>Login Procedure:</strong><br/>
            Open <a href="${loginUrl}" style="color:#6c63ff;">${loginUrl}</a> in any browser. Enter your Admin Email (<code>${adminEmail}</code>) and Password, then click <strong>Log In</strong>.
          </div>
        </div>

        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text">
            <strong>Create Staff Accounts:</strong><br/>
            Navigate to <strong>Users & Staff Management</strong> menu → Click <strong>+ Add New User</strong>. Enter staff details (Name, Email, Role such as Doctor, Pharmacist, Cashier, Receptionist, Lab Tech) so your team can log in with their own accounts.
          </div>
        </div>

        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text">
            <strong>Add & Manage Stock / Inventory:</strong><br/>
            Go to <strong>Stock & Inventory</strong> or <strong>Products</strong> section → Click <strong>+ Add New Stock</strong>. Enter item details (Name, Category, Batch #, Selling Price, Cost, Initial Quantity & Expiry Date) to start dispensing.
          </div>
        </div>

        <div class="step">
          <div class="step-num">4</div>
          <div class="step-text">
            <strong>Configure Service & Drug Price Lists:</strong><br/>
            Go to <strong>Service Prices</strong> or <strong>Products & Pricing</strong> menu. Adjust consultation charges, lab test fees, procedure prices, and drug prices as per your facility's tariff.
          </div>
        </div>
      </div>

      <div class="divider"></div>
      <p class="text" style="font-size:13px;color:#a0aec0;">If you need assistance setting up your hospital or pharmacy workflows, our support team is available 24/7.</p>
    </div>
  `);
};

const passwordResetEmailTemplate = ({ name, email, newPassword, loginUrl, resetBy }) => {
  return baseTemplate(`
    <div class="header" style="background:linear-gradient(135deg,#6c63ff 0%,#3ecf8e 100%)">
      <h1>🔑 Password Reset Notification</h1>
      <p>Medicare HMS Security Notice</p>
    </div>
    <div class="body">
      <div class="greeting">Hello ${name || 'User'},</div>
      <p class="text">The password for your Medicare HMS account (<strong style="color:#e2e8f0">${email}</strong>) was successfully reset by <strong>${resetBy || 'Administrator'}</strong>.</p>

      <div class="card" style="border-left: 4px solid #3ecf8e;">
        <div class="card-title">🔐 Updated Login Credentials</div>
        <div class="cred-row"><span class="cred-label">Login Account</span><span class="cred-value">${email}</span></div>
        <div class="cred-row"><span class="cred-label">New Password</span><span class="cred-value highlight">${newPassword}</span></div>
        <div class="cred-row"><span class="cred-label">Portal Web Link</span><span class="cred-value highlight"><a href="${loginUrl}" style="color:#3ecf8e;text-decoration:underline;">${loginUrl}</a></span></div>
      </div>

      <div class="warning">
        <p>🔒 <strong>Security Warning:</strong> If you did not authorize this password update, please contact your platform or facility administrator immediately.</p>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a class="btn" href="${loginUrl}" target="_blank">Access Medicare HMS Portal →</a>
      </div>
    </div>
  `);
};

const expiryWarningTemplate = ({ pharmacyName, adminName, adminEmail, plan, expiresAt, daysLeft }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' });
  const urgencyColor = daysLeft <= 3 ? '#fc8181' : daysLeft <= 7 ? '#f6ad55' : '#63b3ed';
  return baseTemplate(`
    <div class="header" style="background:linear-gradient(135deg,#744210 0%,#c05621 100%)">
      <h1>⚠️ Subscription Expiring</h1>
      <p>Action required for ${pharmacyName}</p>
    </div>
    <div class="body">
      <div class="greeting">Hi ${adminName},</div>
      <p class="text">Your <strong style="color:#e2e8f0">${plan.toUpperCase()}</strong> subscription for <strong style="color:#e2e8f0">${pharmacyName}</strong> is expiring soon.</p>
      <div class="stat-row">
        <div class="stat"><div class="stat-value" style="color:${urgencyColor}">${daysLeft}</div><div class="stat-label">Days Left</div></div>
        <div class="stat"><div class="stat-value" style="font-size:16px;color:#a0aec0">${expiryDate}</div><div class="stat-label">Expiry Date</div></div>
      </div>
      <div class="warning" style="${daysLeft <= 3 ? 'background:#2d0000;border-color:#742020;' : ''}">
        <p>${daysLeft <= 3 ? '🚨 URGENT:' : '⚠️ Reminder:'} After expiry, staff will not be able to log in until subscription is renewed.</p>
      </div>
      <a class="btn" href="${process.env.FRONTEND_URL || 'https://app.pharmapos.co.ke'}">Renew Subscription Now →</a>
    </div>
  `);
};

const subscriptionActivatedTemplate = ({ pharmacyName, adminName, plan, expiresAt }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' });
  return baseTemplate(`
    <div class="header">
      <h1>✅ Subscription Activated</h1>
      <p>Your Medicare HMS plan is live</p>
    </div>
    <div class="body">
      <div class="greeting">Great news, ${adminName}! 🚀</div>
      <p class="text">Your <strong style="color:#3ecf8e">${plan.toUpperCase()}</strong> subscription for <strong style="color:#e2e8f0">${pharmacyName}</strong> has been activated.</p>
      <div class="card">
        <div class="card-title">📋 Subscription Details</div>
        <div class="cred-row"><span class="cred-label">Plan</span><span class="cred-value highlight">${plan.toUpperCase()}</span></div>
        <div class="cred-row"><span class="cred-label">Status</span><span class="cred-value" style="color:#3ecf8e">ACTIVE</span></div>
        <div class="cred-row"><span class="cred-label">Valid Until</span><span class="cred-value">${expiryDate}</span></div>
      </div>
      <a class="btn" href="${process.env.FRONTEND_URL || 'https://app.pharmapos.co.ke'}">Go to Dashboard →</a>
    </div>
  `);
};

const otpEmailTemplate = ({ name, email, otp }) => {
  return baseTemplate(`
    <div class="header" style="background:linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%)">
      <h1>🔐 Security Verification OTP</h1>
      <p>Password Reset Request</p>
    </div>
    <div class="body">
      <div class="greeting">Hello ${name || 'User'},</div>
      <p class="text">A password reset request was initiated for your Medicare HMS account (<strong style="color:#e2e8f0">${email}</strong>).</p>
      
      <div class="card" style="text-align:center;padding:28px 20px;">
        <div class="card-title" style="margin-bottom:12px;color:#3ecf8e;">Your 6-Digit Verification OTP</div>
        <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#3ecf8e;font-family:monospace;background:#0f1117;padding:16px;border-radius:10px;border:1px dashed #3ecf8e;display:inline-block;">
          ${otp}
        </div>
        <p style="font-size:12px;color:#a0aec0;margin-top:14px;">This code expires in <strong>15 minutes</strong>. Do not share this OTP with anyone.</p>
      </div>

      <div class="warning">
        <p>⚠️ <strong>Security Warning:</strong> If you did not request a password reset, please contact your facility administrator immediately.</p>
      </div>
    </div>
  `);
};

const sendWelcomeEmail = async ({ pharmacyName, adminName, adminEmail, adminPassword, plan, expiresAt }) => {
  logger.info(`[WELCOME EMAIL DISPATCH] Sending onboarding email to ${adminEmail} for facility: ${pharmacyName}`);
  const loginUrl = process.env.FRONTEND_URL || 'https://app.pharmapos.co.ke';
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!user || !pass) {
    logger.warn(`SMTP credentials not set. Simulated welcome email to ${adminEmail} (Facility: ${pharmacyName}, Password: ${adminPassword})`);
    return true;
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: getFromAddress('Medicare HMS Platform'),
      to: adminEmail,
      subject: `🎉 Welcome to Medicare HMS — Credentials & Quick-Start Guide for ${pharmacyName}`,
      html: welcomeEmailTemplate({ pharmacyName, adminName, adminEmail, adminPassword, loginUrl, plan, expiresAt }),
    });
    logger.info(`Welcome onboarding email successfully sent to ${adminEmail}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send welcome email to ${adminEmail} via SMTP: ${error.message}`);
    return false;
  }
};

const sendPasswordResetEmail = async ({ name, email, newPassword, resetBy }) => {
  logger.info(`[PASSWORD RESET EMAIL DISPATCH] Destination: ${email}`);
  const loginUrl = process.env.FRONTEND_URL || 'https://app.pharmapos.co.ke';
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!user || !pass) {
    logger.warn(`SMTP credentials not set. Simulated password reset email to ${email}. New Password: ${newPassword}`);
    return true;
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: getFromAddress('Medicare HMS Security'),
      to: email,
      subject: `🔑 Your Medicare HMS Account Password Has Been Updated`,
      html: passwordResetEmailTemplate({ name, email, newPassword, loginUrl, resetBy }),
    });
    logger.info(`Password reset notification email successfully sent via SMTP to ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send password reset email to ${email} via SMTP: ${error.message}`);
    return false;
  }
};

const sendExpiryWarningEmail = async ({ pharmacyName, adminName, adminEmail, plan, expiresAt, daysLeft }) => {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!user || !pass) return true;
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: getFromAddress('Medicare HMS Platform'),
      to: adminEmail,
      subject: `⚠️ Your Medicare HMS subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      html: expiryWarningTemplate({ pharmacyName, adminName, adminEmail, plan, expiresAt, daysLeft }),
    });
    logger.info(`Expiry warning sent to ${adminEmail} (${daysLeft} days left)`);
    return true;
  } catch (error) {
    logger.error(`Failed to send expiry warning to ${adminEmail}:`, error.message);
    return false;
  }
};

const sendSubscriptionActivatedEmail = async ({ pharmacyName, adminName, adminEmail, plan, expiresAt }) => {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!user || !pass) return true;
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: getFromAddress('Medicare HMS Platform'),
      to: adminEmail,
      subject: `✅ Medicare HMS ${plan.toUpperCase()} plan activated for ${pharmacyName}`,
      html: subscriptionActivatedTemplate({ pharmacyName, adminName, adminEmail, plan, expiresAt }),
    });
    logger.info(`Activation email sent to ${adminEmail}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send activation email to ${adminEmail}:`, error.message);
    return false;
  }
};

const sendOtpEmail = async ({ name, email, otp }) => {
  logger.info(`[SECURITY OTP EMAIL DISPATCH] Destination: ${email} | Code: ${otp}`);
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!user || !pass) {
    logger.warn(`SMTP credentials not set. Simulated email dispatch to ${email}. Verification OTP: ${otp}`);
    return true;
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: getFromAddress('Medicare HMS Security'),
      to: email,
      subject: `🔐 Your Password Reset Verification Code: ${otp}`,
      html: otpEmailTemplate({ name, email, otp }),
    });
    logger.info(`OTP email successfully dispatched via SMTP to ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to dispatch OTP email to ${email} via SMTP: ${error.message}. Verification OTP was: ${otp}`);
    return false;
  }
};

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendExpiryWarningEmail, sendSubscriptionActivatedEmail, sendOtpEmail };

