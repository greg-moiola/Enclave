importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyB-FHlUxlmUcWMVUU0k3KflAem2bycTJbI",
    authDomain: "enclave-v2.firebaseapp.com",
    projectId: "enclave-v2",
    storageBucket: "enclave-v2.firebasestorage.app",
    messagingSenderId: "840410857230",
    appId: "1:840410857230:web:f4a50e2ae7f4c53c99615f"
});

const messaging = firebase.messaging();

// Il Worker Cloudflare invia payload solo-data: qui mostriamo la notifica
// quando la pagina è in background o sospesa dal sistema operativo.
messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const notificationTitle = data.title || "Nuovo messaggio su Enclave";
    const notificationOptions = {
        body: data.body || "Hai ricevuto un nuovo messaggio.",
        icon: "/Enclave/images/Enclave_icon_192.png",
        badge: "/Enclave/images/Enclave_badge.png",
        tag: data.messageId || undefined,
        renotify: false,
        data
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = new URL("/Enclave/", self.location.origin).href;
    event.waitUntil((async () => {
        const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clientsList) {
            if (client.url.startsWith(targetUrl) && "focus" in client) {
                return client.focus();
            }
        }
        return self.clients.openWindow(targetUrl);
    })());
});
