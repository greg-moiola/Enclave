import {
    registerUser,
    loginUser
} from "./auth.js";

import {
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    db,
    auth
} from "./firebase.js";

import {
    getMessaging,
    getToken,
    onMessage,
    isSupported
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";

import { app } from "./firebase.js";


console.log("Enclave avviato correttamente.");


// =========================
// FUNZIONI SCHERMATE
// =========================

const registerScreen =
    document.getElementById("registerScreen");

const loginScreen =
    document.getElementById("loginScreen");

const homeScreen =
    document.getElementById("homeScreen");

const verificationOverlay =
    document.getElementById("verificationOverlay");

const verificationEmail =
    document.getElementById("verificationEmail");

const verificationMessage =
    document.getElementById("verificationMessage");

const verificationSpinner =
    document.getElementById("verificationSpinner");

const userEnclaveId =
    document.getElementById("userEnclaveId");

const userNickname =
    document.getElementById("userNickname");

const profileNickname =
    document.getElementById("profileNickname");

const profileEnclaveId =
    document.getElementById("profileEnclaveId");

const profileInitial =
    document.getElementById("profileInitial");

const resendVerificationButton =
    document.getElementById("resendVerificationButton");

const chatEmptyState =
    document.getElementById("chatEmptyState");

const activeChat =
    document.getElementById("activeChat");

const chatUserAvatar =
    document.getElementById("chatUserAvatar");

const chatUserNickname =
    document.getElementById("chatUserNickname");

const chatUserId =
    document.getElementById("chatUserId");

const chatUserInfo =
    document.querySelector(".chat-user-info");

const chatBackButton =
    document.getElementById("chatBackButton");

const homeMain =
    document.querySelector(".home-main");

const chatArea =
    document.querySelector(".chat-area");

const chatSidebar =
    document.querySelector(".chat-sidebar");

const chatMessages =
    document.getElementById("chatMessages");

const messageInput =
    document.getElementById("messageInput");

const sendMessageButton =
    document.getElementById("sendMessageButton");

const chatSearch =
    document.getElementById("chatSearch");

const searchResults =
    document.getElementById("searchResults");

const newGroupButton =
    document.getElementById("newGroupButton");

const notificationsOverlay =
    document.getElementById("notificationsOverlay");

const activateNotificationsButton =
    document.getElementById("activateNotificationsButton");

const skipNotificationsButton =
    document.getElementById("skipNotificationsButton");

const notificationsPopupMessage =
    document.getElementById("notificationsPopupMessage");



let currentChatUserUid = null;

let currentChatId = null;

let unsubscribeMessages = null;

// Evita che il caricamento asincrono di una vecchia chat sovrascriva quella appena aperta.
let messagesLoadVersion = 0;

let unsubscribeChats = null;

let conversationsRenderVersion = 0;

// Cache breve dei profili pubblici: evita di rileggere da Firestore gli stessi
// nickname a ogni aggiornamento della lista chat. Scade automaticamente e viene
// invalidata subito quando l'utente cambia il proprio nickname.
const publicUserSnapshotCache = new Map();
const PUBLIC_USER_CACHE_TTL_MS = 30_000;

async function getCachedPublicUserSnapshot(uid) {
    const now = Date.now();
    const cached = publicUserSnapshotCache.get(uid);

    if (cached && cached.expiresAt > now) {
        return cached.promise;
    }

    const promise = getDoc(doc(db, "publicUsers", uid)).catch((error) => {
        publicUserSnapshotCache.delete(uid);
        throw error;
    });

    publicUserSnapshotCache.set(uid, {
        promise,
        expiresAt: now + PUBLIC_USER_CACHE_TTL_MS
    });

    return promise;
}

function invalidatePublicUserSnapshot(uid) {
    publicUserSnapshotCache.delete(uid);
}

let unsubscribeReadStates = [];

let unreadMessageListeners = new Map();

let unreadTrackingStartUid = null;

let unreadTrackingStartPromise = null;


// =========================
// NOTIFICHE PUSH
// =========================

const ENCLAVE_VAPID_KEY =
    "BGbi6huAaDx6taFFgwQ0ipz5VDpJ1r0ia1rFGXR3GZrEEb0jiNeBpikMbkwALoTIRKCoo-29nU9Dq6NwO3cPUZc";

let foregroundMessageListenerRegistered = false;


async function enableEnclaveNotifications(requestPermission = true) {
    try {
        const currentUser = auth.currentUser;

        if (!currentUser || !currentUser.emailVerified) {
            return false;
        }

        if (
            !("Notification" in window) ||
            !("serviceWorker" in navigator)
        ) {
            if (requestPermission) {
                alert("Questo browser non supporta le notifiche push.");
            }
            return false;
        }

        if (!(await isSupported())) {
            if (requestPermission) {
                alert("Le notifiche push non sono supportate su questo dispositivo.");
            }
            return false;
        }

        let permission = Notification.permission;

        if (permission === "default" && requestPermission) {
            permission = await Notification.requestPermission();
        }

        if (permission !== "granted") {
            if (requestPermission) {
                alert("Permesso per le notifiche non concesso.");
            }
            return false;
        }

        // Registra il Service Worker e aspetta che sia attivo.
        await navigator.serviceWorker.register(
            "/Enclave/firebase-messaging-sw.js",
            { scope: "/Enclave/" }
        );

        const serviceWorkerRegistration =
            await navigator.serviceWorker.ready;

        const messaging = getMessaging(app);

        // Mostra una notifica anche quando Enclave è aperto e la pagina è in primo
        // piano. Quando la pagina è in background/chiusa, ci pensa il service worker.
        // Il listener viene registrato una sola volta per evitare notifiche duplicate.
        if (!foregroundMessageListenerRegistered) {
            onMessage(messaging, async (payload) => {
                try {
                    const title =
                        payload.notification?.title ||
                        payload.data?.title ||
                        "Nuovo messaggio su Enclave";

                    const body =
                        payload.notification?.body ||
                        payload.data?.body ||
                        "Hai ricevuto un nuovo messaggio.";

                    const registration = await navigator.serviceWorker.ready;
                    await registration.showNotification(title, {
                        body,
                        icon: "/Enclave/images/Enclave_icon_192.png",
                        badge: "/Enclave/images/Enclave_icon_192.png",
                        tag: payload.data?.messageId || undefined,
                        data: payload.data || {}
                    });
                } catch (error) {
                    console.error("Impossibile mostrare la notifica in primo piano:", error);
                }
            });

            foregroundMessageListenerRegistered = true;
        }

        const token = await getToken(messaging, {
            vapidKey: ENCLAVE_VAPID_KEY,
            serviceWorkerRegistration
        });

        if (!token) {
            throw new Error("Token FCM non generato.");
        }

        // Salva il token nel profilo dell'utente autenticato.
        await updateDoc(
            doc(db, "users", currentUser.uid),
            {
                fcmTokens: arrayUnion(token)
            }
        );

        console.log("TOKEN FCM SALVATO CORRETTAMENTE");
        console.log("UID:", currentUser.uid);

        if (requestPermission) {
            alert("Notifiche abilitate su questo dispositivo!");
        }

        return true;

    } catch (error) {
        console.error(
            "Errore durante la registrazione delle notifiche:",
            error
        );

        if (requestPermission) {
            alert(
                "Non siamo riusciti ad attivare le notifiche. " +
                "Controlla la console."
            );
        }

        return false;
    }
}



// =========================
// POPUP INIZIALE NOTIFICHE
// =========================

const NOTIFICATIONS_PROMPT_KEY =
    "enclaveNotificationsPromptChoice";


function maybeShowNotificationsPrompt() {
    if (!auth.currentUser?.emailVerified) return;

    if (Notification.permission === "granted") {
        localStorage.setItem(NOTIFICATIONS_PROMPT_KEY, "done");

        // Il permesso esiste già: registra automaticamente il token.
        enableEnclaveNotifications(false).catch(error => {
            console.error("Registrazione automatica FCM fallita:", error);
        });

        return;
    }

    if (Notification.permission === "denied") {
        localStorage.setItem(NOTIFICATIONS_PROMPT_KEY, "done");
        return;
    }

    if (localStorage.getItem(NOTIFICATIONS_PROMPT_KEY)) return;

    notificationsOverlay?.classList.remove("hidden");
}


function closeNotificationsPrompt() {
    localStorage.setItem(NOTIFICATIONS_PROMPT_KEY, "done");
    notificationsOverlay?.classList.add("hidden");
}

skipNotificationsButton?.addEventListener("click", () => {
    closeNotificationsPrompt();
});

activateNotificationsButton?.addEventListener("click", async () => {
    if (activateNotificationsButton.disabled) return;

    activateNotificationsButton.disabled = true;
    skipNotificationsButton.disabled = true;

    notificationsPopupMessage.textContent =
        "Stiamo attivando le notifiche...";

    try {
        const enabled = await enableEnclaveNotifications();

                    if (!enabled) {
                        notificationsPopupMessage.textContent =
                            "Attivazione non riuscita. Riprova più tardi.";
                    
                        return;
                    }

        if (Notification.permission === "granted") {
            notificationsPopupMessage.textContent =
                "Permesso ottenuto su questo dispositivo.";
        } else {
            notificationsPopupMessage.textContent =
                "Permesso non concesso. Potrai modificarlo dalle impostazioni del dispositivo.";
        }

        closeNotificationsPrompt();
    } catch (error) {
        console.error("Errore notifiche:", error);

        notificationsPopupMessage.textContent =
            "Non siamo riusciti ad attivarle. Riprova più tardi.";
    } finally {
        activateNotificationsButton.disabled = false;
        skipNotificationsButton.disabled = false;
    }
});

// =========================
// RISPOSTA A UN MESSAGGIO
// =========================

let replyTarget = null;


// =========================
// CAMBIO SCHERMATE
// =========================

function showRegister() {

    registerScreen.classList.remove("hidden");

    loginScreen.classList.add("hidden");

    homeScreen.classList.add("hidden");

}


function showLogin() {

    registerScreen.classList.add("hidden");

    loginScreen.classList.remove("hidden");

    homeScreen.classList.add("hidden");

}


function showHome() {

    registerScreen.classList.add("hidden");

    loginScreen.classList.add("hidden");

    homeScreen.classList.remove("hidden");

    maybeShowNotificationsPrompt();

}


// =========================
// PROFILO UTENTE
// =========================

async function loadUserProfile(user) {

    const userDocument =
        await getDoc(
            doc(db, "users", user.uid)
        );

    console.log("PROFILO DA CARICARE:", {
    uidRichiesto: user.uid,
    uidAutenticato: auth.currentUser?.uid,
    stessoUtente: user.uid === auth.currentUser?.uid
});


    if (!userDocument.exists()) {

        console.error(
            "Profilo utente non trovato."
        );

        return;
    }


    const userData =
        userDocument.data();


    const nickname =
        userData.nickname;

    const enclaveId =
        userData.enclaveId;


    userNickname.textContent =
        nickname;

    userEnclaveId.textContent =
        enclaveId;


    profileNickname.textContent =
        nickname;

    profileEnclaveId.textContent =
        enclaveId;


    profileInitial.textContent =
        nickname.charAt(0).toUpperCase();

}


// =========================
// MODIFICA NICKNAME PERSONALE
// =========================

let ownProfileNicknameOverlay = null;

function createOwnProfileNicknamePanel() {
    if (ownProfileNicknameOverlay) return ownProfileNicknameOverlay;

    const overlay = document.createElement("div");
    overlay.className = "group-info-overlay hidden";
    overlay.id = "ownProfileNicknameOverlay";

    const panel = document.createElement("div");
    panel.className = "group-info-panel";

    const header = document.createElement("div");
    header.className = "group-info-header";

    const title = document.createElement("h2");
    title.className = "group-info-title";
    title.textContent = "Modifica nickname";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "group-info-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Chiudi");

    header.append(title, closeButton);

    const content = document.createElement("div");
    content.className = "own-profile-nickname-content";

    const label = document.createElement("label");
    label.htmlFor = "ownProfileNicknameInput";
    label.textContent = "Il tuo nickname";

    const input = document.createElement("input");
    input.id = "ownProfileNicknameInput";
    input.className = "contact-nickname-input";
    input.type = "text";
    input.maxLength = 40;
    input.autocomplete = "nickname";
    input.placeholder = "Inserisci il nickname";

    const note = document.createElement("p");
    note.className = "own-profile-nickname-note";
    note.textContent = "Il tuo EnclaveID e i soprannomi personalizzati scelti dai tuoi contatti non cambieranno.";

    const actions = document.createElement("div");
    actions.className = "contact-nickname-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "contact-nickname-cancel";
    cancelButton.textContent = "Annulla";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "contact-nickname-save";
    saveButton.textContent = "Salva";

    const status = document.createElement("p");
    status.className = "own-profile-nickname-status";
    status.setAttribute("role", "status");

    actions.append(cancelButton, saveButton);
    content.append(label, input, note, actions, status);
    panel.append(header, content);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const close = () => overlay.classList.add("hidden");
    closeButton.addEventListener("click", close);
    cancelButton.addEventListener("click", close);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
    });

    const save = async () => {
        const user = auth.currentUser;
        const nickname = input.value.trim();

        if (!user) {
            status.textContent = "Devi effettuare nuovamente l'accesso.";
            return;
        }
        if (!nickname) {
            status.textContent = "Il nickname non può essere vuoto.";
            input.focus();
            return;
        }
        if (nickname.length > 40) {
            status.textContent = "Il nickname può contenere al massimo 40 caratteri.";
            input.focus();
            return;
        }

        saveButton.disabled = true;
        cancelButton.disabled = true;
        status.textContent = "Salvataggio…";

        try {
            // Il nickname originale è conservato sia nel profilo privato
            // sia nel profilo pubblico letto dagli altri utenti.
            await Promise.all([
                updateDoc(doc(db, "users", user.uid), {
                    nickname,
                    updatedAt: serverTimestamp()
                }),
                updateDoc(doc(db, "publicUsers", user.uid), {
                    nickname,
                    updatedAt: serverTimestamp()
                })
            ]);

            invalidatePublicUserSnapshot(user.uid);

            userNickname.textContent = nickname;
            profileNickname.textContent = nickname;
            profileInitial.textContent = nickname.charAt(0).toUpperCase();

            // Aggiorna gli eventuali riferimenti al proprio nickname nella UI.
            const headerNickname = document.querySelector(".user-nickname");
            if (headerNickname) headerNickname.textContent = nickname;

            status.textContent = "Nickname aggiornato.";
            window.setTimeout(() => overlay.classList.add("hidden"), 350);
        } catch (error) {
            console.error("Errore modifica nickname personale:", error);
            status.textContent = error.message || "Impossibile salvare il nickname. Riprova.";
        } finally {
            saveButton.disabled = false;
            cancelButton.disabled = false;
        }
    };

    saveButton.addEventListener("click", save);
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            save();
        }
        if (event.key === "Escape") close();
    });

    ownProfileNicknameOverlay = overlay;
    return overlay;
}

