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


let currentChatUserUid = null;

let currentChatId = null;

let unsubscribeMessages = null;

let unsubscribeChats = null;


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

}


// =========================
// PROFILO UTENTE
// =========================

async function loadUserProfile(user) {

    const userDocument =
        await getDoc(
            doc(db, "users", user.uid)
        );


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


    menu.appendChild(
        editButton
    );

    menu.appendChild(
        deleteButton
    );


    messageElement.appendChild(
        menu
    );


    editButton.addEventListener(
        "click",
        async (event) => {

            event.stopPropagation();

            closeMessageMenus();

            await editMessage(
                message.id,
                currentChatId,
                message.text
            );

        }
    );


    deleteButton.addEventListener(
        "click",
        async (event) => {

            event.stopPropagation();

            closeMessageMenus();

            await deleteMessage(
                message.id,
                currentChatId
            );

        }
    );

}


// =========================
// CARICAMENTO MESSAGGI
// =========================

function loadMessages(chatId) {

    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages = null;

    }


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
            (snapshot) => {

                closeMessageMenus();

                chatMessages.innerHTML =
                    "";


                if (snapshot.empty) {

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


                // ORDINA I MESSAGGI

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


                        const bubble =
                            document.createElement(
                                "div"
                            );

                        bubble.className =
                            "message-bubble";


                        const textElement =
                            document.createElement(
                                "span"
                            );

                        textElement.className =
                            "message-text";

                        textElement.textContent =
                            message.text;


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


                        messageElement.appendChild(
                            bubble
                        );


                        // =========================
                        // AZIONI SOLO SUI TUOI MESSAGGI
                        // =========================

                        if (isOwnMessage) {

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


                            /*
                             * IMPORTANTE:
                             * la freccetta viene inserita
                             * nello stesso elemento del messaggio
                             * e resta cliccabile.
                             */

                            messageElement.appendChild(
                                actionButton
                            );


                            // =========================
                            // PC
                            // =========================

                            actionButton.addEventListener(
                                "click",
                                (event) => {

                                    event.preventDefault();

                                    event.stopPropagation();

                                    openMessageMenu(
                                        messageElement,
                                        message
                                    );

                                }
                            );


                            // =========================
                            // TELEFONO
                            // =========================

                            let longPressTimer =
                                null;


                            messageElement.addEventListener(
                                "touchstart",
                                (event) => {

                                    if (
                                        event.touches.length !== 1
                                    ) {
                                        return;
                                    }


                                    longPressTimer =
                                        setTimeout(
                                            () => {

                                                event.preventDefault();

                                                openMessageMenu(
                                                    messageElement,
                                                    message
                                                );

                                            },
                                            500
                                        );

                                },
                                {
                                    passive: false
                                }
                            );


                            messageElement.addEventListener(
                                "touchend",
                                () => {

                                    clearTimeout(
                                        longPressTimer
                                    );

                                }
                            );


                            messageElement.addEventListener(
                                "touchmove",
                                () => {

                                    clearTimeout(
                                        longPressTimer
                                    );

                                }
                            );


                            messageElement.addEventListener(
                                "touchcancel",
                                () => {

                                    clearTimeout(
                                        longPressTimer
                                    );

                                }
                            );


                            // Impedisce il menu contestuale
                            // del browser su mobile

                            messageElement.addEventListener(
                                "contextmenu",
                                (event) => {

                                    if (
                                        window.innerWidth <= 700
                                    ) {

                                        event.preventDefault();

                                    }

                                }
                            );

                        }


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


            if (idDocument.exists()) {

                console.log(
                    "DATI ID:",
                    idDocument.data()
                );

            }


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


        chatEmptyState.classList.remove(
            "hidden"
        );

        activeChat.classList.add(
            "hidden"
        );

        homeMain.classList.remove(
            "chat-open"
        );


        if (unsubscribeMessages) {

            unsubscribeMessages();

            unsubscribeMessages = null;

        }


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

    const message =
        messageInput.value.trim();


    if (!message) {
        return;
    }


    const currentUser =
        auth.currentUser;


    if (!currentUser) {
        return;
    }


    if (!currentChatUserUid) {
        return;
    }


    if (
        currentUser.uid ===
        currentChatUserUid
    ) {

        return;
    }


    try {

        const chatId =
            createChatId(
                currentUser.uid,
                currentChatUserUid
            );


        currentChatId =
            chatId;


        console.log(
            "CHAT ID:",
            chatId
        );


        const chatReference =
            doc(
                db,
                "chats",
                chatId
            );


        await setDoc(
            chatReference,
            {
                participants: [
                    currentUser.uid,
                    currentChatUserUid
                ],

                lastMessage:
                    message,

                lastMessageAt:
                    serverTimestamp(),

                lastSenderId:
                    currentUser.uid
            },
            {
                merge: true
            }
        );


        console.log(
            "CHAT CREATA / AGGIORNATA"
        );


        await addDoc(
            collection(
                db,
                "chats",
                chatId,
                "messages"
            ),
            {
                text:
                    message,

                senderId:
                    currentUser.uid,

                createdAt:
                    serverTimestamp(),

                edited:
                    false
            }
        );


        console.log(
            "MESSAGGIO SALVATO"
        );


        messageInput.value =
            "";


        console.log(
            "INVIO COMPLETATO ✅"
        );


    } catch (error) {

        console.error(
            "ERRORE INVIO MESSAGGIO:",
            error
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

                const conversationList =
                    document.querySelector(
                        ".conversation-list"
                    );


                if (!conversationList) {
                    return;
                }


                conversationList.innerHTML =
                    "";


                if (snapshot.empty) {

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


                const conversations = [];


                for (
                    const chatDocument
                    of snapshot.docs
                ) {

                    const chatData =
                        chatDocument.data();


                    const otherUserUid =
                        chatData.participants.find(
                            (uid) =>
                                uid !==
                                currentUser.uid
                        );


                    if (!otherUserUid) {
                        continue;
                    }


                    const userDocument =
                        await getDoc(
                            doc(
                                db,
                                "publicUsers",
                                otherUserUid
                            )
                        );


                    if (!userDocument.exists()) {
                        continue;
                    }


                    const userData =
                        userDocument.data();


                    conversations.push({

                        chatId:
                            chatDocument.id,

                        uid:
                            otherUserUid,

                        nickname:
                            userData.nickname,

                        enclaveId:
                            userData.enclaveId,

                        lastMessage:
                            chatData.lastMessage ||
                            "",

                        lastMessageAt:
                            chatData.lastMessageAt ||
                            null

                    });

                }


                conversations.sort(
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


                conversations.forEach(
                    (conversation) => {

                        const conversationElement =
                            document.createElement(
                                "div"
                            );

                        conversationElement.className =
                            "conversation-item";


                        const avatar =
                            document.createElement(
                                "div"
                            );

                        avatar.className =
                            "conversation-avatar";

                        avatar.textContent =
                            conversation.nickname
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


                        top.appendChild(
                            nickname
                        );

                        top.appendChild(
                            time
                        );


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

                                chatEmptyState.classList.add(
                                    "hidden"
                                );

                                activeChat.classList.remove(
                                    "hidden"
                                );


                                chatUserNickname.textContent =
                                    conversation.nickname;

                                chatUserId.textContent =
                                    conversation.enclaveId;

                                chatUserAvatar.textContent =
                                    conversation.nickname
                                        .charAt(0)
                                        .toUpperCase();


                                currentChatUserUid =
                                    conversation.uid;

                                currentChatId =
                                    conversation.chatId;


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
