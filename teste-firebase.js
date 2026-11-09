
import "dotenv/config";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
});

const db = getFirestore();

try {
    await db.collection("testes").doc("conexao").set({
        mensagem: "Conexão com o Firebase funcionando!",
        data: new Date().toISOString()
    });

    console.log("Conexão com o Firestore realizada!");
    console.log("Documento de teste gravado com sucesso.");
} catch (erro) {
    console.error("Erro ao conectar com o Firebase:");
    console.error(erro.message);
    process.exitCode = 1;
}
