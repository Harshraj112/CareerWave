/**
 * Job alerts — WhatsApp or Telegram, daily or weekly.
 * Nothing is sent until the user picks a channel, adds their contact AND ticks
 * the permission box. Delivered by web-parsing/notification-service through
 * the backend (/users/me/preferences, /users/me/job-alerts).
 */
import React, { useEffect, useState } from 'react';
import { Bell, MessageCircle, Send, CheckCircle2, BellOff } from 'lucide-react';
import type { NotificationChannel, PublicConfig } from '../types';
import { useCareer } from '../state/CareerContext';
import { ApiService, errorMessage } from '../services/api';
import { Card, Chip, ErrorPanel, PageHeader, PrimaryButton } from './ui';

export default function NotificationsTab() {
  const { state, savePreferences, demo } = useCareer();
  const n = state.preferences.notifications;
  const role = state.preferences.jobSearch.role || state.profile.targetRole;
  const [channel, setChannel] = useState<NotificationChannel | null>(n.channel);
  const [whatsapp, setWhatsapp] = useState(n.whatsappNumber ? `+${n.whatsappNumber}` : '');
  const [telegram, setTelegram] = useState(n.telegramChatId || '');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(n.frequency);
  const [consent, setConsent] = useState(n.consent);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'test' | 'send' | 'off'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    ApiService.getConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  const recipient = channel === 'whatsapp' ? whatsapp.trim() : channel === 'telegram' ? telegram.trim() : '';
  const canEnable = Boolean(channel && recipient && consent);
  const channelReady = (c: NotificationChannel) => !config || config.notificationChannels[c];

  const act = async (kind: 'save' | 'test' | 'send' | 'off', fn: () => Promise<string>) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const save = () => act('save', async () => {
    await savePreferences({
      notifications: {
        channel,
        frequency,
        consent,
        whatsappNumber: channel === 'whatsapp' ? whatsapp : undefined,
        telegramChatId: channel === 'telegram' ? telegram : undefined,
        enabled: canEnable,
      },
    });
    return `Job alerts are on. You'll get ${frequency} ${role} matches on ${channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}.`;
  });

  const turnOff = () => act('off', async () => {
    await savePreferences({ notifications: { enabled: false, consent: false } });
    setConsent(false);
    return 'Job alerts are off. We will not send you any messages.';
  });

  const sendTest = () => act('test', async () => {
    await ApiService.sendTestNotification();
    return 'Test message sent. Check your app.';
  });

  const sendNow = () => act('send', async () => {
    const ok = await ApiService.triggerJobAlerts();
    return ok ? 'Sent your latest matches.' : 'No new matching jobs to send right now.';
  });

  if (demo) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader icon={Bell} title="Job alerts" />
        <Card className="text-sm text-slate-600">Job alerts are available once you upload your own resume or build your own roadmap (they're turned off in sample mode).</Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader icon={Bell} title="Job alerts" subtitle={`New ${role} jobs that match your preferences, sent to you`} />

      {n.enabled && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Alerts are on — {n.frequency} on {n.channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
            {n.lastSentAt && <span className="text-emerald-700"> · last sent {new Date(n.lastSentAt).toLocaleDateString()}</span>}
          </p>
          <div className="flex gap-2">
            <button onClick={sendTest} disabled={busy !== null} className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-semibold text-emerald-800 disabled:opacity-50">
              {busy === 'test' ? 'Sending…' : 'Send a test message'}
            </button>
            <button onClick={sendNow} disabled={busy !== null} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
              {busy === 'send' ? 'Sending…' : 'Send matches now'}
            </button>
          </div>
        </div>
      )}

      <Card className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-800 mb-2">Where should we send job alerts?</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['whatsapp', 'telegram'] as NotificationChannel[]).map((c) => {
              const Icon = c === 'whatsapp' ? MessageCircle : Send;
              const ready = channelReady(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={channel === c}
                  disabled={!ready}
                  onClick={() => setChannel(c)}
                  className={`p-4 rounded-xl border text-left flex items-center gap-3 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    channel === c ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${c === 'whatsapp' ? 'text-emerald-600' : 'text-sky-600'}`} />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{c === 'whatsapp' ? 'WhatsApp' : 'Telegram'}</div>
                    {!ready && <div className="text-xs text-slate-500">Not available yet</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </fieldset>

        {channel === 'whatsapp' && (
          <div className="space-y-2">
            <label htmlFor="wa" className="block text-sm font-semibold text-slate-800">WhatsApp number</label>
            <input id="wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210"
              className="w-full max-w-xs px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <p className="text-xs text-slate-500">Include the country code. 10-digit Indian numbers get +91 automatically.</p>
          </div>
        )}

        {channel === 'telegram' && (
          <div className="space-y-2">
            <label htmlFor="tg" className="block text-sm font-semibold text-slate-800">Telegram chat ID</label>
            <input id="tg" value={telegram} onChange={(e) => setTelegram(e.target.value)} inputMode="numeric" placeholder="123456789"
              className="w-full max-w-xs px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <p className="text-xs text-slate-500">
              {config?.telegramBotUsername
                ? <>First open <a className="text-blue-600 underline" href={`https://t.me/${config.telegramBotUsername}`} target="_blank" rel="noopener noreferrer">@{config.telegramBotUsername}</a> and press Start. </>
                : 'First start a chat with the Career Wave bot. '}
              To find your chat ID, message @userinfobot on Telegram.
            </p>
          </div>
        )}

        <fieldset>
          <legend className="text-sm font-semibold text-slate-800 mb-2">How often?</legend>
          <div className="flex gap-2">
            <Chip selected={frequency === 'daily'} onClick={() => setFrequency('daily')}>Daily</Chip>
            <Chip selected={frequency === 'weekly'} onClick={() => setFrequency('weekly')}>Weekly</Chip>
          </div>
        </fieldset>

        <label className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 rounded border-slate-300" />
          <span className="text-sm text-slate-700">
            I agree to receive {frequency} job alerts from Career Wave
            {channel ? ` on ${channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}` : ''} at the contact above. I can turn them off at any time here.
          </span>
        </label>

        {error && <ErrorPanel message={error} />}
        {notice && <p className="text-sm text-emerald-700 font-semibold" role="status">{notice}</p>}

        <div className="flex items-center gap-3 flex-wrap">
          <PrimaryButton onClick={save} disabled={!canEnable || busy !== null}>
            {busy === 'save' ? 'Saving…' : n.enabled ? 'Update alerts' : 'Turn on job alerts'}
          </PrimaryButton>
          {n.enabled && (
            <button onClick={turnOff} disabled={busy !== null} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-red-600">
              <BellOff className="w-4 h-4" /> Turn off alerts
            </button>
          )}
          {!canEnable && <span className="text-xs text-slate-500">Choose a channel, add your contact and tick the permission box.</span>}
        </div>
      </Card>
    </div>
  );
}
