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



let currentChatUserUid = null;

let currentChatId = null;

let unsubscribeMessages = null;

let unsubscribeChats = null;

let conversationsRenderVersion = 0;


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
                        () => {
                            removeGroupMember(
                                userData.uid,
                                userData.nickname
                            );
                        }
                    );
                
                    member.appendChild(
                        removeButton
                    );
                }


            member.appendChild(
                avatar
            );


            member.appendChild(
                info
            );


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

function loadMessages(chatId) {

    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages = null;

    }


    clearReply();


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


                        // =========================
                        // DATI DEL MESSAGGIO
                        // =========================

                        messageElement._enclaveMessage =
                            message;


                        messageElement.dataset.messageId =
                            message.id;


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


    if (
        !currentChatUserUid &&
        !currentChatId
    ) {
        return;
    }


    if (
        currentChatUserUid &&
        currentUser.uid ===
        currentChatUserUid
    ) {
    
        return;
    }


    try {

        let chatId;

            if (currentChatUserUid) {
            
                chatId =
                    createChatId(
                        currentUser.uid,
                        currentChatUserUid
                    );
            
            } else {
            
                chatId =
                    currentChatId;
            
            }


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


        if (currentChatUserUid) {

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
            
            } else {
            
                await updateDoc(
                    chatReference,
                    {
                        lastMessage:
                            message,
            
                        lastMessageAt:
                            serverTimestamp(),
            
                        lastSenderId:
                            currentUser.uid
                    }
                );
            
            }


        console.log(
            "CHAT CREATA / AGGIORNATA"
        );


        const messageData = {

            text:
                message,

            senderId:
                currentUser.uid,

            createdAt:
                serverTimestamp(),

            edited:
                false

        };


        // =========================
        // SALVA RISPOSTA
        // =========================

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


        await addDoc(
            collection(
                db,
                "chats",
                chatId,
                "messages"
            ),
            messageData
        );


        console.log(
            "MESSAGGIO SALVATO"
        );


        messageInput.value =
            "";


        clearReply();


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

                const renderVersion =
                    ++conversationsRenderVersion;


                const conversationList =
                    document.querySelector(
                        ".conversation-list"
                    );


                if (!conversationList) {
                    return;
                }


                const conversationResults =
                    await Promise.all(

                        snapshot.docs.map(
                            async (chatDocument) => {

                                const chatData =
                                    chatDocument.data();

                                if (chatData.type === "group") {

                                    return {
                                
                                        chatId:
                                            chatDocument.id,
                                
                                        type:
                                            "group",
                                
                                        uid:
                                            null,
                                
                                        nickname:
                                            chatData.name,
                                
                                        enclaveId:
                                            `${chatData.participants.length} partecipanti`,
                                
                                        lastMessage:
                                            chatData.lastMessage ||
                                            "",
                                
                                        lastMessageAt:
                                            chatData.lastMessageAt ||
                                            null,
                                
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
                                    await getDoc(
                                        doc(
                                            db,
                                            "publicUsers",
                                            otherUserUid
                                        )
                                    );


                                if (
                                    !userDocument.exists()
                                ) {

                                    return null;

                                }


                                const userData =
                                    userDocument.data();


                                return {

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


                                chatUserNickname.textContent =
                                    conversation.nickname;

                                chatUserInfo.classList.remove(
                                    "group-chat-clickable"
                                );
                                
                                chatUserInfo.onclick =
                                    null;


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

