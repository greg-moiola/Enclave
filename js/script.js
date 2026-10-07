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
    setDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
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

let currentChatUserUid = null;

let currentChatId = null;

let unsubscribeMessages = null;


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


async function loadUserProfile(user) {

    const userDocument =
        await getDoc(
            doc(db, "users", user.uid)
        );


    if (!userDocument.exists()) {

        console.error("Profilo utente non trovato.");

        return;
    }


    const userData =
        userDocument.data();


    const nickname =
        userData.nickname;

    const enclaveId =
        userData.enclaveId;


    // HEADER

    userNickname.textContent =
        nickname;

    userEnclaveId.textContent =
        enclaveId;


    // PROFILO SIDEBAR

    profileNickname.textContent =
        nickname;

    profileEnclaveId.textContent =
        enclaveId;


    // INIZIALE AVATAR

    profileInitial.textContent =
        nickname.charAt(0).toUpperCase();
}

    

function showVerification(user) {

    verificationEmail.textContent =
        user.email;

    verificationMessage.textContent =
        "";

    verificationSpinner.style.display =
        "none";

    verificationOverlay.classList.remove("hidden");

}


async function checkEmailVerification(user) {

    verificationSpinner.style.display =
        "block";


    await user.reload();


    if (user.emailVerified) {

    verificationSpinner.style.display =
        "none";

    verificationOverlay.classList.add("hidden");

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
    .addEventListener("click", async () => {

        const email =
            document.getElementById("registerEmail").value.trim();

        const password =
            document.getElementById("registerPassword").value;

        const nickname =
            document.getElementById("registerNickname").value.trim();

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
            await registerUser(email, password, nickname);


        if (result.success) {

    showVerification(result.user);

    checkEmailVerification(result.user);

} else {

    message.textContent =
        "Errore: " + result.error.message;

}

    });


// =========================
// APRI LOGIN
// =========================

document
    .getElementById("loginLink")
    .addEventListener("click", () => {

        showLogin();

    });


// =========================
// LOGIN
// =========================

document
    .getElementById("loginButton")
    .addEventListener("click", async () => {

        const email =
            document.getElementById("loginEmail").value.trim();

        const password =
            document.getElementById("loginPassword").value;

        const message =
            document.getElementById("loginMessage");


        if (!email || !password) {

            message.textContent =
                "Inserisci email e password.";

            return;
        }


        message.textContent =
            "Accesso in corso...";


        const result =
            await loginUser(email, password);


        if (result.success) {

    showHome();

    await loadUserProfile(result.user);

} else if (result.emailNotVerified) {

    message.textContent =
        "Devi prima verificare la tua email.";

} else {

    message.textContent =
        "Email o password non corretti.";

    console.error(result.error);

}

    });


// =========================
// TORNA ALLA REGISTRAZIONE
// =========================

document
    .getElementById("registerLink")
    .addEventListener("click", () => {

        showRegister();

    });


// =========================
// LOGOUT
// =========================

document
    .getElementById("logoutButton")
    .addEventListener("click", () => {

        showRegister();

    });



resendVerificationButton
    .addEventListener("click", async () => {

        const user =
            (await import("./firebase.js")).auth.currentUser;


        if (!user) {
            return;
        }


        try {

            await sendEmailVerification(user);

            verificationMessage.textContent =
                "Email inviata nuovamente.";

        } catch (error) {

            console.error(error);

            verificationMessage.textContent =
                "Non è stato possibile inviare l'email.";

        }

    });


// =========================
// ID CONVERSAZIONE
// =========================

function createChatId(uid1, uid2) {

    return [uid1, uid2]
        .sort()
        .join("_");

}


// =========================
// CARICAMENTO MESSAGGI
// =========================

function loadMessages(chatId) {

    // Se stavamo già ascoltando un'altra chat,
    // interrompiamo quel listener
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

                chatMessages.innerHTML = "";


                if (snapshot.empty) {

                    const emptyMessage =
                        document.createElement("div");

                    emptyMessage.className =
                        "chat-empty-messages";

                    emptyMessage.textContent =
                        "Nessun messaggio";

                    chatMessages.appendChild(
                        emptyMessage
                    );

                    return;
                }


                const messages =
                    [];


                snapshot.forEach(
                    (messageDocument) => {

                        messages.push({
                            id: messageDocument.id,
                            ...messageDocument.data()
                        });

                    }
                );


                // Ordina i messaggi dal più vecchio
                // al più recente
                messages.sort(
                    (a, b) => {

                        const timeA =
                            a.createdAt?.toMillis?.() || 0;

                        const timeB =
                            b.createdAt?.toMillis?.() || 0;

                        return timeA - timeB;

                    }
                );


                const currentUser =
                    auth.currentUser;


                messages.forEach(
                    (message) => {

                        const messageElement =
                            document.createElement("div");


                        if (
                            currentUser &&
                            message.senderId ===
                            currentUser.uid
                        ) {

                            messageElement.className =
                                "message message-own";

                        } else {

                            messageElement.className =
                                "message message-other";

                        }


                        const bubble =
                            document.createElement("div");

                        bubble.className =
                            "message-bubble";


                        const textElement =
                            document.createElement("span");

                        textElement.className =
                            "message-text";

                        textElement.textContent =
                            message.text;


                        const timeElement =
                            document.createElement("span");

                        timeElement.className =
                            "message-time";


                        if (message.createdAt) {

                            timeElement.textContent =
                                message.createdAt
                                    .toDate()
                                    .toLocaleTimeString(
                                        "it-IT",
                                        {
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        }
                                    );

                        } else {

                            timeElement.textContent =
                                "";

                        }


                        bubble.appendChild(
                            textElement
                        );

                        bubble.appendChild(
                            timeElement
                        );

                        messageElement.appendChild(
                            bubble
                        );

                        chatMessages.appendChild(
                            messageElement
                        );

                    }
                );


                // Porta automaticamente
                // alla fine della conversazione
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
// RICERCA UTENTI
// =========================

const chatSearch =
    document.getElementById("chatSearch");

const searchResults =
    document.getElementById("searchResults");

chatSearch.addEventListener("input", async () => {
    console.log("RICERCA ATTIVATA");

    const search =
        chatSearch.value.trim().toUpperCase();

    searchResults.innerHTML = "";

    if (!search) {
        return;
    }

    // Cerchiamo l'Enclave ID
    try {

        console.log("RICERCA ID:", search);

        const idDocument =
            await getDoc(
                doc(db, "enclaveIds", search)
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
                document.createElement("div");

            noResult.className =
                "search-no-result";

            noResult.textContent =
                "Nessun utente trovato.";

            searchResults.appendChild(noResult);

            return;
        }


        // Recuperiamo il UID dell'utente
        const userUid =
            idDocument.data().uid;

        // Recuperiamo il profilo
        const userDocument =
    await getDoc(
        doc(db, "publicUsers", userUid)
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

        // Creiamo il risultato
        const result =
            document.createElement("div");

        result.className =
            "search-result";

        result.innerHTML = `

            <div class="search-result-avatar">
                ${nickname.charAt(0).toUpperCase()}
            </div>

            <div class="search-result-info">

                <span class="search-result-nickname">
                    ${nickname}
                </span>

                <span class="search-result-id">
                    ${enclaveId}
                </span>

            </div>

        `;

        searchResults.appendChild(result);

        
        result.addEventListener("click", () => {

    // Chiudiamo la schermata iniziale
    chatEmptyState.classList.add("hidden");

    // Apriamo la chat
    activeChat.classList.remove("hidden");

    // Inseriamo i dati dell'utente
    chatUserNickname.textContent =
        nickname;

    chatUserId.textContent =
        enclaveId;

    chatUserAvatar.textContent =
        nickname.charAt(0).toUpperCase();
            
    currentChatUserUid = userUid;

            currentChatId =
    createChatId(
        auth.currentUser.uid,
        userUid
    );

loadMessages(
    currentChatId
);


    // =========================
    // APERTURA CHAT
    // =========================

    homeMain.classList.add("chat-open");


    // Su mobile mostriamo la chat
    // e nascondiamo la sidebar
    if (window.innerWidth <= 700) {

        chatSidebar.style.display = "none";

        chatArea.style.display = "flex";

        chatArea.style.width = "100%";
    }

});


    } catch (error) {

        console.error(
            "Errore ricerca utente:",
            error
        );

    }

});


chatBackButton.addEventListener(
    "click",
    () => {

        chatEmptyState.classList.remove("hidden");

        activeChat.classList.add("hidden");

        homeMain.classList.remove("chat-open");

        currentChatUserUid = null;
        currentChatId = null;

        if (window.innerWidth <= 700) {

            chatSidebar.style.display = "flex";

            chatArea.style.display = "none";

        }

    }
);


// =========================
// INVIO MESSAGGI
// =========================

const messageInput =
    document.getElementById("messageInput");

const sendMessageButton =
    document.getElementById("sendMessageButton");

const chatMessages =
    document.getElementById("chatMessages");


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

    // Evita di scrivere a se stessi
    if (currentUser.uid === currentChatUserUid) {
        return;
    }

    try {

        // Crea sempre lo stesso ID per questa coppia di utenti
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


        // =========================
        // CREA / AGGIORNA CHAT
        // =========================

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

                lastMessage: message,

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


        // =========================
        // SALVA MESSAGGIO
        // =========================

        await addDoc(
            collection(
                db,
                "chats",
                chatId,
                "messages"
            ),
            {
                text: message,

                senderId:
                    currentUser.uid,

                createdAt:
                    serverTimestamp()
            }
        );

        console.log(
            "MESSAGGIO SALVATO"
        );
