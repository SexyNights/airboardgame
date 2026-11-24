import assert from "node:assert/strict";
import test from "node:test";
import { clientOrigin } from "../src/app.js";
import {
  currentUser,
  authenticationMail,
  isEmailAllowed,
  mailLanguage,
  mailFromOrigin,
  requestLogin,
  sessionCookie,
  userIdForEmail,
  verifyLogin,
} from "../src/auth.js";

test("login normalizes email before calculating the user id", () => {
  assert.equal(
    userIdForEmail("  USER@Example.COM "),
    userIdForEmail("user@example.com")
  );
});

test("login links target the configured frontend", () => {
  process.env.CLIENT_URL = "https://airboardgame.example/";
  assert.equal(
    clientOrigin({ get: () => "http://backend:4050" }),
    "https://airboardgame.example"
  );
  delete process.env.CLIENT_URL;
  assert.equal(
    clientOrigin({
      get: (header) =>
        header === "origin" ? "http://localhost:3001" : undefined,
    }),
    "http://localhost:3001"
  );
});

test("login mail sender uses the origin hostname", () => {
  assert.equal(
    mailFromOrigin("https://airboardgame.example:3001/login"),
    "noreply@airboardgame.example"
  );
});

test("login mail follows the browser language", () => {
  assert.equal(mailLanguage("fr-FR,fr;q=0.9,en;q=0.8"), "fr");
  assert.equal(mailLanguage("de-DE,de;q=0.9,en;q=0.8"), "en");
  assert.equal(mailLanguage("fr;q=0"), "en");

  const mail = authenticationMail("https://airboardgame.example/login/user/token", "fr-FR");
  assert.equal(mail.subject, "[Airboardgame] Votre lien d'authentification");
  assert.match(mail.text, /Bonjour/);
  assert.match(mail.html, /href="https:\/\/airboardgame\.example\/login\/user\/token"/);
});

test("fake email login token is one-time and creates a valid session cookie", async () => {
  const previousHost = process.env.EMAIL_HOST;
  const previousSecret = process.env.ABG_SECRET;
  const originalLog = console.log;
  let message;
  process.env.EMAIL_HOST = "fake";
  process.env.ABG_SECRET = "test-secret";
  console.log = (value) => {
    message = value;
  };
  try {
    await requestLogin("User@example.com", "http://localhost:3001");
  } finally {
    console.log = originalLog;
    if (previousHost === undefined) delete process.env.EMAIL_HOST;
    else process.env.EMAIL_HOST = previousHost;
    if (previousSecret === undefined) delete process.env.ABG_SECRET;
    else process.env.ABG_SECRET = previousSecret;
  }
  const [, userId, token] = message.match(/\/login\/([^/]+)\/([^/]+)$/);
  assert.equal(userId, userIdForEmail("user@example.com"));
  verifyLogin(userId, token);
  assert.throws(
    () => verifyLogin(userId, token),
    /Token invalid or has expired/
  );

  process.env.ABG_SECRET = "test-secret";
  const cookie = sessionCookie(userId).split(";")[0];
  assert.equal(currentUser({ headers: { cookie } }), userId);
  if (previousSecret === undefined) delete process.env.ABG_SECRET;
  else process.env.ABG_SECRET = previousSecret;
});

test("login mail sender can be configured with EMAIL_FROM", () => {
  process.env.EMAIL_FROM = "abg@example.net";
  try {
    assert.equal(mailFromOrigin("http://192.168.0.3:8080"), "abg@example.net");
  } finally {
    delete process.env.EMAIL_FROM;
  }
});

test("login mail has a Japanese version", () => {
  assert.equal(mailLanguage("ja,en-US;q=0.9"), "ja");
  const mail = authenticationMail("http://example/login/u/t", "ja");
  assert.match(mail.subject, /ログイン/);
  assert.match(mail.text, /http:\/\/example\/login\/u\/t/);
});

test("login can be restricted to an email allowlist", async () => {
  process.env.ABG_ALLOWED_EMAILS = " Member@Example.com ,other@example.com";
  process.env.EMAIL_HOST = "fake";
  try {
    assert.equal(isEmailAllowed("member@example.com "), true);
    assert.equal(isEmailAllowed("stranger@example.com"), false);
    await assert.rejects(
      requestLogin("stranger@example.com", "http://localhost:8080"),
      (error) => error.status === 403
    );
  } finally {
    delete process.env.ABG_ALLOWED_EMAILS;
  }
  assert.equal(isEmailAllowed("anyone@example.com"), true);
});

test("session cookie is Secure only when the site uses HTTPS", () => {
  const previous = process.env.CLIENT_URL;
  try {
    process.env.CLIENT_URL = "https://vbg.example";
    assert.match(sessionCookie("user"), /; Secure$/);
    process.env.CLIENT_URL = "http://192.168.0.3:8080";
    assert.doesNotMatch(sessionCookie("user"), /Secure/);
  } finally {
    if (previous === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = previous;
  }
});

test("login links are rate limited per address", async () => {
  process.env.EMAIL_HOST = "fake";
  await requestLogin("rate@example.com", "http://localhost:8080");
  await assert.rejects(
    requestLogin(" RATE@example.com", "http://localhost:8080"),
    (error) => error.status === 429
  );
});