const editProfileNicknameButton =
    document.getElementById("editProfileNicknameButton");

if (editProfileNicknameButton) {
    editProfileNicknameButton.addEventListener("click", () => {
        const overlay = createOwnProfileNicknamePanel();
        const input = overlay.querySelector("#ownProfileNicknameInput");
        const status = overlay.querySelector(".own-profile-nickname-status");
        input.value = profileNickname.textContent.trim() === "—" ? "" : profileNickname.textContent.trim();
        status.textContent = "";
        overlay.classList.remove("hidden");
        window.setTimeout(() => {
            input.focus();
            input.select();
        }, 50);
    });
}


// =========================
// VERIFICA EMAIL
// =========================

function showVerification(user) {

    verificationEmail.textContent =
        user.email;

    verificationMessage.textContent =
        "";

    verificationSpinner.style.display =
        "none";

    verificationOverlay.classList.remove(
        "hidden"
    );

}


async function checkEmailVerification(user) {

    verificationSpinner.style.display =
        "block";


    await user.reload();


    if (user.emailVerified) {

        verificationSpinner.style.display =
            "none";

        verificationOverlay.classList.add(
            "hidden"
        );

        showRegister();

        return;
    }


    setTimeout(() => {

        checkEmailVerification(user);

    }, 2000);

}


// =========================
// REGISTRAZIONE
// =========================

document
    .getElementById("registerButton")
    .addEventListener(
        "click",
        async () => {

            const email =
                document
                    .getElementById("registerEmail")
                    .value
                    .trim();

            const password =
                document
                    .getElementById("registerPassword")
                    .value;

            const nickname =
                document
                    .getElementById("registerNickname")
                    .value
                    .trim();

            const message =
                document.getElementById("message");


            if (!email || !password || !nickname) {

                message.textContent =
                    "Compila tutti i campi.";

                return;
            }


            message.textContent =
                "Creazione account...";


            const result =
                await registerUser(
                    email,
                    password,
                    nickname
                );


            if (result.success) {

                showVerification(
                    result.user
                );

                checkEmailVerification(
                    result.user
                );

            } else {

                message.textContent =
                    "Errore: " +
                    result.error.message;

            }

        }
    );


// =========================
// APRI LOGIN
// =========================

document
    .getElementById("loginLink")
    .addEventListener(
        "click",
        () => {

            showLogin();

        }
    );


// =========================
// LOGIN
// =========================

document
    .getElementById("loginButton")
    .addEventListener(
        "click",
        async () => {

            const email =
                document
                    .getElementById("loginEmail")
                    .value
                    .trim();

            const password =
                document
                    .getElementById("loginPassword")
                    .value;

            const message =
                document.getElementById(
                    "loginMessage"
                );


            if (!email || !password) {

                message.textContent =
                    "Inserisci email e password.";

                return;
            }


            message.textContent =
                "Accesso in corso...";


            const result =
                await loginUser(
                    email,
                    password
                );


            if (result.success) {

                showHome();

                await loadUserProfile(
                    result.user
                );

                loadConversations();

            } else if (result.emailNotVerified) {

                message.textContent =
                    "Devi prima verificare la tua email.";

            } else {

                message.textContent =
                    "Email o password non corretti.";

                console.error(
                    result.error
                );

            }

        }
    );


// =========================
// TORNA ALLA REGISTRAZIONE
// =========================

document
    .getElementById("registerLink")
    .addEventListener(
        "click",
        () => {

            showRegister();

        }
    );


// =========================
// LOGOUT
// =========================

document
    .getElementById("logoutButton")
    .addEventListener(
        "click",
        () => {

            if (unsubscribeMessages) {

                unsubscribeMessages();

                unsubscribeMessages = null;

            }


            if (unsubscribeChats) {

                unsubscribeChats();

                unsubscribeChats = null;

            }


            currentChatUserUid = null;

            currentChatId = null;

            clearReply();


            showRegister();

        }
    );


// =========================
// REINVIO EMAIL
// =========================

resendVerificationButton
    .addEventListener(
        "click",
        async () => {

            const user =
                (
                    await import("./firebase.js")
                ).auth.currentUser;


            if (!user) {
                return;
            }


            try {

                await sendEmailVerification(
                    user
                );

                verificationMessage.textContent =
                    "Email inviata nuovamente.";

            } catch (error) {

                console.error(error);

                verificationMessage.textContent =
                    "Non è stato possibile inviare l'email.";

            }

        }
    );


// =========================
// ID CONVERSAZIONE
// =========================

function createChatId(uid1, uid2) {

    return [uid1, uid2]
        .sort()
        .join("_");

}


async function markChatAsRead(chatId, lastReadAt = serverTimestamp()) {
    const currentUser = auth.currentUser;

    if (!currentUser || !chatId) {
        return;
    }

    try {
        await setDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "chatReadState",
                chatId
            ),
            {
                lastReadAt: lastReadAt
            },
            { merge: true }
        );
    } catch (error) {
        console.error(
            "Errore aggiornamento lettura chat:",
            error
        );
    }
}


async function getUnreadTrackingStart(userUid) {
    if (unreadTrackingStartUid !== userUid) {
        unreadTrackingStartUid = userUid;
        unreadTrackingStartPromise = null;
    }

    if (!unreadTrackingStartPromise) {
        unreadTrackingStartPromise = (async () => {
            const userRef = doc(db, "users", userUid);

            let userSnapshot = await getDoc(userRef);
            let startAt =
                userSnapshot.exists()
                    ? userSnapshot.data().unreadTrackingStartedAt
                    : null;

            if (!startAt) {
                await setDoc(
                    userRef,
                    { unreadTrackingStartedAt: serverTimestamp() },
                    { merge: true }
                );

                userSnapshot = await getDoc(userRef);
                startAt = userSnapshot.data()?.unreadTrackingStartedAt;
            }

            return startAt;
        })();
    }

    return unreadTrackingStartPromise;
}


async function updateUnreadBadge(chatId, badge, userUid) {
    try {
        const readStateRef = doc(
            db,
            "users",
            userUid,
            "chatReadState",
            chatId
        );

        let readStateSnapshot = await getDoc(readStateRef);
        let lastReadAt = readStateSnapshot.exists()
            ? readStateSnapshot.data().lastReadAt
            : null;

        if (!lastReadAt) {
            lastReadAt = await getUnreadTrackingStart(userUid);

            if (!lastReadAt) {
                badge.classList.remove("visible");
                return;
            }

            await setDoc(
                readStateRef,
                { lastReadAt },
                { merge: true }
            );
        }

        // Se la conversazione è aperta, non mostrare messaggi non letti.
        if (currentChatId === chatId) {
                badge.classList.remove("visible");
            
                try {
                    await markChatAsRead(chatId);
                } catch (error) {
                    console.error("Errore azzeramento badge:", error);
                }
            
                return;
            }

        const unreadQuery = query(
            collection(db, "chats", chatId, "messages"),
            where("createdAt", ">", lastReadAt)
        );

        const unreadSnapshot = await getDocs(unreadQuery);

        const unreadCount = unreadSnapshot.docs.filter(
            messageDocument =>
                messageDocument.data().senderId !== userUid
        ).length;

        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
            badge.classList.add("visible");
        } else {
            badge.classList.remove("visible");
        }
    } catch (error) {
        console.error("Errore conteggio messaggi non letti:", error);
    }
}


function clearUnreadBadge(chatId) {
    const badges = document.querySelectorAll(".unread-badge");

    badges.forEach(badge => {
        if (badge.dataset.chatId === chatId) {
            badge.classList.remove("visible");
            badge.textContent = "";
        }
    });
}



// =========================
// CHIUDI MENU MESSAGGI
// =========================

function closeMessageMenus() {

    document
        .querySelectorAll(".message-menu")
        .forEach((menu) => {

            menu.remove();

        });

}


// =========================
// NUOVO GRUPPO
// =========================

let groupCreationOverlay = null;

let selectedGroupMembers = [];

