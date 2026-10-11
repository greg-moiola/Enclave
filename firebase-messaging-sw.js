
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

messaging.onBackgroundMessage((payload) => {
    const notificationTitle =
        payload.notification?.title || "Nuovo messaggio su Enclave";

    const notificationOptions = {
        body: payload.notification?.body || "Hai ricevuto un nuovo messaggio.",
        icon: "/Enclave/favicon.ico",
        data: payload.data || {}
    };

    self.registration.showNotification(
        notificationTitle,
        notificationOptions
    );
});

