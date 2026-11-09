
import { Router } from "express";
import { db } from "../config/firebase.js";
import { somenteAdmin } from "../middlewares/somenteAdmin.js";

const router = Router();

const contas = db.collection("contas");
const pedidos = db.collection("pedidos");

// LISTAR CONTAS
router.get("/", async (req, res) => {
    try {
        const snapshot = await contas.get();

        const lista = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return res.json(lista);
    } catch (erro) {
        console.error("Erro ao listar contas:", erro);
        return res.status(500).json({
            erro: "Não foi possível listar as contas."
        });
    }
});

// ABRIR CONTA PARA UM PEDIDO
router.post("/", somenteAdmin, async (req, res) => {
    try {
        const { pedidoId } = req.body;

        if (
            typeof pedidoId !== "string" ||
            !pedidoId.trim()
        ) {
            return res.status(400).json({
                erro: "Informe o ID do pedido."
            });
        }

        // Verificar se o pedido existe
        const pedidoRef = pedidos.doc(pedidoId.trim());
        const pedidoDoc = await pedidoRef.get();

        if (!pedidoDoc.exists) {
            return res.status(404).json({
                erro: "Pedido não encontrado."
            });
        }

        const pedido = pedidoDoc.data();

        if (pedido.status === "cancelado") {
            return res.status(409).json({
                erro: "Não é possível abrir uma conta para um pedido cancelado."
            });
        }

        if (
            typeof pedido.total !== "number" ||
            !Number.isFinite(pedido.total) ||
            pedido.total < 0
        ) {
            return res.status(400).json({
                erro: "O pedido possui um valor total inválido."
            });
        }

        // Impedir a criação de mais de uma conta para o mesmo pedido
        const contaExistente = await contas
            .where("pedidoId", "==", pedidoId.trim())
            .limit(1)
            .get();

        if (!contaExistente.empty) {
            return res.status(409).json({
                erro: "Já existe uma conta para esse pedido.",
                contaId: contaExistente.docs[0].id
            });
        }

        const valorTotal = Math.round(pedido.total * 100) / 100;

        const novaConta = {
    pedidoId: pedidoId.trim(),
    valorTotal,
    valorPago: 0,
    saldo: valorTotal,
    status: "aberta",
    funcionarioUid: req.usuario.uid,
    funcionarioNome: req.usuario.nome,
    criadaEm: new Date().toISOString()
};

        const referencia = await contas.add(novaConta);

        return res.status(201).json({
            mensagem: "Conta aberta com sucesso!",
            id: referencia.id,
            ...novaConta
        });
    } catch (erro) {
        console.error("Erro ao abrir conta:", erro);
        return res.status(500).json({
            erro: "Não foi possível abrir a conta."
        });
    }
});

export default router;