function createGroupCreationPanel() {

    if (groupCreationOverlay) {
        return groupCreationOverlay;
    }

    groupCreationOverlay =
        document.createElement("div");

    groupCreationOverlay.className =
        "group-creation-overlay hidden";


    const panel =
        document.createElement("div");

    panel.className =
        "group-creation-panel";


    const title =
        document.createElement("h2");

    title.className =
        "group-creation-title";

    title.textContent =
        "Crea gruppo";


    const groupNameInput =
        document.createElement("input");

    groupNameInput.type =
        "text";

    groupNameInput.className =
        "group-name-input";

    groupNameInput.placeholder =
        "Nome del gruppo";

    groupNameInput.id =
        "groupNameInput";


    const memberSearch =
        document.createElement("input");

    memberSearch.type =
        "text";

    memberSearch.className =
        "group-member-search";

    memberSearch.placeholder =
        "Cerca Enclave ID";

    memberSearch.id =
        "groupMemberSearch";

    memberSearch.autocomplete =
        "off";


    const membersCount =
        document.createElement("div");

    membersCount.className =
        "group-members-count";

    membersCount.id =
        "groupMembersCount";


    const searchResults =
        document.createElement("div");

    searchResults.className =
        "group-search-results";

    searchResults.id =
        "groupSearchResults";


    const selectedMembers =
        document.createElement("div");

    selectedMembers.className =
        "group-selected-members";

    selectedMembers.id =
        "groupSelectedMembers";


    const actions =
        document.createElement("div");

    actions.className =
        "group-creation-actions";


    const cancelButton =
        document.createElement("button");

    cancelButton.type =
        "button";

    cancelButton.className =
        "group-cancel-button";

    cancelButton.textContent =
        "Annulla";


    const createButton =
        document.createElement("button");

    createButton.type =
        "button";

    createButton.className =
        "group-create-button";

    createButton.textContent =
        "Crea gruppo";

    createButton.disabled =
        true;


    actions.appendChild(
        cancelButton
    );

    actions.appendChild(
        createButton
    );


    panel.appendChild(title);
    panel.appendChild(groupNameInput);
    panel.appendChild(memberSearch);
    panel.appendChild(membersCount);
    panel.appendChild(searchResults);
    panel.appendChild(selectedMembers);
    panel.appendChild(actions);


    groupCreationOverlay.appendChild(
        panel
    );


    document.body.appendChild(
        groupCreationOverlay
    );


    // =========================
    // ANNULLA
    // =========================

    cancelButton.addEventListener(
        "click",
        () => {

            closeGroupCreation();

        }
    );


    // =========================
    // CLICK FUORI
    // =========================

    groupCreationOverlay.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                groupCreationOverlay
            ) {

                closeGroupCreation();

            }

        }
    );


    // =========================
    // NOME GRUPPO
    // =========================

    groupNameInput.addEventListener(
        "input",
        () => {

            updateGroupCreateButton();

        }
    );


    // =========================
    // RICERCA MEMBRI
    // =========================

    memberSearch.addEventListener(
        "input",
        async () => {

            const search =
                memberSearch.value
                    .trim()
                    .toUpperCase();


            searchResults.innerHTML =
                "";


            if (!search) {
                return;
            }


            if (
                selectedGroupMembers.length >=
                20
            ) {

                return;

            }


            try {

                const idDocument =
                    await getDoc(
                        doc(
                            db,
                            "enclaveIds",
                            search
                        )
                    );


                if (
                    !idDocument.exists()
                ) {

                    return;

                }


                const userUid =
                    idDocument.data().uid;


                if (
                    userUid ===
                    auth.currentUser.uid
                ) {

                    return;

                }


                const alreadySelected =
                    selectedGroupMembers.some(
                        (member) =>
                            member.uid ===
                            userUid
                    );


                if (alreadySelected) {
                    return;
                }


                const userDocument =
                    await getDoc(
                        doc(
                            db,
                            "publicUsers",
                            userUid
                        )
                    );


                if (
                    !userDocument.exists()
                ) {

                    return;

                }


                const userData =
                    userDocument.data();


                const result =
                    document.createElement(
                        "div"
                    );


                result.className =
                    "group-search-result";


                const avatar =
                    document.createElement(
                        "div"
                    );


                avatar.className =
                    "group-search-avatar";


                avatar.textContent =
                    userData.nickname
                        .charAt(0)
                        .toUpperCase();


                const info =
                    document.createElement(
                        "div"
                    );


                info.className =
                    "group-search-info";


                const nickname =
                    document.createElement(
                        "span"
                    );


                nickname.className =
                    "group-search-nickname";

                nickname.textContent =
                    userData.nickname;


                const enclaveId =
                    document.createElement(
                        "span"
                    );


                enclaveId.className =
                    "group-search-id";

                enclaveId.textContent =
                    userData.enclaveId;


                info.appendChild(
                    nickname
                );

                info.appendChild(
                    enclaveId
                );


                result.appendChild(
                    avatar
                );

                result.appendChild(
                    info
                );


                searchResults.appendChild(
                    result
                );


                result.addEventListener(
                    "click",
                    () => {

                        if (
                            selectedGroupMembers.length >=
                            19
                        ) {

                            return;

                        }


                        selectedGroupMembers.push({
                            uid:
                                userUid,

                            nickname:
                                userData.nickname,

                            enclaveId:
                                userData.enclaveId
                        });


                        memberSearch.value =
                            "";

                        searchResults.innerHTML =
                            "";


                        renderSelectedMembers();

                        updateGroupCreateButton();

                    }
                );


            } catch (error) {

                console.error(
                    "Errore ricerca membro gruppo:",
                    error
                );

            }

        }
    );


    // =========================
    // CREA GRUPPO
    // =========================

    createButton.addEventListener(
        "click",
        async () => {

            await createGroup();

        }
    );


    updateGroupMembersCount();


    return groupCreationOverlay;
}


// =========================
// CONTATORE MEMBRI
// =========================

function updateGroupMembersCount() {

    const counter =
        document.getElementById(
            "groupMembersCount"
        );


    if (!counter) {
        return;
    }


    counter.textContent =
        `${selectedGroupMembers.length + 1}/20 partecipanti`;
}


// =========================
// PULSANTE CREA
// =========================

function updateGroupCreateButton() {

    const button =
        document.querySelector(
            ".group-create-button"
        );

    const nameInput =
        document.getElementById(
            "groupNameInput"
        );


    if (!button || !nameInput) {
        return;
    }


    button.disabled =
        !nameInput.value.trim() ||
        selectedGroupMembers.length === 0;
}


// =========================
// MEMBRI SELEZIONATI
// =========================

function renderSelectedMembers() {

    const container =
        document.getElementById(
            "groupSelectedMembers"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    selectedGroupMembers.forEach(
        (member, index) => {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "group-selected-member";


            const text =
                document.createElement(
                    "span"
                );


            text.textContent =
                `${member.nickname} · ${member.enclaveId}`;


            const removeButton =
                document.createElement(
                    "button"
                );


            removeButton.type =
                "button";

            removeButton.className =
                "group-remove-member";

            removeButton.textContent =
                "×";


            removeButton.addEventListener(
                "click",
                () => {

                    selectedGroupMembers.splice(
                        index,
                        1
                    );


                    renderSelectedMembers();

                    updateGroupMembersCount();

                    updateGroupCreateButton();

                }
            );


            element.appendChild(
                text
            );

            element.appendChild(
                removeButton
            );


            container.appendChild(
                element
            );

        }
    );


    updateGroupMembersCount();
}


// =========================
// APRI CREAZIONE GRUPPO
// =========================

function openGroupCreation() {

    const overlay =
        createGroupCreationPanel();


    selectedGroupMembers =
        [];


    const nameInput =
        document.getElementById(
            "groupNameInput"
        );

    const memberSearch =
        document.getElementById(
            "groupMemberSearch"
        );

    const results =
        document.getElementById(
            "groupSearchResults"
        );


    if (nameInput) {
        nameInput.value = "";
    }


    if (memberSearch) {
        memberSearch.value = "";
    }


    if (results) {
        results.innerHTML = "";
    }


    renderSelectedMembers();

    updateGroupMembersCount();

    updateGroupCreateButton();


    overlay.classList.remove(
        "hidden"
    );


    nameInput?.focus();

}


// =========================
// CHIUDI CREAZIONE GRUPPO
// =========================

function closeGroupCreation() {

    if (!groupCreationOverlay) {
        return;
    }


    groupCreationOverlay.classList.add(
        "hidden"
    );


    selectedGroupMembers =
        [];

}


// =========================
// SCHEDA GRUPPO
// =========================

let groupInfoOverlay = null;

let currentGroupData = null;


// =========================
// CREA SCHEDA GRUPPO
// =========================

function createGroupInfoPanel() {

    if (groupInfoOverlay) {
        return groupInfoOverlay;
    }


    groupInfoOverlay =
        document.createElement("div");

    groupInfoOverlay.className =
        "group-info-overlay hidden";


    const panel =
        document.createElement("div");

    panel.className =
        "group-info-panel";


    // =========================
    // HEADER
    // =========================

    const header =
        document.createElement("div");

    header.className =
        "group-info-header";


    const title =
        document.createElement("h2");

    title.className =
        "group-info-title";


    const closeButton =
        document.createElement("button");

    closeButton.type =
        "button";

    closeButton.className =
        "group-info-close";

    closeButton.textContent =
        "×";


    header.appendChild(title);
    header.appendChild(closeButton);


    // =========================
    // CONTATORE
    // =========================

    const count =
        document.createElement("div");

    count.className =
        "group-info-count";


    // =========================
    // MEMBRI
    // =========================

    const membersList =
        document.createElement("div");

    membersList.className =
        "group-info-members";


    // =========================
    // AGGIUNGI MEMBRO
    // =========================

    const addSection =
        document.createElement("div");

    addSection.className =
        "group-add-section";


    const addButton =
        document.createElement("button");

    addButton.type =
        "button";

    addButton.className =
        "group-add-button";

    addButton.textContent =
        "+ Aggiungi membro";


    const addArea =
        document.createElement("div");

    addArea.className =
        "group-add-area hidden";


    const addInput =
        document.createElement("input");

    addInput.type =
        "text";

    addInput.className =
        "group-add-input";

    addInput.placeholder =
        "Cerca Enclave ID";

    addInput.autocomplete =
        "off";


    const addResults =
        document.createElement("div");

    addResults.className =
        "group-add-results";


    addArea.appendChild(addInput);
    addArea.appendChild(addResults);

    addSection.appendChild(addButton);
    addSection.appendChild(addArea);


    // =========================
    // ABBANDONA
    // =========================

    const leaveSection =
        document.createElement("div");

    leaveSection.className =
        "group-leave-section";


    const leaveButton =
        document.createElement("button");

    leaveButton.type =
        "button";

    leaveButton.className =
        "group-leave-button";

    leaveButton.textContent =
        "🚪 Abbandona gruppo";


    leaveSection.appendChild(
        leaveButton
    );


    // =========================
    // ASSEMBLA
    // =========================

    panel.appendChild(header);
    panel.appendChild(count);
    panel.appendChild(membersList);
    panel.appendChild(addSection);
    panel.appendChild(leaveSection);

    groupInfoOverlay.appendChild(panel);

    document.body.appendChild(
        groupInfoOverlay
    );


    // =========================
    // CHIUDI
    // =========================

    closeButton.addEventListener(
        "click",
        () => {

            closeGroupInfo();

        }
    );


    groupInfoOverlay.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                groupInfoOverlay
            ) {

                closeGroupInfo();

            }

        }
    );


    // =========================
    // APRI AGGIUNTA
    // =========================

    addButton.addEventListener(
        "click",
        () => {

            addArea.classList.toggle(
                "hidden"
            );

            if (
                !addArea.classList.contains(
                    "hidden"
                )
            ) {

                addInput.focus();

            }

        }
    );


    // =========================
    // RICERCA MEMBRO
    // =========================

    addInput.addEventListener(
        "input",
        async () => {

            const search =
                addInput.value
                    .trim()
                    .toUpperCase();


            addResults.innerHTML =
                "";


            if (!search) {
                return;
            }


            if (
                !currentGroupData ||
                currentGroupData.participants.length >= 20
            ) {

                return;

            }


            const currentUser =
                auth.currentUser;


            if (!currentUser) {
                return;
            }


            try {

                const idDocument =
                    await getDoc(
                        doc(
                            db,
                            "enclaveIds",
                            search
                        )
                    );


                if (
                    !idDocument.exists()
                ) {

                    return;

                }


                const userUid =
                    idDocument.data().uid;


                if (
                    currentGroupData.participants.includes(
                        userUid
                    )
                ) {

                    return;

                }


                const userDocument =
                    await getDoc(
                        doc(
                            db,
                            "publicUsers",
                            userUid
                        )
                    );


                if (
                    !userDocument.exists()
                ) {

                    return;

                }


                const userData =
                    userDocument.data();


                const result =
                    document.createElement(
                        "div"
                    );

                result.className =
                    "group-add-result";


                const avatar =
                    document.createElement(
                        "div"
                    );

                avatar.className =
                    "group-add-avatar";

                avatar.textContent =
                    userData.nickname
                        .charAt(0)
                        .toUpperCase();


                const info =
                    document.createElement(
                        "div"
                    );

                info.className =
                    "group-add-info";


                const nickname =
                    document.createElement(
                        "span"
                    );

                nickname.className =
                    "group-add-nickname";

                nickname.textContent =
                    userData.nickname;


                const enclaveId =
                    document.createElement(
                        "span"
                    );

                enclaveId.className =
                    "group-add-id";

                enclaveId.textContent =
                    userData.enclaveId;


                info.appendChild(
                    nickname
                );

                info.appendChild(
                    enclaveId
                );


                result.appendChild(
                    avatar
                );

                result.appendChild(
                    info
                );


                addResults.appendChild(
                    result
                );


                result.addEventListener(
                    "click",
                    async () => {

                        await addGroupMember(
                            userUid
                        );

                        addInput.value =
                            "";

                        addResults.innerHTML =
                            "";

                    }
                );


            } catch (error) {

                console.error(
                    "Errore ricerca membro:",
                    error
                );

            }

        }
    );


    // =========================
    // ABBANDONA
    // =========================

    leaveButton.addEventListener(
        "click",
        async () => {

            await leaveGroup();

        }
    );


    return groupInfoOverlay;
}


