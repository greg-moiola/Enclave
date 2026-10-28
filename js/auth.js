import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    browserLocalPersistence,
    browserSessionPersistence,
    setPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

const SESSION_AUTH_MARKER = "enclaveSessionAuthMarker";


function generateEnclaveId() {

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const firstLetter =
        letters[Math.floor(Math.random() * letters.length)];

    const secondLetter =
        letters[Math.floor(Math.random() * letters.length)];

    const numbers =
        Math.floor(1000 + Math.random() * 9000);

    return `${firstLetter}${secondLetter}-${numbers}`;
}

async function generateUniqueEnclaveId() {

    while (true) {

        const enclaveId =
            generateEnclaveId();

        const idDocument =
            await getDoc(
                doc(db, "enclaveIds", enclaveId)
            );

        if (!idDocument.exists()) {

            return enclaveId;

        }
    }
}


// =========================
// REGISTRAZIONE
// =========================

export async function registerUser(email, password, nickname) {

    try {

        const rememberConnected = localStorage.getItem("enclaveRememberConnected") === "true";
        await setPersistence(
            auth,
            rememberConnected ? browserLocalPersistence : browserSessionPersistence
        );

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;
        // Segna una sessione avviata esplicitamente in questa scheda. Serve a distinguere
        // una vecchia sessione persistente da una sessione corrente quando "Rimani connesso" è OFF.
        sessionStorage.setItem(SESSION_AUTH_MARKER, "true");

const enclaveId =
    await generateUniqueEnclaveId();

        await setDoc(
    doc(db, "enclaveIds", enclaveId),
    {
        uid: user.uid
    }
);

await setDoc(
    doc(db, "publicUsers", user.uid),
    {
        nickname: nickname,
        enclaveId: enclaveId,
        createdAt: serverTimestamp()
    }
);

await setDoc(
    doc(db, "users", user.uid),
    {
        nickname: nickname,
        enclaveId: enclaveId,
        email: user.email,
        createdAt: serverTimestamp()
    }
);


        await sendEmailVerification(
            userCredential.user
        );


        console.log(
            "Account creato. Email di verifica inviata:",
            userCredential.user.email
        );


        return {
            success: true,
            user: userCredential.user
        };


    } catch (error) {

        console.error(
            "Errore registrazione:",
            error
        );


        return {
            success: false,
            error: error
        };

    }

}


// =========================
// LOGIN
// =========================

export async function loginUser(email, password) {

    try {

        const rememberConnected = localStorage.getItem("enclaveRememberConnected") === "true";
        await setPersistence(
            auth,
            rememberConnected ? browserLocalPersistence : browserSessionPersistence
        );

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;

        sessionStorage.setItem(SESSION_AUTH_MARKER, "true");

        // Controlla se l'email è verificata

        if (!user.emailVerified) {

            return {
                success: false,
                emailNotVerified: true,
                user: user
            };

        }


        console.log(
            "Accesso effettuato:",
            user.email
        );


        return {
            success: true,
            user: user
        };


    } catch (error) {

        console.error(
            "Errore login:",
            error
        );


        return {
            success: false,
            error: error
        };

    }

}
