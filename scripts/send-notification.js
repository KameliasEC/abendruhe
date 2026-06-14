/* ============================================
   Abendruhe – Sendet die abendliche Push-Notification
   Läuft jeden Abend auf GitHub Actions.
   ============================================ */

const webpush = require('web-push');

// Werte werden von GitHub Actions aus den Secrets eingespielt
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBSCRIPTION      = JSON.parse(process.env.PUSH_SUBSCRIPTION);
const APP_URL           = process.env.APP_URL || 'https://kameliasec.github.io/abendruhe/';
const CONTACT_EMAIL     = process.env.CONTACT_EMAIL || 'mailto:noreply@example.com';

// VAPID-Identifikation für den Push-Service (Apple/Google wissen so, wer wir sind)
webpush.setVapidDetails(
    CONTACT_EMAIL.startsWith('mailto:') ? CONTACT_EMAIL : 'mailto:' + CONTACT_EMAIL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// Kleine Auswahl an Nachrichten – damit es nicht jeden Abend gleich ist
const messages = [
    'Zeit für deine Schlafmeditation 🌙',
    'Leg das Handy weg. Atme.',
    'Eine kleine Pause vor dem Schlafen?',
    'Heute Abend: ein paar Minuten für dich.',
    'Dein Kopf hat eine Verschnaufpause verdient.',
    'Atme tief ein. Lass den Tag los.',
    'Bevor du weiter scrollst – komm her.'
];
const body = messages[Math.floor(Math.random() * messages.length)];

const payload = JSON.stringify({
    title: 'Abendruhe',
    body: body,
    url: APP_URL
});

webpush.sendNotification(SUBSCRIPTION, payload)
    .then(() => {
        console.log('✓ Notification gesendet:', body);
    })
    .catch(err => {
        console.error('✗ Fehler beim Senden:');
        console.error('  Status:', err.statusCode);
        console.error('  Body:', err.body);
        // Status 410 = Subscription ist abgelaufen → User muss sich neu subscriben
        if (err.statusCode === 410) {
            console.error('  → Die Subscription ist nicht mehr gültig. In der PWA neu aktivieren und den Code in GitHub-Secrets aktualisieren.');
        }
        process.exit(1);
    });