// =========================
// RIMUOVI MEMBRO
// =========================

async function removeGroupMember(
    userUid,
    userNickname
) {

    if (!currentGroupData) {
        return;
    }

    const currentUser =
        auth.currentUser;

    if (!currentUser) {
        return;
    }

    // Solo il proprietario può rimuovere membri
    if (
        currentGroupData.createdBy !==
        currentUser.uid
    ) {
        return;
    }

    // Il proprietario non può rimuovere sé stesso
    if (
        userUid ===
        currentGroupData.createdBy
    ) {
        return;
    }

    const confirmed =
        confirm(
            `Vuoi rimuovere ${userNickname} dal gruppo?`
        );

    if (!confirmed) {
        return;
    }

    try {

        const remainingParticipants =
            currentGroupData.participants.filter(
                uid =>
                    uid !== userUid
            );

        await updateDoc(
            doc(
                db,
                "chats",
                currentGroupData.chatId
            ),
            {
                participants:
                    remainingParticipants
            }
        );

        currentGroupData.participants =
            remainingParticipants;

        await renderGroupInfo();

        await loadConversations();

    } catch (error) {

        console.error(
            "Errore rimozione membro:",
            error
        );

        alert(
            "Impossibile rimuovere il membro."
        );
    }
}


// =========================
// APRI SCHEDA GRUPPO
// =========================

async function openGroupInfo(chatId) {

    try {

        const chatDocument =
            await getDoc(
                doc(
                    db,
                    "chats",
                    chatId
                )
            );


        if (
            !chatDocument.exists()
        ) {

            return;

        }


        const chatData =
            chatDocument.data();


        if (
            chatData.type !== "group"
        ) {

            return;

        }


        currentGroupData = {

            chatId:
                chatId,

            ...chatData

        };


        const overlay =
            createGroupInfoPanel();


        renderGroupInfo();


        overlay.classList.remove(
            "hidden"
        );


    } catch (error) {

        console.error(
            "Errore apertura gruppo:",
            error
        );

    }

}


let contactInfoOverlay = null;
let currentContactData = null;


function createContactInfoPanel() {
    if (contactInfoOverlay) {
        return contactInfoOverlay;
    }

    contactInfoOverlay = document.createElement("div");
    contactInfoOverlay.className = "group-info-overlay hidden";

    const panel = document.createElement("div");
    panel.className = "group-info-panel";

    const header = document.createElement("div");
    header.className = "group-info-header";

    const title = document.createElement("h2");
    title.className = "group-info-title";
    title.textContent = "Informazioni contatto";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "group-info-close";
    closeButton.textContent = "×";

    header.appendChild(title);
    header.appendChild(closeButton);

    const contactSection = document.createElement("div");
    contactSection.className = "group-info-members";

    const nicknameRow = document.createElement("div");
    nicknameRow.className = "contact-nickname-row";

    const nicknameLabel = document.createElement("span");
    nicknameLabel.textContent = "Soprannome";

    const nicknameValue = document.createElement("span");
    nicknameValue.className = "contact-nickname-value";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "contact-nickname-edit";
    editButton.textContent = "✎";
    editButton.title = "Modifica soprannome";
    editButton.setAttribute("aria-label", "Modifica soprannome");

    nicknameRow.appendChild(nicknameLabel);
    nicknameRow.appendChild(nicknameValue);
    nicknameRow.appendChild(editButton);

    const originalNickname = document.createElement("div");
    originalNickname.className = "contact-original-nickname";

    contactSection.appendChild(nicknameRow);
    contactSection.appendChild(originalNickname);

    panel.appendChild(header);
    panel.appendChild(contactSection);

    contactInfoOverlay.appendChild(panel);
    document.body.appendChild(contactInfoOverlay);

    closeButton.addEventListener("click", closeContactInfo);

    contactInfoOverlay.addEventListener("click", (event) => {
        if (event.target === contactInfoOverlay) {
            closeContactInfo();
        }
    });

    
editButton.addEventListener("click", async () => {
    if (!currentContactData) return;

    const currentNickname = nicknameValue.textContent;

    const newNickname = prompt(
        "Inserisci il soprannome personale (lascia vuoto per ripristinare quello originale):",
        currentNickname
    );

    if (newNickname === null) return;

    try {
        await saveContactNickname(
            currentContactData.uid,
            newNickname
        );

        const cleanNickname = newNickname.trim();
        const displayedNickname =
            cleanNickname || currentContactData.originalNickname;

        nicknameValue.textContent = displayedNickname;
        chatUserNickname.textContent = displayedNickname;
        chatUserAvatar.textContent =
            displayedNickname.charAt(0).toUpperCase();

        originalNickname.textContent =
            "Nickname originale: " +
            currentContactData.originalNickname;

        // Aggiorna il nome nella lista senza ricaricare tutte le chat.
        document.querySelectorAll(".conversation-item").forEach((item) => {
            const nameElement = item.querySelector(".conversation-nickname");

            if (
                nameElement &&
                item.dataset.contactUid === currentContactData.uid
            ) {
                nameElement.textContent = displayedNickname;

                const avatar = item.querySelector(".conversation-avatar");
                if (avatar) {
                    avatar.textContent = displayedNickname.charAt(0).toUpperCase();
                }
            }
        });

    } catch (error) {
        console.error("Errore modifica soprannome:", error);
        alert(error.message || "Impossibile salvare il soprannome.");
    }
});


    return contactInfoOverlay;
}

function closeContactInfo() {
    if (contactInfoOverlay) {
        contactInfoOverlay.classList.add("hidden");
    }
}


async function openContactInfo(contactUid, originalNickname) {
    try {
        const displayedNickname = await getContactNickname(
            contactUid,
            originalNickname
        );

        currentContactData = {
            uid: contactUid,
            originalNickname: originalNickname
        };

        const overlay = createContactInfoPanel();

        overlay.querySelector(".contact-nickname-value")
            .textContent = displayedNickname;

        overlay.querySelector(".contact-original-nickname")
            .textContent = "Nickname originale: " + originalNickname;

        overlay.classList.remove("hidden");
    } catch (error) {
        console.error("Errore apertura informazioni contatto:", error);
    }
}



// =========================
// RENDER SCHEDA GRUPPO
// =========================

async function renderGroupInfo() {

    if (!currentGroupData) {
        return;
    }


    const panel =
        groupInfoOverlay.querySelector(
            ".group-info-panel"
        );


    const title =
        panel.querySelector(
            ".group-info-title"
        );


    const count =
        panel.querySelector(
            ".group-info-count"
        );


    const membersList =
        panel.querySelector(
            ".group-info-members"
        );


    const addSection =
        panel.querySelector(
            ".group-add-section"
        );


    title.textContent =
        currentGroupData.name;


    // =========================================
    // PARTECIPANTI TOTALI
    // Il proprietario è incluso
    // =========================================

    const participants =
        currentGroupData.participants || [];


    count.textContent =
        `${participants.length} partecipanti`;


    membersList.innerHTML =
        "";


    const currentUser =
        auth.currentUser;


    const isOwner =
        currentUser &&
        currentGroupData.createdBy ===
            currentUser.uid;


    addSection.style.display =
        isOwner &&
        participants.length < 20
            ? "block"
            : "none";


    // =========================================
    // CARICA TUTTI I PARTECIPANTI
    // =========================================

    const memberResults =
        await Promise.all(

            participants.map(
                async (uid) => {

                    try {

                        const userDocument =
                            await getDoc(
                                doc(
                                    db,
                                    "publicUsers",
                                    uid
                                )
                            );


                        if (
                            userDocument.exists()
                        ) {

                            return {
                                uid:
                                    uid,

                                ...userDocument.data()
                            };

                        }


                        // Fallback nel caso in cui
                        // il profilo pubblico non esista

                        return {
                            uid:
                                uid,

                            nickname:
                                uid ===
                                currentGroupData.createdBy
                                    ? "Proprietario"
                                    : "Utente",

                            enclaveId:
                                ""
                        };


                    } catch (error) {

                        console.error(
                            "Errore caricamento partecipante:",
                            uid,
                            error
                        );


                        return {
                            uid:
                                uid,

                            nickname:
                                "Utente",

                            enclaveId:
                                ""
                        };

                    }

                }
            )

        );


    // =========================================
    // CREA ELEMENTI PARTECIPANTI
    // =========================================

    memberResults.forEach(
        (userData) => {

            const member =
                document.createElement(
                    "div"
                );


            member.className =
                "group-info-member";


            const avatar =
                document.createElement(
                    "div"
                );


            avatar.className =
                "group-info-avatar";


            avatar.textContent =
                (
                    userData.nickname ||
                    "?"
                )
                    .charAt(0)
                    .toUpperCase();


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "group-info-member-data";


            const nickname =
                document.createElement(
                    "div"
                );


            nickname.className =
                "group-info-member-name";


            nickname.textContent =
                userData.nickname ||
                "Utente";


            const enclaveId =
                document.createElement(
                    "div"
                );


            enclaveId.className =
                "group-info-member-id";


            enclaveId.textContent =
                userData.enclaveId ||
                "";


            info.appendChild(
                nickname
            );


            info.appendChild(
                enclaveId
            );


            // =================================
            // PROPRIETARIO
            // =================================

            if (
                userData.uid ===
                currentGroupData.createdBy
            ) {

                const owner =
                    document.createElement(
                        "span"
                    );


                owner.className =
                    "group-owner-label";


                owner.textContent =
                    "Proprietario";


                nickname.appendChild(
                    owner
                );

            }


            if (
                isOwner &&
                userData.uid !== currentGroupData.createdBy
            ) {

                const removeButton =
                    document.createElement(
                        "button"
                    );

                removeButton.className =
                    "group-remove-member-button";

                removeButton.type =
                    "button";

                removeButton.textContent =
                    "Rimuovi";

                removeButton.addEventListener(
                    "click",
                    async (event) => {

                        event.preventDefault();
                        event.stopPropagation();

                        await removeGroupMember(
                            userData.uid,
                            userData.nickname
                        );

                    }
                );

                member.appendChild(
                    avatar
                );

                member.appendChild(
                    info
                );

                member.appendChild(
                    removeButton
                );

            } else {

                member.appendChild(
                    avatar
                );

                member.appendChild(
                    info
                );

            }


            membersList.appendChild(
                member
            );

        }
    );

}


// =========================
// CHIUDI SCHEDA GRUPPO
// =========================

function closeGroupInfo() {

    if (!groupInfoOverlay) {
        return;
    }


    groupInfoOverlay.classList.add(
        "hidden"
    );


    currentGroupData =
        null;

}


// =========================
// AGGIUNGI MEMBRO
// =========================

