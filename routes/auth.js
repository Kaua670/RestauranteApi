
import { Router } from "express";
import { auth } from "../config/firebase.js";

const router = Router();


import dotenv from "dotenv";

dotenv.config();

router.post("/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (
            typeof email !== "string" ||
            typeof senha !== "string" ||
            !email.trim() ||
            !senha
        ) {
            return res.status(400).json({
                erro: "Informe o e-mail e a senha."
            });
        }

        const apiKey = process.env.FIREBASE_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                erro: "A chave da API do Firebase não foi configurada."
            });
        }

        const resposta = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email.trim(),
                    password: senha,
                    returnSecureToken: true
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            return res.status(401).json({
                erro: "Não foi possível entrar. Confira o e-mail e a senha."
            });
        }

        return res.json({
            mensagem: "Login realizado com sucesso!",
            token: dados.idToken,
            uid: dados.localId,
            email: dados.email,
            expiraEm: dados.expiresIn
        });

    } catch (erro) {
        console.error("Erro no login:", erro.message);

        return res.status(500).json({
            erro: "Erro interno ao realizar login."
        });
    }
});


// Verificar o token de acesso do funcionário
router.post("/verificar", async (req, res) => {
    try {
        const { token } = req.body;

        if (typeof token !== "string" || !token.trim()) {
            return res.status(400).json({
                erro: "Informe o token de autenticação."
            });
        }

        const funcionario = await auth.verifyIdToken(token);

        return res.json({
            mensagem: "Token válido!",
            uid: funcionario.uid,
            email: funcionario.email || null
        });
    } catch (erro) {
        console.error("Erro ao verificar token:", erro.message);

        return res.status(401).json({
            erro: "Token inválido ou expirado."
        });
    }
});

export default router;
