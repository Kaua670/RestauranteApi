
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
    initializeApp,
    getApps,
    applicationDefault
} from "firebase-admin/app";

import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
    path: resolve(__dirname, "../.env")
});

const projectId = process.env.FIREBASE_PROJECT_ID?.trim();

if (!projectId) {
    throw new Error(
        "FIREBASE_PROJECT_ID não encontrado no arquivo .env"
    );
}

const aplicativos = getApps();

const app = aplicativos.length > 0
    ? aplicativos[0]
    : initializeApp({
        credential: applicationDefault(),
        projectId: projectId
    });

export const db = getFirestore(app);
export const auth = getAuth(app);