async function addGroupMember(userUid) {

    const currentUser =
        auth.currentUser;


    if (
        !currentUser ||
        !currentGroupData
    ) {

        return;

    }


    if (
        currentGroupData.createdBy !==
        currentUser.uid
    ) {

        return;

    }


    if (
        currentGroupData.participants.length >=
        20
    ) {

        return;

    }


    if (
        currentGroupData.participants.includes(
            userUid
        )
    ) {

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                "chats",
                currentGroupData.chatId
            ),
            {

                participants: [
                    ...currentGroupData.participants,
                    userUid
                ]

            }
        );


        currentGroupData.participants.push(
            userUid
        );


        await renderGroupInfo();


    } catch (error) {

        console.error(
            "Errore aggiunta membro:",
            error
        );

    }

}


// =========================
// ABBANDONA GRUPPO
// =========================

async function leaveGroup() {

    const currentUser =
        auth.currentUser;


    if (
        !currentUser ||
        !currentGroupData
    ) {

        return;

    }


    const confirmed =
        confirm(
            "Sei sicuro di voler abbandonare questo gruppo?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const remainingParticipants =
            currentGroupData.participants.filter(
                (uid) =>
                    uid !==
                    currentUser.uid
            );


        if (
            remainingParticipants.length ===
            0
        ) {

            await deleteDoc(
                doc(
                    db,
                    "chats",
                    currentGroupData.chatId
                )
            );


        } else {

            let newOwner =
                currentGroupData.createdBy;


            if (
                currentGroupData.createdBy ===
                currentUser.uid
            ) {

                newOwner =
                    remainingParticipants[0];

            }


            await updateDoc(
                doc(
                    db,
                    "chats",
                    currentGroupData.chatId
                ),
                {

                    participants:
                        remainingParticipants,

                    createdBy:
                        newOwner

                }
            );

        }


        closeGroupInfo();


        if (
            currentChatId ===
            currentGroupData?.chatId
        ) {

            chatBackButton.click();

        }


        loadConversations();


    } catch (error) {

        console.error(
            "Errore abbandono gruppo:",
            error
        );

    }

}


// =========================
// CLICK SUL +
// =========================

newGroupButton.addEventListener(
    "click",
    () => {

        let menu =
            document.getElementById(
                "newGroupMenu"
            );


        if (!menu) {

            menu =
                document.createElement(
                    "div"
                );

            menu.id =
                "newGroupMenu";

            menu.className =
                "new-group-menu hidden";


            const groupButton =
                document.createElement(
                    "button"
                );


            groupButton.type =
                "button";

            groupButton.textContent =
                "👥  Nuovo gruppo";


            groupButton.addEventListener(
                "click",
                () => {

                    menu.classList.add(
                        "hidden"
                    );

                    openGroupCreation();

                }
            );


            menu.appendChild(
                groupButton
            );


            chatSidebar.appendChild(
                menu
            );

        }


        menu.classList.toggle(
            "hidden"
        );

    }
);


// =========================
// CREA GRUPPO FIRESTORE
// =========================

async function createGroup() {

    const currentUser =
        auth.currentUser;


    if (!currentUser) {
        return;
    }


    const nameInput =
        document.getElementById(
            "groupNameInput"
        );


    if (!nameInput) {
        return;
    }


    const groupName =
        nameInput.value.trim();


    if (!groupName) {
        return;
    }


    if (
        selectedGroupMembers.length >
        19
    ) {

        return;

    }


    const participants = [
        currentUser.uid,
        ...selectedGroupMembers.map(
            (member) =>
                member.uid
        )
    ];


    try {

        const chatReference =
            await addDoc(
                collection(
                    db,
                    "chats"
                ),
                {

                    type:
                        "group",

                    name:
                        groupName,

                    participants:
                        participants,

                    createdBy:
                        currentUser.uid,

                    lastMessage:
                        "",

                    lastMessageAt:
                        null,

                    lastSenderId:
                        null,

                    createdAt:
                        serverTimestamp()

                }
            );


        closeGroupCreation();


        console.log(
            "GRUPPO CREATO:",
            chatReference.id
        );


    } catch (error) {

        console.error(
            "Errore creazione gruppo:",
            error
        );

    }

}


// =========================
// BARRA RISPOSTA
// =========================

function createReplyBar() {

    let replyBar =
        document.getElementById(
            "messageReplyBar"
        );


    if (replyBar) {
        return replyBar;
    }


    const chatInputArea =
        document.querySelector(
            ".chat-input-area"
        );


    if (!chatInputArea) {
        return null;
    }


    replyBar =
        document.createElement(
            "div"
        );


    replyBar.id =
        "messageReplyBar";


    replyBar.className =
        "message-reply-bar";


    const replyInfo =
        document.createElement(
            "div"
        );


    replyInfo.className =
        "message-reply-info";


    const replyTitle =
        document.createElement(
            "div"
        );


    replyTitle.className =
        "message-reply-title";


    replyTitle.textContent =
        "Rispondi a";


    const replyText =
        document.createElement(
            "div"
        );


    replyText.className =
        "message-reply-text";


    replyInfo.appendChild(
        replyTitle
    );


    replyInfo.appendChild(
        replyText
    );


    const cancelButton =
        document.createElement(
            "button"
        );


    cancelButton.type =
        "button";


    cancelButton.className =
        "message-reply-cancel";


    cancelButton.textContent =
        "×";


    cancelButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            event.stopPropagation();

            clearReply();

        }
    );


    replyBar.appendChild(
        replyInfo
    );


    replyBar.appendChild(
        cancelButton
    );


    chatInputArea.insertBefore(
        replyBar,
        chatInputArea.firstChild
    );


    return replyBar;

}


// =========================
// INIZIA RISPOSTA
// =========================

function startReply(message) {

    if (!message) {
        return;
    }


    replyTarget = {

        messageId:
            message.id,

        text:
            message.text || "",

        senderId:
            message.senderId || ""

    };


    const replyBar =
        createReplyBar();


    if (!replyBar) {
        return;
    }


    const replyText =
        replyBar.querySelector(
            ".message-reply-text"
        );


    if (replyText) {

        replyText.textContent =
            message.text || "";

    }


    replyBar.style.display =
        "flex";


    messageInput.focus();


    closeMessageMenus();

}


// =========================
// CANCELLA RISPOSTA
// =========================

function clearReply() {

    replyTarget = null;


    const replyBar =
        document.getElementById(
            "messageReplyBar"
        );


    if (replyBar) {

        replyBar.style.display =
            "none";

    }

}


// =========================
// AGGIORNA ULTIMO MESSAGGIO
// =========================

async function updateChatLastMessage(chatId) {

    if (!chatId) {
        return;
    }


    try {

        const messagesReference =
            collection(
                db,
                "chats",
                chatId,
                "messages"
            );


        const snapshot =
            await getDocs(
                messagesReference
            );


        const messages = [];


        snapshot.forEach(
            (messageDocument) => {

                messages.push({
                    id:
                        messageDocument.id,

                    ...messageDocument.data()
                });

            }
        );


        messages.sort(
            (a, b) => {

                const timeA =
                    a.createdAt
                        ?.toMillis?.() || 0;

                const timeB =
                    b.createdAt
                        ?.toMillis?.() || 0;

                return timeB - timeA;

            }
        );


        const chatReference =
            doc(
                db,
                "chats",
                chatId
            );


        if (messages.length === 0) {

            await updateDoc(
                chatReference,
                {
                    lastMessage: "",
                    lastMessageAt: null,
                    lastSenderId: null
                }
            );

            return;
        }


        const latestMessage =
            messages[0];


        await updateDoc(
            chatReference,
            {
                lastMessage:
                    latestMessage.text,

                lastMessageAt:
                    latestMessage.createdAt,

                lastSenderId:
                    latestMessage.senderId
            }
        );


    } catch (error) {

        console.error(
            "Errore aggiornamento ultimo messaggio:",
            error
        );

    }

}


// =========================
// ELIMINA MESSAGGIO
// =========================

async function deleteMessage(
    messageId,
    chatId
) {

    if (!messageId || !chatId) {
        return;
    }


    try {

        const messageReference =
            doc(
                db,
                "chats",
                chatId,
                "messages",
                messageId
            );


        await deleteDoc(
            messageReference
        );


        await updateChatLastMessage(
            chatId
        );


    } catch (error) {

        console.error(
            "Errore eliminazione messaggio:",
            error
        );

    }

}


// =========================
// MODIFICA MESSAGGIO
// =========================

async function editMessage(
    messageId,
    chatId,
    oldText
) {

    const newText =
        prompt(
            "Modifica messaggio:",
            oldText
        );


    if (newText === null) {
        return;
    }


    const trimmedText =
        newText.trim();


    if (!trimmedText) {
        return;
    }


    try {

        const messageReference =
            doc(
                db,
                "chats",
                chatId,
                "messages",
                messageId
            );


        await updateDoc(
            messageReference,
            {
                text:
                    trimmedText,

                edited:
                    true
            }
        );


        await updateChatLastMessage(
            chatId
        );


    } catch (error) {

        console.error(
            "Errore modifica messaggio:",
            error
        );

    }

}


// =========================
// MENU MESSAGGIO
// =========================

function openMessageMenu(
    messageElement,
    message
) {

    closeMessageMenus();


    const menu =
        document.createElement(
            "div"
        );


    menu.className =
        "message-menu";


    const isOwnMessage =
        auth.currentUser &&
        message.senderId ===
            auth.currentUser.uid;


    // =========================
    // RISPONDI
    // =========================

    const replyButton =
        document.createElement(
            "button"
        );


    replyButton.className =
        "message-menu-button";


    replyButton.type =
        "button";


    replyButton.textContent =
        "↩ Rispondi";


    replyButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            event.stopPropagation();

            startReply(
                message
            );

        }
    );


    menu.appendChild(
        replyButton
    );


    // =========================
    // COPIA — DISPONIBILE PER TUTTI I MESSAGGI
    // =========================

    const copyButton = document.createElement("button");
    copyButton.className = "message-menu-button";
    copyButton.type = "button";
    copyButton.textContent = "Copia";

    copyButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const textToCopy = String(message.text ?? "");

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                throw new Error("Clipboard API non disponibile");
            }
        } catch (error) {
            // Fallback per browser/dispositivi che non espongono Clipboard API.
            const temporaryTextarea = document.createElement("textarea");
            temporaryTextarea.value = textToCopy;
            temporaryTextarea.setAttribute("readonly", "");
            temporaryTextarea.style.position = "fixed";
            temporaryTextarea.style.opacity = "0";
            temporaryTextarea.style.pointerEvents = "none";
            document.body.appendChild(temporaryTextarea);
            temporaryTextarea.select();
            temporaryTextarea.setSelectionRange(0, temporaryTextarea.value.length);

            let copied = false;
            try {
                copied = document.execCommand("copy");
            } finally {
                temporaryTextarea.remove();
            }

            if (!copied) {
                console.error("Copia del messaggio non riuscita:", error);
                copyButton.textContent = "Copia non riuscita";
                return;
            }
        }

        copyButton.textContent = "Copiato!";
        closeMessageMenus();
    });

    menu.appendChild(copyButton);


    // =========================
    // MODIFICA + ELIMINA
    // SOLO PER I TUOI MESSAGGI
    // =========================

    if (isOwnMessage) {

        const editButton =
            document.createElement(
                "button"
            );


        editButton.className =
            "message-menu-button";


        editButton.type =
            "button";


        editButton.textContent =
            "Modifica";


        editButton.addEventListener(
            "click",
            async (event) => {

                event.preventDefault();

                event.stopPropagation();

                closeMessageMenus();

                await editMessage(
                    message.id,
                    currentChatId,
                    message.text
                );

            }
        );


        const deleteButton =
            document.createElement(
                "button"
            );


        deleteButton.className =
            "message-menu-button";


        deleteButton.type =
            "button";


        deleteButton.textContent =
            "Elimina";


        deleteButton.addEventListener(
            "click",
            async (event) => {

                event.preventDefault();

                event.stopPropagation();

                closeMessageMenus();

                await deleteMessage(
                    message.id,
                    currentChatId
                );

            }
        );


        menu.appendChild(
            editButton
        );


        menu.appendChild(
            deleteButton
        );

    }


    // =========================
    // POSIZIONAMENTO
    // =========================

    const actionButton =
        messageElement.querySelector(
            ".message-actions"
        );


    if (!actionButton) {
        return;
    }


    document.body.appendChild(
        menu
    );


    menu.style.position =
        "fixed";

    menu.style.right =
        "auto";

    menu.style.bottom =
        "auto";


    const arrowRect =
        actionButton.getBoundingClientRect();


    const menuRect =
        menu.getBoundingClientRect();


    const gap =
        8;


    let top =
        arrowRect.top +
        (
            arrowRect.height -
            menuRect.height
        ) / 2;


    let left;


    if (isOwnMessage) {

        left =
            arrowRect.left -
            menuRect.width -
            gap;

    } else {

        left =
            arrowRect.right +
            gap;

    }


    const margin =
        8;


    if (
        left +
        menuRect.width >
        window.innerWidth -
        margin
    ) {

        left =
            window.innerWidth -
            menuRect.width -
            margin;

    }


    if (left < margin) {

        left =
            margin;

    }


    if (
        top +
        menuRect.height >
        window.innerHeight -
        margin
    ) {

        top =
            window.innerHeight -
            menuRect.height -
            margin;

    }


    if (top < margin) {

        top =
            margin;

    }


    menu.style.left =
        `${left}px`;


    menu.style.top =
        `${top}px`;

}


