
import { Router } from "express";
import { db } from "../config/firebase.js";
import { somenteAdmin } from "../middlewares/somenteAdmin.js";

const router = Router();
const colecao = db.collection("mesas");

// LISTAR MESAS
router.get("/", async (req, res) => {
    try {
        const snapshot = await colecao.get();

        const mesas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json(mesas);
    } catch (erro) {
        console.error("Erro ao listar mesas:", erro);
        res.status(500).json({
            erro: "Não foi possível listar as mesas."
        });
    }
});

// CADASTRAR MESA
router.post("/", somenteAdmin, async (req, res) => {
    try {
        const { numero, capacidade } = req.body;

        if (
            !Number.isInteger(numero) || numero < 1 ||
            !Number.isInteger(capacidade) || capacidade < 1
        ) {
            return res.status(400).json({
                erro: "Informe um número de mesa e uma capacidade válidos."
            });
        }

        const existentes = await colecao
            .where("numero", "==", numero)
            .limit(1)
            .get();

        if (!existentes.empty) {
            return res.status(409).json({
                erro: "Já existe uma mesa com esse número."
            });
        }

        const mesa = {
            numero,
            capacidade,
            status: "livre",
            criadaEm: new Date().toISOString()
        };

        const referencia = await colecao.add(mesa);

        res.status(201).json({
            mensagem: "Mesa cadastrada com sucesso!",
            id: referencia.id,
            ...mesa
        });
    } catch (erro) {
        console.error("Erro ao cadastrar mesa:", erro);
        res.status(500).json({
            erro: "Não foi possível cadastrar a mesa."
        });
    }
});


/* ALTERAR STATUS DA MESA */
router.put("/:id/status", somenteAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const statusPermitidos = [
            "livre",
            "ocupada",
            "reservada",
            "em_atendimento"
        ];

        if (!statusPermitidos.includes(status)) {
            return res.status(400).json({
                erro: "Status inválido.",
                statusPermitidos
            });
        }

        const referencia = colecao.doc(id);
        const documento = await referencia.get();

        if (!documento.exists) {
            return res.status(404).json({
                erro: "Mesa não encontrada."
            });
        }

        await referencia.update({
            status,
            atualizadoEm: new Date().toISOString()
        });

        return res.json({
            mensagem: "Status da mesa atualizado com sucesso!",
            id,
            status
        });
    } catch (erro) {
        console.error("Erro ao atualizar mesa:", erro);
        return res.status(500).json({
            erro: "Não foi possível atualizar o status da mesa."
        });
    }
});


export default router;
