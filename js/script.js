import {
    registerUser,
    loginUser
} from "./auth.js";


console.log("Enclave avviato correttamente.");


// REGISTRAZIONE

document
    .getElementById("registerButton")
    .addEventListener("click", async () => {

        const email =
            document.getElementById("registerEmail").value;

        const password =
            document.getElementById("registerPassword").value;

        const nickname =
            document.getElementById("registerNickname").value;

        const message =
            document.getElementById("message");


        if (!email || !password || !nickname) {

            message.textContent =
                "Compila tutti i campi.";

            return;
        }


        const result =
            await registerUser(email, password);


        if (result.success) {

            message.textContent =
                "Account creato correttamente!";

            console.log(
                "Utente registrato:",
                result.user
            );

        } else {

            message.textContent =
                "Errore: " + result.error.message;
        }

    });


// LOGIN

document
    .getElementById("loginButton")
    .addEventListener("click", async () => {

        const email =
            document.getElementById("loginEmail").value;

        const password =
            document.getElementById("loginPassword").value;

        const message =
            document.getElementById("message");


        if (!email || !password) {

            message.textContent =
                "Inserisci email e password.";

            return;
        }


        const result =
            await loginUser(email, password);


        if (result.success) {

            message.textContent =
                "Accesso effettuato!";

            console.log(
                "Utente loggato:",
                result.user
            );

        } else {

            message.textContent =
                "Errore: " + result.error.message;
        }

    });