// =========================
// CARICAMENTO MESSAGGI
// =========================

async function loadMessages(chatId) {

    const loadVersion = ++messagesLoadVersion;

    // Interrompe subito il listener precedente, senza aspettare Firestore.
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }

    clearReply();

    // Non lasciare visibile lo storico della conversazione precedente.
    chatMessages.replaceChildren();

    const loadingMessage = document.createElement("div");
    loadingMessage.className = "chat-empty-messages";
    loadingMessage.textContent = "Caricamento messaggi…";
    chatMessages.appendChild(loadingMessage);

    const chatDocument = await getDoc(
        doc(db, "chats", chatId)
    );

    // Se nel frattempo è stata aperta un'altra chat, ignora questo risultato.
    if (
        loadVersion !== messagesLoadVersion ||
        currentChatId !== chatId
    ) {
        return;
    }

    const isGroupChat =
        chatDocument.exists() &&
        chatDocument.data().type === "group";

    const messagesReference =
        collection(
            db,
            "chats",
            chatId,
            "messages"
        );


    const messagesQuery =
        query(
            messagesReference
        );


    unsubscribeMessages =
        onSnapshot(
            messagesQuery,
            async (snapshot) => {

                if (
                    loadVersion !== messagesLoadVersion ||
                    currentChatId !== chatId
                ) {
                    return;
                }

                closeMessageMenus();

                chatMessages.innerHTML =
                    "";


                if (snapshot.empty) {

                    await markChatAsRead(chatId);

                    if (
                        loadVersion !== messagesLoadVersion ||
                        currentChatId !== chatId
                    ) {
                        return;
                    }

                    const emptyMessage =
                        document.createElement(
                            "div"
                        );


                    emptyMessage.className =
                        "chat-empty-messages";


                    emptyMessage.textContent =
                        "Nessun messaggio";


                    chatMessages.appendChild(
                        emptyMessage
                    );


                    return;

                }


                const messages = [];


                snapshot.forEach(
                    (messageDocument) => {

                        messages.push({
                            id:
                                messageDocument.id,

                            ...messageDocument.data()
                        });

                    }
                );


                messages.sort(
                    (a, b) => {

                        const timeA =
                            a.createdAt
                                ?.toMillis?.() || 0;

                        const timeB =
                            b.createdAt
                                ?.toMillis?.() || 0;

                        return timeA - timeB;

                    }
                );

                const latestMessage =
                        messages[messages.length - 1];
                    
                    if (latestMessage?.createdAt) {
                        await markChatAsRead(
                            chatId,
                            latestMessage.createdAt
                        );
                    }

                const senderNicknames = {};

                    if (isGroupChat) {
                        const senderIds = [
                            ...new Set(
                                messages
                                    .map(message => message.senderId)
                                    .filter(Boolean)
                            )
                        ];
    
                        await Promise.all(
                            senderIds.map(async (senderId) => {
                                try {
                                    const userDocument = await getDoc(
                                        doc(db, "publicUsers", senderId)
                                    );
    
                                    senderNicknames[senderId] =
                                        userDocument.exists()
                                            ? userDocument.data().nickname || "Utente"
                                            : "Utente";
                                } catch (error) {
                                    console.error(
                                        "Errore recupero nickname:",
                                        error
                                    );
    
                                    senderNicknames[senderId] = "Utente";
                                }
                            })
                        );
                    }

                if (
                    loadVersion !== messagesLoadVersion ||
                    currentChatId !== chatId
                ) {
                    return;
                }

                const currentUser =
                    auth.currentUser;


                messages.forEach(
                    (message) => {

                        const messageElement =
                            document.createElement(
                                "div"
                            );


                        const isOwnMessage =
                            currentUser &&
                            message.senderId ===
                                currentUser.uid;


                        if (isOwnMessage) {

                            messageElement.className =
                                "message message-own";

                        } else {

                            messageElement.className =
                                "message message-other";

                        }


                        // =========================
                        // DATI DEL MESSAGGIO
                        // =========================

                        messageElement._enclaveMessage =
                            message;


                        messageElement.dataset.messageId =
                            message.id;

                        if (isGroupChat) {
                            
                            const senderName =
                                document.createElement("div");

                            senderName.className =
                                "message-sender-name";

                            senderName.textContent =
                                message.senderId === currentUser?.uid
                                    ? senderNicknames[message.senderId] || "Tu"
                                    : senderNicknames[message.senderId] || "Utente";

                            senderName.style.fontSize = "12px";
                            senderName.style.fontWeight = "600";
                            senderName.style.marginBottom = "4px";
                            senderName.style.opacity = "0.8";

                            messageElement.appendChild(senderName);
                        }


                        // =========================
                        // BUBBLE
                        // =========================

                        const bubble =
                            document.createElement(
                                "div"
                            );


                        bubble.className =
                            "message-bubble";


                        // =========================
                        // RISPOSTA QUOTATA
                        // =========================

                        if (message.replyTo) {

                            const replyQuote =
                                document.createElement(
                                    "div"
                                );


                            replyQuote.className =
                                "message-reply-quote";


                            const replyQuoteTitle =
                                document.createElement(
                                    "div"
                                );


                            replyQuoteTitle.className =
                                "message-reply-quote-title";


                            if (
                                message.replyTo.senderId ===
                                currentUser?.uid
                            ) {

                                replyQuoteTitle.textContent =
                                    "Tu";

                            } else {

                                replyQuoteTitle.textContent =
                                    chatUserNickname.textContent;

                            }


                            const replyQuoteText =
                                document.createElement(
                                    "div"
                                );


                            replyQuoteText.className =
                                "message-reply-quote-text";


                            replyQuoteText.textContent =
                                message.replyTo.text || "";


                            replyQuote.appendChild(
                                replyQuoteTitle
                            );


                            replyQuote.appendChild(
                                replyQuoteText
                            );


                            // =========================
                            // CLICK SULLA RISPOSTA
                            // =========================

                            replyQuote.addEventListener(
                                "click",
                                (event) => {

                                    event.preventDefault();

                                    event.stopPropagation();


                                    const targetMessage =
                                        Array.from(
                                            chatMessages.querySelectorAll(
                                                ".message"
                                            )
                                        ).find(
                                            (element) =>
                                                element.dataset.messageId ===
                                                message.replyTo.messageId
                                        );


                                    if (!targetMessage) {
                                        return;
                                    }


                                    targetMessage.scrollIntoView({
                                        behavior:
                                            "smooth",

                                        block:
                                            "center"
                                    });


                                    targetMessage.classList.add(
                                        "reply-highlight"
                                    );


                                    setTimeout(
                                        () => {

                                            targetMessage.classList.remove(
                                                "reply-highlight"
                                            );

                                        },
                                        1200
                                    );

                                }
                            );


                            // La citazione viene
                            // messa SOPRA alla bolla.

                            messageElement.appendChild(
                                replyQuote
                            );

                        }


                        // =========================
                        // TESTO
                        // =========================

                        const textElement =
                            document.createElement(
                                "span"
                            );


                        textElement.className =
                            "message-text";


                        textElement.textContent =
                            message.text;


                        // =========================
                        // ORARIO
                        // =========================

                        const timeElement =
                            document.createElement(
                                "span"
                            );


                        timeElement.className =
                            "message-time";


                        if (message.createdAt) {

                            timeElement.textContent =
                                message.createdAt
                                    .toDate()
                                    .toLocaleTimeString(
                                        "it-IT",
                                        {
                                            hour:
                                                "2-digit",

                                            minute:
                                                "2-digit"
                                        }
                                    );

                        } else {

                            timeElement.textContent =
                                "";

                        }


                        bubble.appendChild(
                            textElement
                        );


                        // =========================
                        // MODIFICATO
                        // =========================

                        if (message.edited) {

                            const editedElement =
                                document.createElement(
                                    "span"
                                );


                            editedElement.className =
                                "message-edited";


                            editedElement.textContent =
                                "modificato";


                            bubble.appendChild(
                                editedElement
                            );

                        }


                        bubble.appendChild(
                            timeElement
                        );


                        // =========================
                        // BOLLA
                        // =========================

                        messageElement.appendChild(
                            bubble
                        );


                        // =========================
                        // AZIONI
                        // TUTTI I MESSAGGI
                        // =========================

                        const actionButton =
                            document.createElement(
                                "button"
                            );


                        actionButton.className =
                            "message-actions";


                        actionButton.type =
                            "button";


                        actionButton.textContent =
                            "⌄";


                        // =========================
                        // APERTURA MENU
                        // TOUCH + CLICK
                        // =========================

                        let lastTouchTime =
                            0;


                        const openActions =
                            (event) => {

                                event.preventDefault();

                                event.stopPropagation();


                                openMessageMenu(
                                    messageElement,
                                    message
                                );

                            };


                        actionButton.addEventListener(
                            "touchend",
                            (event) => {

                                lastTouchTime =
                                    Date.now();

                                openActions(
                                    event
                                );

                            },
                            {
                                passive:
                                    false
                            }
                        );


                        actionButton.addEventListener(
                            "click",
                            (event) => {

                                if (
                                    Date.now() -
                                    lastTouchTime <
                                    600
                                ) {

                                    return;

                                }


                                openActions(
                                    event
                                );

                            }
                        );


                        messageElement.appendChild(
                            actionButton
                        );


                        // =========================
                        // TAP SU MOBILE
                        // MOSTRA FRECCETTA
                        // =========================

                        messageElement.addEventListener(
                            "click",
                            (event) => {

                                if (
                                    window.innerWidth >
                                    700
                                ) {

                                    return;

                                }


                                if (
                                    event.target.closest(
                                        ".message-actions"
                                    )
                                ) {

                                    return;

                                }


                                if (
                                    event.target.closest(
                                        ".message-menu"
                                    )
                                ) {

                                    return;

                                }


                                document
                                    .querySelectorAll(
                                        ".message-actions-visible"
                                    )
                                    .forEach(
                                        (element) => {

                                            if (
                                                element !==
                                                messageElement
                                            ) {

                                                element.classList.remove(
                                                    "message-actions-visible"
                                                );

                                            }

                                        }
                                    );


                                messageElement.classList.toggle(
                                    "message-actions-visible"
                                );

                            }
                        );


                        // =========================
                        // EVITA SELEZIONE TESTO
                        // =========================

                        messageElement.addEventListener(
                            "selectstart",
                            (event) => {

                                if (
                                    window.innerWidth <=
                                    700
                                ) {

                                    event.preventDefault();

                                }

                            }
                        );


                        // =========================
                        // EVITA MENU BROWSER
                        // =========================

                        messageElement.addEventListener(
                            "contextmenu",
                            (event) => {

                                if (
                                    window.innerWidth <=
                                    700
                                ) {

                                    event.preventDefault();

                                }

                            }
                        );


                        chatMessages.appendChild(
                            messageElement
                        );

                    }
                );


                chatMessages.scrollTop =
                    chatMessages.scrollHeight;

            },
            (error) => {

                console.error(
                    "Errore caricamento messaggi:",
                    error
                );

            }
        );
    }


