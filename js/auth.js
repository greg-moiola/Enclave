import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import { auth } from "./firebase.js";


// REGISTRAZIONE

export async function registerUser(email, password) {

    try {

        const userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        console.log("Account creato:", userCredential.user.email);

        return {
            success: true,
            user: userCredential.user
        };

    } catch (error) {

        console.error("Errore registrazione:", error);

        return {
            success: false,
            error: error
        };
    }
}


// LOGIN

export async function loginUser(email, password) {

    try {

        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        console.log("Accesso effettuato:", userCredential.user.email);

        return {
            success: true,
            user: userCredential.user
        };

    } catch (error) {

        console.error("Errore login:", error);

        return {
            success: false,
            error: error
        };
    }
}
