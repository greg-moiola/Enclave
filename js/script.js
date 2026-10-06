import {
    registerUser
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
