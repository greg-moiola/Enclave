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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    db,
    auth
} from "./firebase.js";


let currentChatUserUid = null;
let currentChatId = null;
let unsubscribeMessages = null;
let unsubscribeChats = null;
let conversationsRenderVersion = 0;
let replyTarget = null;


/* =========================
   SCHERMATE
========================= */

function showRegister() {
    document.getElementById("registerScreen").classList.remove("hidden");
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("homeScreen").classList.add("hidden");
}

function showLogin() {
    document.getElementById("registerScreen").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
    document.getElementById("homeScreen").classList.add("hidden");
}

function showHome() {
    document.getElementById("registerScreen").classList.add("hidden");
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("homeScreen").classList.remove("hidden");

    loadProfile();
    loadConversations();
}


/* =========================
   PROFILO
========================= */

async function loadProfile() {

    const user = auth.currentUser;

    if (!user) return;

    const userSnap = await getDoc(
        doc(db, "users", user.uid)
    );

    if (!userSnap.exists()) return;

    const data = userSnap.data();

    const nicknameElement =
        document.getElementById("profileNickname");

    const enclaveIdElement =
        document.getElementById("profileEnclaveId");

    if (nicknameElement) {
        nicknameElement.textContent =
            data.nickname || "Utente";
    }

    if (enclaveIdElement) {
        enclaveIdElement.textContent =
            data.enclaveId || "XX-0000";
    }
}


/* =========================
   VERIFICA EMAIL
========================= */

function showVerificationOverlay(email) {

    const overlay =
        document.getElementById("verificationOverlay");

    const emailElement =
        document.getElementById("verificationEmail");

    if (!overlay) return;

    if (emailElement) {
        emailElement.textContent = email;
    }

    overlay.classList.remove("hidden");

    startVerificationCheck();
}


let verificationInterval = null;

function startVerificationCheck() {

    if (verificationInterval) {
        clearInterval(verificationInterval);
    }

    verificationInterval = setInterval(async () => {

        const user = auth.currentUser;

        if (!user) return;

        try {

            await user.reload();

            if (user.emailVerified) {

                clearInterval(verificationInterval);
                verificationInterval = null;

                const overlay =
                    document.getElementById("verificationOverlay");

                if (overlay) {
                    overlay.classList.add("hidden");
                }

                showRegister();
            }

        } catch (error) {

            console.error(
                "Errore controllo verifica:",
                error
            );

        }

    }, 2000);
}


/* =========================
   REGISTRAZIONE
========================= */

document
    .getElementById("registerForm")
    ?.addEventListener("submit", async (event) => {

        event.preventDefault();

        const nickname =
            document.getElementById("registerNickname").value.trim();

        const email =
            document.getElementById("registerEmail").value.trim();

        const password =
            document.getElementById("registerPassword").value;

        const confirmPassword =
            document.getElementById("registerConfirmPassword").value;

        if (password !== confirmPassword) {

            alert("Le password non coincidono.");
            return;

        }

        try {

            const result = await registerUser(
                nickname,
                email,
                password
            );

            await sendEmailVerification(result.user);

            showVerificationOverlay(email);

        } catch (error) {

            console.error(error);

            alert(
                error.message ||
                "Errore durante la registrazione."
            );

        }

    });


/* =========================
   LOGIN
========================= */

document
    .getElementById("loginForm")
    ?.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email =
            document.getElementById("loginEmail").value.trim();

        const password =
            document.getElementById("loginPassword").value;

        try {

            const result = await loginUser(
                email,
                password
            );

            if (!result.user.emailVerified) {

                showVerificationOverlay(
                    result.user.email
                );

                return;
            }

            showHome();

        } catch (error) {

            console.error(error);

            alert(
                error.message ||
                "Errore durante l'accesso."
            );

        }

    });


/* =========================
   LOGOUT
========================= */

document
    .getElementById("logoutButton")
    ?.addEventListener("click", () => {

        showRegister();

    });


/* =========================
   CHAT ID
========================= */

function createChatId(uid1, uid2) {

    return [uid1, uid2]
        .sort()
        .join("_");

}


/* =========================
   MENU MESSAGGI
========================= */

function closeMessageMenus() {

    document
        .querySelectorAll(".message-menu")
        .forEach(menu => {
            menu.remove();
        });

}


