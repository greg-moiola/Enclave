import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";


// =========================
// REGISTRAZIONE
// =========================

export async function registerUser(email, password) {

    try {

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
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

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;


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
