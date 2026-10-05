/**
 * Job-search + notification preferences, and the existing endpoints
 * /users/me/telegram, /users/me/whatsapp and /users/me/job-alerts.
 *
 * Consent rules: alerts are only enabled when the request carries
 * consent === true together with a channel and recipient. Turning alerts off
 * or withdrawing consent always works and stops all sending immediately.
 */
import { Router } from "express";
import { publicState } from "../store.js";
import { canNotify, recipientFor } from "../services/notificationService.js";
import { asyncRoute, cleanList, cleanString, httpError } from "./helpers.js";

const JOB_TYPES = ["full-time", "internship", "part-time", "contract", "entry-level", "graduate"];

export function normalizeWhatsApp(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  // Bare 10-digit Indian mobile numbers get the 91 country code.
  const full = digits.length === 10 && /^[6-9]/.test(digits) ? `91${digits}` : digits;
  if (full.length < 11 || full.length > 15) throw httpError(400, "Enter your WhatsApp number with country code, e.g. +91 98765 43210.");
  return full;
}

export function normalizeTelegram(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  if (!/^-?\d{5,15}$/.test(s)) throw httpError(400, "Enter your numeric Telegram chat ID (for example 123456789).");
  return s;
}

export function notificationRoutes({ store, notify, scheduler, jobs, telegramBotUsername }) {
  const r = Router();

  r.get("/users/me/preferences", asyncRoute(async (req, res) => {
    const user = await store.getUser(req.user.sub);
    res.json({ ...publicState(user).preferences, channelsAvailable: await notify.channels(), telegramBotUsername });
  }));

  r.put("/users/me/preferences", asyncRoute(async (req, res) => {
    const b = req.body || {};
    const record = await store.updateUser(req.user.sub, (u) => {
      if (b.jobSearch) {
        const js = u.preferences.jobSearch;
        if (b.jobSearch.role !== undefined) js.role = cleanString(b.jobSearch.role, 100);
        if (b.jobSearch.locations !== undefined) js.locations = cleanList(b.jobSearch.locations, { max: 10 });
        if (b.jobSearch.remote !== undefined) js.remote = Boolean(b.jobSearch.remote);
        if (b.jobSearch.jobTypes !== undefined) js.jobTypes = cleanList(b.jobSearch.jobTypes, { max: 6 }).filter((t) => JOB_TYPES.includes(t));
        js.updatedAt = new Date().toISOString();
      }
      if (b.notifications) {
        const n = u.preferences.notifications;
        const nb = b.notifications;
        if (nb.channel !== undefined) {
          if (nb.channel !== null && !["telegram", "whatsapp"].includes(nb.channel)) throw httpError(400, "Choose WhatsApp or Telegram.");
          n.channel = nb.channel;
        }
        if (nb.telegramChatId !== undefined) n.telegramChatId = normalizeTelegram(nb.telegramChatId);
        if (nb.whatsappNumber !== undefined) n.whatsappNumber = normalizeWhatsApp(nb.whatsappNumber);
        if (nb.frequency !== undefined) n.frequency = nb.frequency === "daily" ? "daily" : "weekly";
        if (nb.consent !== undefined) {
          n.consent = nb.consent === true;
          n.consentAt = n.consent ? new Date().toISOString() : null;
        }
        if (nb.enabled !== undefined) n.enabled = nb.enabled === true;
        const ready = n.consent && n.channel && recipientFor(n);
        if (nb.enabled === true && !ready) {
          throw httpError(400, "To turn on alerts, choose a channel, add your contact and confirm your permission.");
        }
        // Withdrawing consent or removing the contact always stops sending.
        if (!ready) n.enabled = false;
        n.updatedAt = new Date().toISOString();
      }
    });
    if (b.jobSearch) {
      // Make sure jobs exist for the (possibly new) role.
      jobs?.requestScrape(record.preferences.jobSearch.role || record.profile.targetRole);
    }
    res.json(publicState(record).preferences);
  }));

  // Existing endpoint: link / unlink Telegram. Body: { chatId }
  r.put("/users/me/telegram", asyncRoute(async (req, res) => {
    const chatId = normalizeTelegram(req.body?.chatId);
    await store.updateUser(req.user.sub, (u) => {
      u.preferences.notifications.telegramChatId = chatId;
      if (!chatId && u.preferences.notifications.channel === "telegram") u.preferences.notifications.enabled = false;
    });
    res.json({ linked: Boolean(chatId) });
  }));

  // Existing endpoint: link / unlink WhatsApp. Body: { phoneNumber }
  r.put("/users/me/whatsapp", asyncRoute(async (req, res) => {
    const phone = normalizeWhatsApp(req.body?.phoneNumber);
    await store.updateUser(req.user.sub, (u) => {
      u.preferences.notifications.whatsappNumber = phone;
      if (!phone && u.preferences.notifications.channel === "whatsapp") u.preferences.notifications.enabled = false;
    });
    res.json({ linked: Boolean(phone) });
  }));

  // Existing endpoint: send matching jobs now (only with consent).
  r.post("/users/me/job-alerts", asyncRoute(async (req, res) => {
    const user = await store.getUser(req.user.sub);
    if (!canNotify(user.preferences.notifications)) {
      throw httpError(409, "Turn on job alerts and confirm your permission first.");
    }
    const result = await scheduler.sendDigest(user, { force: true });
    if (!result.sent) return res.json({ sent: false, reason: result.reason, message: "No new matching jobs to send right now." });
    res.json(result);
  }));

  // A short confirmation message so the user can check the channel works.
  r.post("/users/me/notifications/test", asyncRoute(async (req, res) => {
    const user = await store.getUser(req.user.sub);
    const n = user.preferences.notifications;
    if (!n.consent) throw httpError(409, "Confirm your permission to receive messages first.");
    if (!n.channel || !recipientFor(n)) throw httpError(400, "Choose a channel and add your contact first.");
    const role = user.preferences.jobSearch.role || user.profile.targetRole || "your target role";
    await notify.sendText(n.channel, recipientFor(n), `✅ Career Wave job alerts are connected. You'll get ${n.frequency} ${role} jobs here. Reply STOP in the app settings to turn them off.`);
    res.json({ sent: true, channel: n.channel });
  }));

  return r;
}