function createReplyBar() {

    let replyBar =
        document.getElementById("messageReplyBar");

    if (replyBar) {
        return replyBar;
    }

    const chatInputArea =
        document.querySelector(".chat-input-area");

    if (!chatInputArea) {
        return null;
    }

    replyBar = document.createElement("div");

    replyBar.id = "messageReplyBar";
    replyBar.className = "message-reply-bar";

    replyBar.innerHTML = `
        <div class="message-reply-info">
            <div class="message-reply-title">
                Risposta
            </div>

            <div class="message-reply-text"></div>
        </div>

        <button
            class="message-reply-cancel"
            type="button"
            aria-label="Annulla risposta"
        >
            ×
        </button>
    `;

    chatInputArea.insertBefore(
        replyBar,
        chatInputArea.firstChild
    );

    replyBar
        .querySelector(".message-reply-cancel")
        .addEventListener("click", () => {

            clearReply();

        });

    return replyBar;
}


function startReply(message) {

    replyTarget = {

        messageId: message.id,

        text: message.text || "",

        senderId: message.senderId || ""

    };

    const replyBar = createReplyBar();

    if (!replyBar) {
        return;
    }

    const replyText =
        replyBar.querySelector(
            ".message-reply-text"
        );

    if (replyText) {

        replyText.textContent =
            message.text || "Messaggio";

    }

    replyBar.style.display = "flex";

    const messageInput =
        document.getElementById("messageInput");

    if (messageInput) {
        messageInput.focus();
    }

    closeMessageMenus();

}


function clearReply() {

    replyTarget = null;

    const replyBar =
        document.getElementById("messageReplyBar");

    if (replyBar) {
        replyBar.style.display = "none";
    }

}


/* =========================
   ULTIMO MESSAGGIO CHAT
========================= */

async function updateChatLastMessage(
    chatId,
    text,
    senderId
) {

    await updateDoc(
        doc(db, "chats", chatId),
        {
            lastMessage: text,
            lastMessageAt: serverTimestamp(),
            lastSenderId: senderId
        }
    );

}


/* =========================
   ELIMINA MESSAGGIO
========================= */

async function deleteMessage(messageId) {

    if (!currentChatId) return;

    try {

        await deleteDoc(
            doc(
                db,
                "chats",
                currentChatId,
                "messages",
                messageId
            )
        );

    } catch (error) {

        console.error(
            "Errore eliminazione:",
            error
        );

    }

}


/* =========================
   MODIFICA MESSAGGIO
========================= */

async function editMessage(
    messageId,
    oldText
) {

    const newText =
        prompt(
            "Modifica messaggio:",
            oldText
        );

    if (
        newText === null ||
        !newText.trim()
    ) {
        return;
    }

    try {

        await updateDoc(
            doc(
                db,
                "chats",
                currentChatId,
                "messages",
                messageId
            ),
            {
                text: newText.trim(),
                edited: true
            }
        );

    } catch (error) {

        console.error(
            "Errore modifica:",
            error
        );

    }

}


/* =========================
   MENU AZIONI
========================= */

function openMessageMenu(
    messageElement,
    message
) {

    closeMessageMenus();

    const isOwnMessage =
        auth.currentUser &&
        message.senderId === auth.currentUser.uid;

    const menu =
        document.createElement("div");

    menu.className = "message-menu";

    /* RISPOSTA - SEMPRE DISPONIBILE */

    const replyButton =
        document.createElement("button");

    replyButton.className =
        "message-menu-button";

    replyButton.type = "button";

    replyButton.textContent =
        "↩ Rispondi";

    replyButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();
            event.stopPropagation();

            startReply(message);

        }
    );

    menu.appendChild(replyButton);


    /* MODIFICA + ELIMINA
       SOLO PER I PROPRI MESSAGGI */

    if (isOwnMessage) {

        const editButton =
            document.createElement("button");

        editButton.className =
            "message-menu-button";

        editButton.type = "button";

        editButton.textContent =
            "Modifica";

        editButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                editMessage(
                    message.id,
                    message.text || ""
                );

                closeMessageMenus();

            }
        );

        menu.appendChild(editButton);


        const deleteButton =
            document.createElement("button");

        deleteButton.className =
            "message-menu-button";

        deleteButton.type = "button";

        deleteButton.textContent =
            "Elimina";

        deleteButton.addEventListener(
            "click",
            async (event) => {

                event.preventDefault();
                event.stopPropagation();

                const confirmed =
                    confirm(
                        "Vuoi eliminare questo messaggio?"
                    );

                if (!confirmed) {
                    return;
                }

                await deleteMessage(
                    message.id
                );

                closeMessageMenus();

            }
        );

        menu.appendChild(deleteButton);

    }


    messageElement.appendChild(menu);

}


/* =========================
   CARICAMENTO MESSAGGI
========================= */