// =========================
// CHIUDI MENU CLICCANDO FUORI
// =========================

document.addEventListener(
    "click",
    (event) => {

        if (
            !event.target.closest(
                ".message-menu"
            ) &&
            !event.target.closest(
                ".message-actions"
            )
        ) {

            closeMessageMenus();

        }

    }
);


// =========================
// RICERCA UTENTI
// =========================

chatSearch.addEventListener(
    "input",
    async () => {

        console.log(
            "RICERCA ATTIVATA"
        );


        const search =
            chatSearch.value
                .trim()
                .toUpperCase();


        searchResults.innerHTML =
            "";


        if (!search) {
            return;
        }


        try {

            console.log(
                "RICERCA ID:",
                search
            );


            const idDocument =
                await getDoc(
                    doc(
                        db,
                        "enclaveIds",
                        search
                    )
                );


            console.log(
                "DOCUMENTO ID ESISTE:",
                idDocument.exists()
            );


            if (!idDocument.exists()) {

                const noResult =
                    document.createElement(
                        "div"
                    );


                noResult.className =
                    "search-no-result";


                noResult.textContent =
                    "Nessun utente trovato.";


                searchResults.appendChild(
                    noResult
                );


                return;

            }


            const userUid =
                idDocument.data().uid;


            const userDocument =
                await getDoc(
                    doc(
                        db,
                        "publicUsers",
                        userUid
                    )
                );


            if (!userDocument.exists()) {
                return;
            }


            const userData =
                userDocument.data();


            const nickname =
                userData.nickname;


            const enclaveId =
                userData.enclaveId;


            const result =
                document.createElement(
                    "div"
                );


            result.className =
                "search-result";


            const avatar =
                document.createElement(
                    "div"
                );


            avatar.className =
                "search-result-avatar";


            avatar.textContent =
                nickname
                    .charAt(0)
                    .toUpperCase();


            const resultInfo =
                document.createElement(
                    "div"
                );


            resultInfo.className =
                "search-result-info";


            const resultNickname =
                document.createElement(
                    "span"
                );


            resultNickname.className =
                "search-result-nickname";


            resultNickname.textContent =
                nickname;


            const resultId =
                document.createElement(
                    "span"
                );


            resultId.className =
                "search-result-id";


            resultId.textContent =
                enclaveId;


            resultInfo.appendChild(
                resultNickname
            );


            resultInfo.appendChild(
                resultId
            );


            result.appendChild(
                avatar
            );


            result.appendChild(
                resultInfo
            );


            searchResults.appendChild(
                result
            );


            result.addEventListener(
                "click",
                () => {

                    chatEmptyState.classList.add(
                        "hidden"
                    );


                    activeChat.classList.remove(
                        "hidden"
                    );


                    chatUserNickname.textContent =
                        nickname;


                    chatUserId.textContent =
                        enclaveId;


                    chatUserAvatar.textContent =
                        nickname
                            .charAt(0)
                            .toUpperCase();


                    currentChatUserUid =
                        userUid;


                    currentChatId =
                        createChatId(
                            auth.currentUser.uid,
                            userUid
                        );


                    loadMessages(
                        currentChatId
                    );


                    homeMain.classList.add(
                        "chat-open"
                    );


                    if (
                        window.innerWidth <= 700
                    ) {

                        chatSidebar.style.display =
                            "none";


                        chatArea.style.display =
                            "flex";


                        chatArea.style.width =
                            "100%";

                    }

                }
            );


        } catch (error) {

            console.error(
                "Errore ricerca utente:",
                error
            );

        }

    }
);


// =========================
// TORNA ALLA LISTA CHAT
// =========================

chatBackButton.addEventListener(
    "click",
    () => {

        closeMessageMenus();

        clearReply();


        chatEmptyState.classList.remove(
            "hidden"
        );


        activeChat.classList.add(
            "hidden"
        );


        homeMain.classList.remove(
            "chat-open"
        );


        // Invalida anche eventuali getDoc ancora in corso.
        messagesLoadVersion++;

        if (unsubscribeMessages) {

            unsubscribeMessages();

            unsubscribeMessages = null;

        }

        chatMessages.replaceChildren();

        currentChatUserUid = null;

        currentChatId = null;


        if (window.innerWidth <= 700) {

            chatSidebar.style.display =
                "flex";


            chatArea.style.display =
                "none";

        }

    }
);



 // =========================
// INVIO MESSAGGI
// =========================


async function sendMessage() {

    const message = messageInput.value.trim();

    if (!message) return;

    const currentUser = auth.currentUser;

    if (!currentUser) return;

    if (!currentChatUserUid && !currentChatId) return;

    if (
        currentChatUserUid &&
        currentUser.uid === currentChatUserUid
    ) {
        return;
    }

    try {

        let chatId;

        if (currentChatUserUid) {
            chatId = createChatId(
                currentUser.uid,
                currentChatUserUid
            );
        } else {
            chatId = currentChatId;
        }

        const chatReference = doc(db, "chats", chatId);
        console.log("DEBUG 1 - Chat ID:", chatId);

        if (currentChatUserUid) {

            const existingChat = await getDoc(chatReference);
            console.log("DEBUG 2 - Chat esistente:", existingChat.exists());

            if (existingChat.exists()) {

                const chatData = existingChat.data();

                if (
                    "type" in chatData ||
                    !Array.isArray(chatData.participants) ||
                    !chatData.participants.includes(currentUser.uid) ||
                    !chatData.participants.includes(currentChatUserUid)
                ) {
                    throw new Error(
                        "La chat privata non ha una struttura valida."
                    );
                }

                await updateDoc(chatReference, {
                    lastMessage: message,
                    lastMessageAt: serverTimestamp(),
                    lastSenderId: currentUser.uid
                });

            } else {

                await setDoc(chatReference, {
                    participants: [
                        currentUser.uid,
                        currentChatUserUid
                    ],
                    lastMessage: message,
                    lastMessageAt: serverTimestamp(),
                    lastSenderId: currentUser.uid
                });

            }

        } else {

            await updateDoc(chatReference, {
                lastMessage: message,
                lastMessageAt: serverTimestamp(),
                lastSenderId: currentUser.uid
            });

        }
        console.log("DEBUG 3 - Chat creata/aggiornata correttamente");

        const messageData = {
            text: message,
            senderId: currentUser.uid,
            createdAt: serverTimestamp(),
            edited: false
        };

        if (replyTarget) {
            messageData.replyTo = {
                messageId: replyTarget.messageId,
                text: replyTarget.text,
                senderId: replyTarget.senderId
            };
        }

        const messageReference = await addDoc(
            collection(db, "chats", chatId, "messages"),
            messageData
        );
        console.log("DEBUG 4 - Messaggio salvato:", messageReference.id);

        console.log("MESSAGGIO SALVATO:", messageReference.id);

        messageInput.value = "";
        clearReply();

        // Notifica al destinatario tramite il Worker.
        // Il messaggio è già stato salvato in Firestore.
        try {

            const idToken = await currentUser.getIdToken();

            const notificationResponse = await fetch(
                "https://enclave-notification.gpvyw7wnf8.workers.dev/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        chatId: chatId,
                        messageId: messageReference.id
                    })
                }
            );

            const notificationResult =
                await notificationResponse.json();

            if (!notificationResponse.ok) {
                console.error(
                    "Notifica non inviata:",
                    notificationResult
                );
            } else {
                console.log(
                    "Risultato notifiche:",
                    notificationResult
                );
            }

        } catch (notificationError) {

            console.error(
                "Errore collegamento notifiche:",
                notificationError
            );

        }

        console.log("INVIO COMPLETATO ✅");

    } catch (error) {

    console.error("ERRORE INVIO MESSAGGIO:", {
        code: error.code,
        message: error.message,
        chatId: currentChatId,
        currentUserUid: auth.currentUser?.uid,
        contactUid: currentChatUserUid
    });

    alert(
        "Errore: " +
        (error.code || "sconosciuto") +
        "\n" +
        error.message
    );

}
}



sendMessageButton.addEventListener(
    "click",
    sendMessage
);


messageInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            event.preventDefault();

            sendMessage();

        }

    }
);


// ==========================
// NICKNAME PERSONALIZZABILE
// ==========================

async function getContactNickname(contactUid, originalNickname) {
    const currentUser = auth.currentUser;

    if (!currentUser) return originalNickname;

    try {
        const nicknameReference = doc(
            db,
            "users",
            currentUser.uid,
            "contactNicknames",
            contactUid
        );

        const nicknameDocument = await getDoc(nicknameReference);

        if (nicknameDocument.exists()) {
            const customNickname = nicknameDocument.data().nickname;

            if (typeof customNickname === "string" && customNickname.trim()) {
                return customNickname.trim();
            }
        }
    } catch (error) {
        console.error("Errore recupero soprannome personale:", error);
    }

    return originalNickname;
}

async function saveContactNickname(contactUid, nickname) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        throw new Error("Devi aver effettuato l'accesso.");
    }

    if (contactUid === currentUser.uid) {
        throw new Error("Non puoi rinominare te stesso.");
    }

    const nicknameReference = doc(
        db,
        "users",
        currentUser.uid,
        "contactNicknames",
        contactUid
    );

    const cleanNickname = nickname.trim();

    if (!cleanNickname) {
        await deleteDoc(nicknameReference);
        return;
    }

    if (cleanNickname.length > 40) {
        throw new Error("Il soprannome può contenere al massimo 40 caratteri.");
    }

    await setDoc(nicknameReference, {
        nickname: cleanNickname,
        updatedAt: serverTimestamp()
    });
}



// =========================
// CARICAMENTO CONVERSAZIONI
// =========================

