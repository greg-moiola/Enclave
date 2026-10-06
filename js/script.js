import {
    registerUser,
    loginUser
} from "./auth.js";

import {
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


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

const resendVerificationButton =
    document.getElementById("resendVerificationButton");


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
            await registerUser(email, password);


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

    document.getElementById("userEmail").textContent =
        result.user.email;

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