function loadMessages(chatId) {

    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    clearReply();

    const chatMessages =
        document.getElementById("chatMessages");

    if (!chatMessages) {
        return;
    }

    unsubscribeMessages =
        onSnapshot(
            collection(
                db,
                "chats",
                chatId,
                "messages"
            ),
            (snapshot) => {

                const messages =
                    snapshot.docs.map(
                        document => ({
                            id: document.id,
                            ...document.data()
                        })
                    );

                messages.sort(
                    (a, b) => {

                        const timeA =
                            a.createdAt?.toMillis?.() || 0;

                        const timeB =
                            b.createdAt?.toMillis?.() || 0;

                        return timeA - timeB;

                    }
                );


                chatMessages.innerHTML = "";


                if (messages.length === 0) {

                    const empty =
                        document.createElement("div");

                    empty.className =
                        "chat-empty-messages";

                    empty.textContent =
                        "Nessun messaggio";

                    chatMessages.appendChild(
                        empty
                    );

                    return;

                }


                messages.forEach(message => {

                    const isOwnMessage =
                        auth.currentUser &&
                        message.senderId ===
                        auth.currentUser.uid;


                    const messageElement =
                        document.createElement("div");

                    messageElement.className =
                        "message " +
                        (
                            isOwnMessage
                                ? "message-own"
                                : "message-other"
                        );

                    messageElement.dataset.messageId =
                        message.id;

                    messageElement._enclaveMessage =
                        message;


                    /* BUBBLE */

                    const bubble =
                        document.createElement("div");

                    bubble.className =
                        "message-bubble";


                    /* RISPOSTA QUOTATA */

                    if (message.replyTo) {

                        const replyQuote =
                            document.createElement("div");

                        replyQuote.className =
                            "message-reply-quote";

                        const replyTitle =
                            document.createElement("div");

                        replyTitle.className =
                            "message-reply-quote-title";

                        replyTitle.textContent =
                            message.replyTo.senderId ===
                            auth.currentUser?.uid
                                ? "Tu"
                                : (
                                    document.getElementById(
                                        "chatUserNickname"
                                    )?.textContent ||
                                    "Utente"
                                );


                        const replyText =
                            document.createElement("div");

                        replyText.className =
                            "message-reply-quote-text";

                        replyText.textContent =
                            message.replyTo.text || "";


                        replyQuote.appendChild(
                            replyTitle
                        );

                        replyQuote.appendChild(
                            replyText
                        );


                        replyQuote.addEventListener(
                            "click",
                            (event) => {

                                event.preventDefault();
                                event.stopPropagation();

                                const originalMessage =
                                    document.querySelector(
                                        `[data-message-id="${message.replyTo.messageId}"]`
                                    );

                                if (!originalMessage) {
                                    return;
                                }

                                originalMessage.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center"
                                });

                                originalMessage.classList.add(
                                    "reply-highlight"
                                );

                                setTimeout(() => {

                                    originalMessage.classList.remove(
                                        "reply-highlight"
                                    );

                                }, 1200);

                            }
                        );


                        bubble.appendChild(
                            replyQuote
                        );

                    }


                    /* TESTO */

                    const textElement =
                        document.createElement("span");

                    textElement.className =
                        "message-text";

                    textElement.textContent =
                        message.text || "";


                    /* ORARIO */

                    const timeElement =
                        document.createElement("span");

                    timeElement.className =
                        "message-time";


                    if (message.createdAt) {

                        const date =
                            message.createdAt.toDate();

                        timeElement.textContent =
                            date.toLocaleTimeString(
                                "it-IT",
                                {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                }
                            );

                    }


                    bubble.appendChild(
                        textElement
                    );

                    if (message.edited) {

                        const edited =
                            document.createElement("span");

                        edited.className =
                            "message-edited";

                        edited.textContent =
                            "modificato";

                        bubble.appendChild(
                            edited
                        );

                    }

                    bubble.appendChild(
                        timeElement
                    );


                    messageElement.appendChild(
                        bubble
                    );


                    /* =========================
                       FRECCETTA
                       SU TUTTI I MESSAGGI
                    ========================= */

                    const actionButton =
                        document.createElement("button");

                    actionButton.className =
                        "message-actions " +
                        (
                            isOwnMessage
                                ? "message-actions-own"
                                : "message-actions-other"
                        );

                    actionButton.type = "button";

                    actionButton.textContent = "⌄";


                    /*
                       APERTURA MENU DIRETTA.

                       touchend è importante per il telefono:
                       non ci affidiamo solamente al click delegato.
                    */

                    let lastTouchTime = 0;


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

                            openActions(event);

                        },
                        {
                            passive: false
                        }
                    );


                    actionButton.addEventListener(
                        "click",
                        (event) => {

                            /*
                               Evita il doppio evento
                               touchend + click.
                            */

                            if (
                                Date.now() -
                                lastTouchTime <
                                600
                            ) {
                                return;
                            }

                            openActions(event);

                        }
                    );


                    messageElement.appendChild(
                        actionButton
                    );


                    /* =========================
                       TAP SU MOBILE
                       MOSTRA FRECCETTA
                    ========================= */

                    messageElement.addEventListener(
                        "click",
                        (event) => {

                            if (
                                window.innerWidth > 700
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
                                    ".message.message-actions-visible"
                                )
                                .forEach(element => {

                                    element.classList.remove(
                                        "message-actions-visible"
                                    );

                                });


                            messageElement.classList.add(
                                "message-actions-visible"
                            );

                        }
                    );


                    chatMessages.appendChild(
                        messageElement
                    );

                });


                chatMessages.scrollTop =
                    chatMessages.scrollHeight;

            }
        );

}