function loadConversations() {

    if (unsubscribeChats) {

        unsubscribeChats();

        unsubscribeChats = null;

    }


    const currentUser =
        auth.currentUser;


    if (!currentUser) {
        return;
    }


    const chatsReference =
        collection(
            db,
            "chats"
        );


    const chatsQuery =
        query(
            chatsReference,
            where(
                "participants",
                "array-contains",
                currentUser.uid
            )
        );


    unsubscribeChats =
        onSnapshot(
            chatsQuery,
            async (snapshot) => {

                const renderVersion =
                    ++conversationsRenderVersion;


                const conversationList =
                    document.querySelector(
                        ".conversation-list"
                    );


                if (!conversationList) {
                    return;
                }

                // Riusa i profili pubblici anche tra aggiornamenti diversi della
                // lista chat. Questo riduce letture Firestore e attese ripetute.
                const getPublicUserSnapshot = getCachedPublicUserSnapshot;

                const conversationResults =
                    await Promise.all(

                        snapshot.docs.map(
                            async (chatDocument) => {

                                const chatData =
                                    chatDocument.data();

                                
                                  if (chatData.type === "group") {

                                            let lastMessage = chatData.lastMessage || "";
                                        
                                            if (lastMessage && chatData.lastSenderId) {
                                        
                                                try {
                                        
                                                    const senderDocument = await getPublicUserSnapshot(
                                                        chatData.lastSenderId
                                                    );
                                        
                                                    if (senderDocument.exists()) {
                                        
                                                        const senderNickname =
                                                            senderDocument.data().nickname || "Utente";
                                        
                                                        lastMessage =
                                                            `${senderNickname}: ${lastMessage}`;
                                        
                                                    }
                                        
                                                } catch (error) {
                                        
                                                    console.error(
                                                        "Errore recupero nickname ultimo mittente:",
                                                        error
                                                    );
                                        
                                                }
                                        
                                            }
                                        
                                            return {
                                        
                                                chatId: chatDocument.id,
                                        
                                                type: "group",
                                        
                                                uid: null,
                                        
                                                nickname: chatData.name,
                                        
                                                enclaveId:
                                                    `${chatData.participants.length} partecipanti`,
                                        
                                                lastMessage: lastMessage,
                                        
                                                lastMessageAt:
                                                    chatData.lastMessageAt || null,
                                        
                                                participants:
                                                    chatData.participants
                                        
                                            };
                                        
                                        }


                                const otherUserUid =
                                    chatData.participants.find(
                                        (uid) =>
                                            uid !==
                                            currentUser.uid
                                    );


                                if (!otherUserUid) {
                                    return null;
                                }


                                const userDocument =
                                    await getPublicUserSnapshot(otherUserUid);


                                if (
                                    !userDocument.exists()
                                ) {

                                    return null;

                                }


                                
                            const userData = userDocument.data();
                                
                                const displayedNickname = await getContactNickname(
                                    otherUserUid,
                                    userData.nickname || "Utente"
                                );
                                
                                return {
                                    chatId: chatDocument.id,
                                    uid: otherUserUid,
                                    nickname: displayedNickname,
                                    originalNickname: userData.nickname || "Utente",
                                    enclaveId: userData.enclaveId,
                                    lastMessage: chatData.lastMessage || "",
                                    lastMessageAt: chatData.lastMessageAt || null
                                };


                            }
                        )

                    );


                if (
                    renderVersion !==
                    conversationsRenderVersion
                ) {

                    return;

                }


                const conversations =
                    conversationResults.filter(
                        (conversation) =>
                            conversation !== null
                    );


                const uniqueConversations =
                    new Map();


                conversations.forEach(
                    
                    (conversation) => {
                
                        const conversationKey =
                            conversation.type === "group"
                                ? conversation.chatId
                                : conversation.uid;
                
                        const existing =
                            uniqueConversations.get(
                                conversationKey
                            );
                        
                               if (!existing) { 
                                   
                                   uniqueConversations.set(
                                        conversationKey,
                                        conversation
                                    );
                            
                                   
                            return;

                        }


                        const existingTime =
                            existing.lastMessageAt
                                ?.toMillis?.() || 0;


                        const currentTime =
                            conversation.lastMessageAt
                                ?.toMillis?.() || 0;


                        if (
                            currentTime >
                            existingTime
                        ) {

                            uniqueConversations.set(
                                conversation.uid,
                                conversation
                            );

                        }

                    }
                );


                const finalConversations =
                    Array.from(
                        uniqueConversations.values()
                    );


                finalConversations.sort(
                    (a, b) => {

                        const timeA =
                            a.lastMessageAt
                                ?.toMillis?.() || 0;


                        const timeB =
                            b.lastMessageAt
                                ?.toMillis?.() || 0;


                        return timeB - timeA;

                    }
                );


                if (
                    renderVersion !==
                    conversationsRenderVersion
                ) {

                    return;

                }


                conversationList.innerHTML =
                    "";


                if (
                    finalConversations.length === 0
                ) {

                    const empty =
                        document.createElement(
                            "div"
                        );


                    empty.className =
                        "no-conversations";


                    empty.textContent =
                        "Nessuna conversazione";


                    conversationList.appendChild(
                        empty
                    );


                    return;

                }


                finalConversations.forEach(
                    (conversation) => {

                        const conversationElement =
                            document.createElement(
                                "div"
                            );


                        conversationElement.className =
                            "conversation-item";

                        if (conversation.type !== "group" && conversation.uid) {
                            
                                    conversationElement.dataset.contactUid = conversation.uid;
                                }


                        const avatar =
                            document.createElement(
                                "div"
                            );


                        avatar.className =
                            "conversation-avatar";


                        avatar.textContent =
                            conversation.type === "group"
                                ? "👥"
                                : conversation.nickname
                                    .charAt(0)
                                    .toUpperCase();


                        const info =
                            document.createElement(
                                "div"
                            );


                        info.className =
                            "conversation-info";


                        const top =
                            document.createElement(
                                "div"
                            );


                        top.className =
                            "conversation-top";


                        const nickname =
                            document.createElement(
                                "span"
                            );


                        nickname.className =
                            "conversation-nickname";


                        nickname.textContent =
                            conversation.nickname;


                        const time =
                            document.createElement(
                                "span"
                            );


                        time.className =
                            "conversation-time";


                        if (
                            conversation.lastMessageAt
                        ) {

                            time.textContent =
                                conversation.lastMessageAt
                                    .toDate()
                                    .toLocaleTimeString(
                                        "it-IT",
                                        {
                                            hour:
                                                "2-digit",

                                            minute:
                                                "2-digit"
                                        }
                                    );

                        }


                        const preview =
                            document.createElement(
                                "div"
                            );


                        preview.className =
                            "conversation-preview";


                        preview.textContent =
                            conversation.lastMessage;


                        top.appendChild(nickname);

                            const meta = document.createElement("div");
                            meta.className = "conversation-meta";
                            
                            
                                const unreadBadge = document.createElement("span");
                                unreadBadge.className = "unread-badge";

                                unreadBadge.dataset.chatId = conversation.chatId;
                                
                                meta.appendChild(time);
                                meta.appendChild(unreadBadge);
                                
                                // Aggiornamento del contatore dei messaggi non letti
                                const conversationIdForBadge = conversation.chatId;
                                
                                if (unreadMessageListeners.has(conversationIdForBadge)) {
                                    unreadMessageListeners.get(conversationIdForBadge)();
                                }
                            
                            const unreadMessagesUnsubscribe = onSnapshot(
                                query(
                                    collection(db, "chats", conversationIdForBadge, "messages")
                                ),
                                () => {
                                    updateUnreadBadge(
                                        conversationIdForBadge,
                                        unreadBadge,
                                        currentUser.uid
                                    );
                                },
                                error => {
                                        console.error("ERRORE BADGE - DETTAGLI:", {
                                            chatId: conversationIdForBadge,
                                            userUid: currentUser.uid,
                                            code: error.code,
                                            message: error.message
                                        });
                                    }
                            );
                            
                            unreadMessageListeners.set(
                                conversationIdForBadge,
                                unreadMessagesUnsubscribe
                            );

                            
                            meta.appendChild(time);
                            meta.appendChild(unreadBadge);
                            
                            top.appendChild(meta);


                        info.appendChild(
                            top
                        );


                        info.appendChild(
                            preview
                        );


                        conversationElement.appendChild(
                            avatar
                        );


                        conversationElement.appendChild(
                            info
                        );


                        conversationList.appendChild(
                            conversationElement
                        );


                        conversationElement.addEventListener(
                            "click",
                            () => {

                                clearUnreadBadge(conversation.chatId);

                                markChatAsRead(conversation.chatId);

                                chatEmptyState.classList.add(
                                    "hidden"
                                );


                                activeChat.classList.remove(
                                    "hidden"
                                );

                                if (conversation.type === "group") {

                                        chatUserNickname.textContent =
                                            conversation.nickname;
                                    
                                        chatUserId.textContent =
                                            conversation.enclaveId;
                                    
                                        chatUserAvatar.textContent =
                                            "👥";
                                    
                                        currentChatUserUid =
                                            null;
                                    
                                        currentChatId =
                                            conversation.chatId;
                                    
                                    
                                        chatUserInfo.classList.add(
                                            "group-chat-clickable"
                                        );
                                    
                                        chatUserInfo.onclick =
                                            () => {
                                    
                                                openGroupInfo(
                                                    conversation.chatId
                                                );
                                    
                                            };
                                    
                                    
                                        loadMessages(
                                            currentChatId
                                        );
                                    
                                    
                                        homeMain.classList.add(
                                            "chat-open"
                                        );
                                    
                                    
                                        if (
                                            window.innerWidth <=
                                            700
                                        ) {
                                    
                                            chatSidebar.style.display =
                                                "none";
                                    
                                            chatArea.style.display =
                                                "flex";
                                    
                                            chatArea.style.width =
                                                "100%";
                                    
                                        }
                                    
                                    
                                        return;
                                    
                                    }


                                chatUserNickname.textContent = conversation.nickname;
                                
                                    chatUserInfo.classList.remove("group-chat-clickable");
                                    
                                    chatUserInfo.onclick = () => {
                                        openContactInfo(
                                            conversation.uid,
                                            conversation.originalNickname || conversation.nickname
                                        );
                                    };


                                chatUserId.textContent =
                                    conversation.enclaveId;


                                chatUserAvatar.textContent =
                                    conversation.nickname
                                        .charAt(0)
                                        .toUpperCase();


                                currentChatUserUid =
                                    conversation.uid;


                                currentChatId =
                                    createChatId(
                                        currentUser.uid,
                                        conversation.uid
                                    );


                                loadMessages(
                                    currentChatId
                                );


                                homeMain.classList.add(
                                    "chat-open"
                                );


                                if (
                                    window.innerWidth <=
                                    700
                                ) {

                                    chatSidebar.style.display =
                                        "none";


                                    chatArea.style.display =
                                        "flex";


                                    chatArea.style.width =
                                        "100%";

                                }

                            }
                        );

                    }
                );

            },
            (error) => {

                console.error(
                    "Errore caricamento conversazioni:",
                    error
                );

            }
        );

}


/* =========================
   TASTIERA MOBILE: ADATTA SOLO L'APP ALLA VISUAL VIEWPORT
   Su iOS la visualViewport può restare più piccola anche dopo la chiusura
   della tastiera. Usiamo quindi la visual viewport solo mentre l'input chat
   è davvero attivo e ripristiniamo il layout normale dopo il blur.
   ========================= */
(() => {
    const viewport = window.visualViewport;
    const mobileQuery = window.matchMedia("(max-width: 700px)");
    const chatInputSelector = ".chat-input-area input, .chat-input-area textarea";
    let restoreTimer = null;

    const isChatInputFocused = () => {
        const active = document.activeElement;
        return !!(active && active.matches && active.matches(chatInputSelector));
    };

    const clearKeyboardViewport = () => {
        document.documentElement.style.removeProperty("--enclave-visible-height");
        document.documentElement.style.removeProperty("--enclave-viewport-top");
        document.documentElement.classList.remove("enclave-keyboard-open");
    };

    const updateVisibleChatHeight = () => {
        if (!mobileQuery.matches || !viewport || !isChatInputFocused()) {
            clearKeyboardViewport();
            return;
        }

        document.documentElement.classList.add("enclave-keyboard-open");
        document.documentElement.style.setProperty(
            "--enclave-visible-height",
            `${Math.max(1, Math.round(viewport.height))}px`
        );
        document.documentElement.style.setProperty(
            "--enclave-viewport-top",
            `${Math.max(0, Math.round(viewport.offsetTop))}px`
        );
    };

    const scheduleRestore = () => {
        window.clearTimeout(restoreTimer);
        // iOS aggiorna la visualViewport con un leggero ritardo dopo aver
        // chiuso la tastiera: non ripristinare l'altezza mentre è ancora visibile.
        restoreTimer = window.setTimeout(() => {
            if (!isChatInputFocused()) clearKeyboardViewport();
            else updateVisibleChatHeight();
        }, 350);
    };

    if (viewport) {
        viewport.addEventListener("resize", updateVisibleChatHeight, { passive: true });
        viewport.addEventListener("scroll", updateVisibleChatHeight, { passive: true });
    }
    window.addEventListener("resize", updateVisibleChatHeight, { passive: true });
    window.addEventListener("orientationchange", scheduleRestore, { passive: true });

    document.addEventListener("focusin", event => {
        if (event.target && event.target.matches && event.target.matches(chatInputSelector)) {
            window.clearTimeout(restoreTimer);
            // Un frame lascia a Safari il tempo di aggiornare la visual viewport.
            window.requestAnimationFrame(updateVisibleChatHeight);
        }
    });

    document.addEventListener("focusout", event => {
        if (event.target && event.target.matches && event.target.matches(chatInputSelector)) {
            scheduleRestore();
        }
    });

    // La pagina parte sempre con il layout normale, senza conservare una
    // vecchia altezza ridotta da una precedente apertura della tastiera.
    clearKeyboardViewport();
})();
