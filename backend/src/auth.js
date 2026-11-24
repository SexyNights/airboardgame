import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { HttpError } from "./services.js";
import { sessionSecret } from "./config.js";

const tokens = new Map();
const secret = sessionSecret;
export const userIdForEmail = (email) =>
  crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

// Mark the session cookie Secure when the site is served over HTTPS.
const secureFlag = () =>
  (process.env.CLIENT_URL || "").startsWith("https://") ? "; Secure" : "";
export const sessionCookie = (userId) => {
  const value = `${userId}.${crypto.createHmac("sha256", secret()).update(userId).digest("base64url")}`;
  return `session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${10 * 24 * 60 * 60}${secureFlag()}`;
};
export const clearSessionCookie =
  "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
export const mailFromOrigin = (origin) =>
  process.env.EMAIL_FROM || `noreply@${new URL(origin).hostname}`;

// Optional comma-separated allowlist. Empty/unset = any address may log in.
export const allowedEmails = () =>
  (process.env.ABG_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
export const isEmailAllowed = (email) => {
  const allowed = allowedEmails();
  return !allowed.length || allowed.includes(email.trim().toLowerCase());
};
const siteName = "Airboardgame";
const jaSiteName = "VirtualBoardGame日本語版";
const mailTranslations = {
  en: {
    subject: `[${siteName}] Your authentication link`,
    text: (url) =>
      `Hello,\n\nHere is the link that allows you to log in ${siteName}:\n\n${url}\n\nPlease click on the link or copy and paste it into your browser.\n\nYours sincerely,\n\n${siteName} team.`,
    html: (url) =>
      `<p>Hello,</p><p>Here is the link that allows you to log in ${siteName}:</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p>Please click on the link or copy and paste it into your browser.</p><p>Yours sincerely,</p><p>${siteName} team.</p>`,
  },
  ja: {
    subject: `[${jaSiteName}] ログイン用リンク`,
    text: (url) =>
      `こんにちは。\n\n${jaSiteName} にログインするためのリンクです:\n\n${url}\n\nリンクをクリックするか、ブラウザに貼り付けて開いてください。リンクの有効期限は15分です。\n\n${jaSiteName}`,
    html: (url) =>
      `<p>こんにちは。</p><p>${jaSiteName} にログインするためのリンクです:</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p>リンクをクリックするか、ブラウザに貼り付けて開いてください。リンクの有効期限は15分です。</p><p>${jaSiteName}</p>`,
  },
  fr: {
    subject: `[${siteName}] Votre lien d'authentification`,
    text: (url) =>
      `Bonjour,\n\nVoici le lien qui vous permet de vous connecter à ${siteName} :\n\n${url}\n\nCliquez sur le lien ou copiez et collez-le dans votre navigateur.\n\nCordialement,\n\nL'équipe de ${siteName}.`,
    html: (url) =>
      `<p>Bonjour,</p><p>Voici le lien qui vous permet de vous connecter à ${siteName} :</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p>Cliquez sur le lien ou copiez et collez-le dans votre navigateur.</p><p>Cordialement,</p><p>L'équipe de ${siteName}.</p>`,
  },
};

const escapeHtml = (value) =>
  value.replace(
    /[&<>\"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
        character
      ]
  );

export const mailLanguage = (acceptLanguage = "") => {
  for (const preference of acceptLanguage.split(",")) {
    const [language, ...parameters] = preference.trim().toLowerCase().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    if (quality && Number(quality.trim().slice(2)) === 0) continue;
    const baseLanguage = language.split("-")[0];
    if (mailTranslations[baseLanguage]) return baseLanguage;
  }
  return "en";
};

export const authenticationMail = (url, acceptLanguage) => {
  const translation = mailTranslations[mailLanguage(acceptLanguage)];
  return {
    subject: translation.subject,
    text: translation.text(url),
    html: translation.html(url),
  };
};

export const currentUser = (request) => {
  const value = request.headers.cookie?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (!value) return null;
  const [userId, signature] = value.split(".");
  const expected = crypto
    .createHmac("sha256", secret())
    .update(userId || "")
    .digest("base64url");
  const actual = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  return userId &&
    actual.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actual, expectedBuffer)
    ? userId
    : null;
};
// Minimum delay between two login links for the same address.
const loginRequestInterval = () =>
  (Number(process.env.ABG_LOGIN_INTERVAL_SECONDS) || 60) * 1000;
const lastLoginRequest = new Map();

export const requestLogin = async (email, origin, acceptLanguage) => {
  if (!isEmailAllowed(email))
    throw new HttpError(403, "This email address is not allowed to log in");
  const userId = userIdForEmail(email);
  const now = Date.now();
  if (now - (lastLoginRequest.get(userId) || 0) < loginRequestInterval())
    throw new HttpError(429, "Please wait before requesting another login link");
  lastLoginRequest.set(userId, now);
  const token = crypto.randomBytes(24).toString("hex");
  tokens.set(`${userId}:${token}`, Date.now() + 15 * 60 * 1000);
  const link = `${origin}/login/${userId}/${token}`;
  if ((process.env.EMAIL_HOST || "fake") === "fake")
    console.log(`Authentication link: ${link}`);
  else {
    const mail = authenticationMail(link, acceptLanguage);
    await nodemailer
      .createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT) || 587,
        // Implicit TLS on 465/2465 (or EMAIL_SECURE=1); STARTTLS otherwise.
        secure:
          process.env.EMAIL_SECURE === "1" ||
          ["465", "2465"].includes(String(process.env.EMAIL_PORT)),
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      })
      .sendMail({
        from: mailFromOrigin(origin),
        to: email.trim(),
        ...mail,
      });
  }
};
export const verifyLogin = (userId, token) => {
  const key = `${userId}:${token}`;
  const expires = tokens.get(key);
  if (!expires || expires < Date.now())
    throw new HttpError(403, "Token invalid or has expired");
  tokens.delete(key);
};