/* =========================
   CHIUSURA MENU ESTERNO
========================= */

document.addEventListener(
    "click",
    (event) => {

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

        closeMessageMenus();

    }
);


/* =========================
   RICERCA UTENTE
========================= */

document
    .getElementById("userSearchForm")
    ?.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const input =
                document.getElementById(
                    "userSearchInput"
                );

            const resultContainer =
                document.getElementById(
                    "userSearchResult"
                );

            if (!input || !resultContainer) {
                return;
            }

            const searchId =
                input.value
                    .trim()
                    .toUpperCase();

            if (!searchId) {
                return;
            }

            try {

                const enclaveSnap =
                    await getDoc(
                        doc(
                            db,
                            "enclaveIds",
                            searchId
                        )
                    );


                if (!enclaveSnap.exists()) {

                    resultContainer.innerHTML = `
                        <div class="search-no-result">
                            Nessun utente trovato
                        </div>
                    `;

                    return;

                }


                const uid =
                    enclaveSnap.data().uid;


                const publicSnap =
                    await getDoc(
                        doc(
                            db,
                            "publicUsers",
                            uid
                        )
                    );


                if (!publicSnap.exists()) {
                    return;
                }


                const user =
                    publicSnap.data();


                resultContainer.innerHTML = `

                    <button
                        class="search-user-result"
                        type="button"
                    >

                        <div class="search-user-name">
                            ${user.nickname}
                        </div>

                        <div class="search-user-id">
                            ${user.enclaveId}
                        </div>

                    </button>

                `;


                resultContainer
                    .querySelector(
                        ".search-user-result"
                    )
                    .addEventListener(
                        "click",
                        () => {

                            openChat(
                                uid,
                                user.nickname,
                                user.enclaveId
                            );

                        }
                    );


            } catch (error) {

                console.error(
                    "Errore ricerca:",
                    error
                );

            }

        }
    );


/* =========================
   APRI CHAT
========================= */

function openChat(
    uid,
    nickname,
    enclaveId
) {

    currentChatUserUid = uid;

    currentChatId =
        createChatId(
            auth.currentUser.uid,
            uid
        );


    document
        .getElementById("chatEmptyState")
        ?.classList.add("hidden");

    document
        .getElementById("activeChat")
        ?.classList.remove("hidden");


    const nicknameElement =
        document.getElementById(
            "chatUserNickname"
        );

    const idElement =
        document.getElementById(
            "chatUserId"
        );

    const avatarElement =
        document.getElementById(
            "chatUserAvatar"
        );


    if (nicknameElement) {
        nicknameElement.textContent =
            nickname;
    }

    if (idElement) {
        idElement.textContent =
            enclaveId;
    }

    if (avatarElement) {

        avatarElement.textContent =
            nickname
                ? nickname.charAt(0).toUpperCase()
                : "?";

    }


    loadMessages(
        currentChatId
    );

}


/* =========================
   TORNA ALLA LISTA
========================= */

document
    .getElementById("chatBackButton")
    ?.addEventListener(
        "click",
        () => {

            clearReply();

            closeMessageMenus();

            document
                .getElementById("activeChat")
                ?.classList.add("hidden");

            document
                .getElementById("chatEmptyState")
                ?.classList.remove("hidden");

            currentChatUserUid = null;
            currentChatId = null;

        }
    );


/* =========================
   INVIO MESSAGGIO
========================= */

document
    .getElementById("sendMessageButton")
    ?.addEventListener(
        "click",
        sendMessage
    );


document
    .getElementById("messageInput")
    ?.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );


