/* ============================================
   Abendruhe – Multi-User-Notification-Sender
   Läuft alle 15 Minuten via GitHub Actions.
   ============================================ */

const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const VAPID_PUBLIC_KEY    = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY   = process.env.VAPID_PRIVATE_KEY;
const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const APP_URL             = process.env.APP_URL || 'https://kameliasec.github.io/abendruhe/';
const CONTACT_EMAIL       = process.env.CONTACT_EMAIL || 'mailto:noreply@example.com';

// Wie viele Minuten +/- der User-Zeit wir akzeptieren (Cron läuft alle 15 min)
const WINDOW_MINUTES = 15;
// Wie lange nach dem letzten Senden wir nicht nochmal senden (verhindert Duplikate)
const COOLDOWN_HOURS = 12;

webpush.setVapidDetails(
    CONTACT_EMAIL.startsWith('mailto:') ? CONTACT_EMAIL : 'mailto:' + CONTACT_EMAIL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false }
});

const messages = [
    'Zeit für deine Schlafmeditation 🌙',
    'Leg das Handy weg. Atme.',
    'Eine kleine Pause vor dem Schlafen?',
    'Heute Abend: ein paar Minuten für dich.',
    'Dein Kopf hat eine Verschnaufpause verdient.',
    'Atme tief ein. Lass den Tag los.',
    'Bevor du weiter scrollst – komm her.'
];

// Aktuelle Stunde:Minute in einer bestimmten Zeitzone berechnen
function getCurrentTimeInTimezone(timezone) {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(new Date());
        const hour = parseInt(parts.find(p => p.type === 'hour').value);
        const minute = parseInt(parts.find(p => p.type === 'minute').value);
        return { hour, minute };
    } catch (e) {
        // Falls Zeitzone ungültig: UTC als Fallback
        const now = new Date();
        return { hour: now.getUTCHours(), minute: now.getUTCMinutes() };
    }
}

// Wie viele Minuten zwischen zwei Tageszeiten? (mit 24h-Umlauf)
function minutesDifference(a, b) {
    const diff = Math.abs(a - b);
    return Math.min(diff, 24 * 60 - diff);
}

async function main() {
    const now = new Date();
    console.log('Run gestartet:', now.toISOString());

    // Alle Subscriptions holen
    const { data: subs, error } = await supabase
        .from('subscriptions')
        .select('*');

    if (error) {
        console.error('✗ Fehler beim Lesen aus Supabase:', error);
        process.exit(1);
    }

    console.log(`Gefunden: ${subs.length} Subscription(s)`);
    let sent = 0, skipped = 0, removed = 0, failed = 0;

    for (const sub of subs) {
        const idShort = sub.id.slice(0, 8);
        try {
            // 1) Ist es gerade Zeit für diesen User?
            const userTime = getCurrentTimeInTimezone(sub.timezone);
            const currentMins = userTime.hour * 60 + userTime.minute;
            const targetMins  = sub.reminder_hour * 60 + sub.reminder_minute;
            const diff = minutesDifference(currentMins, targetMins);

            if (diff > WINDOW_MINUTES) {
                skipped++;
                continue;
            }

            // 2) Vor Kurzem schon gesendet?
            if (sub.last_sent_at) {
                const hoursSince = (now - new Date(sub.last_sent_at)) / 1000 / 3600;
                if (hoursSince < COOLDOWN_HOURS) {
                    console.log(`  ⏸  ${idShort} – vor ${hoursSince.toFixed(1)}h schon geschickt`);
                    skipped++;
                    continue;
                }
            }

            // 3) Senden
            const body = messages[Math.floor(Math.random() * messages.length)];
            const payload = JSON.stringify({
                title: 'Abendruhe',
                body: body,
                url: APP_URL
            });

            await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payload);

            console.log(`  ✓  ${idShort} (Zeit ${sub.reminder_hour}:${String(sub.reminder_minute).padStart(2,'0')} ${sub.timezone}) – "${body}"`);
            sent++;

            // 4) last_sent_at aktualisieren
            await supabase
                .from('subscriptions')
                .update({ last_sent_at: now.toISOString() })
                .eq('id', sub.id);

        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                // Subscription nicht mehr gültig → aus DB entfernen
                console.log(`  🗑  ${idShort} – Subscription abgelaufen, lösche`);
                await supabase.from('subscriptions').delete().eq('id', sub.id);
                removed++;
            } else {
                console.error(`  ✗  ${idShort} – Fehler:`, err.statusCode || err.message);
                failed++;
            }
        }
    }

    console.log(`Fertig: ${sent} gesendet, ${skipped} übersprungen, ${removed} gelöscht, ${failed} fehlgeschlagen`);
}

main().catch(err => {
    console.error('Fataler Fehler:', err);
    process.exit(1);
});