async function sendMessage() {

    const input =
        document.getElementById(
            "messageInput"
        );

    if (!input) {
        return;
    }

    const text =
        input.value.trim();

    if (!text || !currentChatId) {
        return;
    }

    const senderId =
        auth.currentUser.uid;


    const messageData = {

        text,

        senderId,

        createdAt:
            serverTimestamp(),

        edited: false

    };


    if (replyTarget) {

        messageData.replyTo = {

            messageId:
                replyTarget.messageId,

            text:
                replyTarget.text,

            senderId:
                replyTarget.senderId

        };

    }


    try {

        const chatRef =
            doc(
                db,
                "chats",
                currentChatId
            );


        const chatSnap =
            await getDoc(chatRef);


        if (!chatSnap.exists()) {

            await setDoc(
                chatRef,
                {
                    participants: [
                        auth.currentUser.uid,
                        currentChatUserUid
                    ],
                    lastMessage: text,
                    lastMessageAt:
                        serverTimestamp(),
                    lastSenderId:
                        senderId
                }
            );

        } else {

            await updateChatLastMessage(
                currentChatId,
                text,
                senderId
            );

        }


        await addDoc(
            collection(
                db,
                "chats",
                currentChatId,
                "messages"
            ),
            messageData
        );


        input.value = "";

        clearReply();


    } catch (error) {

        console.error(
            "Errore invio messaggio:",
            error
        );

    }

}


/* =========================
   LISTA CONVERSAZIONI
========================= */

async function loadConversations() {

    if (unsubscribeChats) {
        unsubscribeChats();
    }

    const currentUser =
        auth.currentUser;

    if (!currentUser) {
        return;
    }


    const conversationsQuery =
        query(
            collection(db, "chats"),
            where(
                "participants",
                "array-contains",
                currentUser.uid
            )
        );


    unsubscribeChats =
        onSnapshot(
            conversationsQuery,
            async (snapshot) => {

                const renderVersion =
                    ++conversationsRenderVersion;


                const conversationList =
                    document.getElementById(
                        "conversationList"
                    );

                if (!conversationList) {
                    return;
                }


                const conversationResults =
                    await Promise.all(
                        snapshot.docs.map(
                            async (chatDoc) => {

                                const data =
                                    chatDoc.data();


                                const otherUid =
                                    data.participants.find(
                                        uid =>
                                            uid !==
                                            currentUser.uid
                                    );


                                if (!otherUid) {
                                    return null;
                                }


                                const userSnap =
                                    await getDoc(
                                        doc(
                                            db,
                                            "publicUsers",
                                            otherUid
                                        )
                                    );


                                if (!userSnap.exists()) {
                                    return null;
                                }


                                const user =
                                    userSnap.data();


                                return {

                                    chatId:
                                        chatDoc.id,

                                    uid:
                                        otherUid,

                                    nickname:
                                        user.nickname,

                                    enclaveId:
                                        user.enclaveId,

                                    lastMessage:
                                        data.lastMessage || "",

                                    lastMessageAt:
                                        data.lastMessageAt

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


                conversationList.innerHTML =
                    "";


                conversationResults
                    .filter(Boolean)
                    .sort(
                        (a, b) => {

                            const timeA =
                                a.lastMessageAt
                                    ?.toMillis?.() || 0;

                            const timeB =
                                b.lastMessageAt
                                    ?.toMillis?.() || 0;

                            return timeB - timeA;

                        }
                    )
                    .forEach(
                        conversation => {

                            const element =
                                document.createElement(
                                    "button"
                                );

                            element.className =
                                "conversation-item";

                            element.type =
                                "button";


                            element.innerHTML = `

                                <div class="conversation-avatar">
                                    ${conversation.nickname
                                        ?.charAt(0)
                                        .toUpperCase() || "?"}
                                </div>

                                <div class="conversation-info">

                                    <div class="conversation-name">
                                        ${conversation.nickname}
                                    </div>

                                    <div class="conversation-last-message">
                                        ${conversation.lastMessage}
                                    </div>

                                </div>

                            `;


                            element.addEventListener(
                                "click",
                                () => {

                                    openChat(
                                        conversation.uid,
                                        conversation.nickname,
                                        conversation.enclaveId
                                    );

                                }
                            );


                            conversationList.appendChild(
                                element
                            );

                        }
                    );

            }
        );

}


/* =========================
   NAVIGAZIONE
========================= */

document
    .getElementById("goToLogin")
    ?.addEventListener(
        "click",
        showLogin
    );


document
    .getElementById("goToRegister")
    ?.addEventListener(
        "click",
        showRegister
    );
