
import { Router } from "express";
import { db } from "../config/firebase.js";
import { somenteAdminAoCancelar } from "../middlewares/somenteAdmin.js";

const router = Router();

const pedidos = db.collection("pedidos");
const produtos = db.collection("produtos");
const mesas = db.collection("mesas");

// LISTAR PEDIDOS
router.get("/", async (req, res) => {
    try {
        const snapshot = await pedidos.get();

        const lista = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return res.json(lista);
    } catch (erro) {
        console.error("Erro ao listar pedidos:", erro);
        return res.status(500).json({
            erro: "Não foi possível listar os pedidos."
        });
    }
});

// CADASTRAR PEDIDO
router.post("/", async (req, res) => {
    try {
        const {
            tipo,
            mesaId = null,
            itens
        } = req.body;

        // Validar tipo de pedido
        if (!["mesa", "balcao"].includes(tipo)) {
            return res.status(400).json({
                erro: "O tipo deve ser mesa ou balcao."
            });
        }

        // Validar mesa
        if (tipo === "mesa" && (
            typeof mesaId !== "string" || !mesaId.trim()
        )) {
            return res.status(400).json({
                erro: "Informe o ID da mesa."
            });
        }

        if (tipo === "balcao" && mesaId !== null) {
            return res.status(400).json({
                erro: "Pedidos de balcão não devem ter mesa vinculada."
            });
        }

        // Validar itens
        if (
            !Array.isArray(itens) ||
            itens.length === 0 ||
            !itens.every(item =>
                item &&
                typeof item.produtoId === "string" &&
                item.produtoId.trim() !== "" &&
                Number.isInteger(item.quantidade) &&
                item.quantidade > 0
            )
        ) {
            return res.status(400).json({
                erro: "Informe produtos e quantidades válidos."
            });
        }

        // Verificar se a mesa existe e pode receber pedidos
        let mesaRef = null;
        let mesaDoc = null;

        if (tipo === "mesa") {
            mesaRef = mesas.doc(mesaId.trim());
            mesaDoc = await mesaRef.get();

            if (!mesaDoc.exists) {
                return res.status(404).json({
                    erro: "Mesa não encontrada."
                });
            }

            if (
                !["livre", "ocupada"].includes(
                    mesaDoc.data().status
                )
            ) {
                return res.status(409).json({
                    erro: "A mesa não está disponível para pedidos."
                });
            }
        }

        // Buscar os preços reais no Firestore
        const itensCalculados = [];

        for (const item of itens) {
            const produtoDoc = await produtos
                .doc(item.produtoId.trim())
                .get();

            if (!produtoDoc.exists) {
                return res.status(404).json({
                    erro: `Produto não encontrado: ${item.produtoId}`
                });
            }

            const produto = produtoDoc.data();

            if (
                produto.disponivel !== true ||
                typeof produto.preco !== "number" ||
                !Number.isFinite(produto.preco) ||
                produto.preco < 0
            ) {
                return res.status(400).json({
                    erro: `O produto ${produto.nome ?? item.produtoId} está indisponível ou possui preço inválido.`
                });
            }

            itensCalculados.push({
                produtoId: item.produtoId.trim(),
                nome: produto.nome,
                precoUnitario: produto.preco,
                quantidade: item.quantidade,
                subtotal: Math.round(
                    produto.preco * item.quantidade * 100
                ) / 100
            });
        }

        // Calcular o total no backend
        const total = Math.round(
            itensCalculados.reduce(
                (soma, item) => soma + item.subtotal,
                0
            ) * 100
        ) / 100;

     const pedido = {
    tipo,
    mesaId: tipo === "mesa" ? mesaId.trim() : null,
    itens: itensCalculados,
    total,
    status: "aberto",

    funcionarioUid: req.usuario.uid,
    funcionarioNome: req.usuario.nome,

    criadoEm: new Date().toISOString()
};

        const referencia = pedidos.doc();

await db.runTransaction(async (transaction) => {

    if (mesaRef) {
        const mesaAtual = await transaction.get(mesaRef);

        if (!mesaAtual.exists) {
            throw new Error("Mesa não encontrada.");
        }

        if (!["livre", "ocupada"].includes(mesaAtual.data().status)) {
            throw new Error("A mesa não está disponível para pedidos.");
        }

        transaction.update(mesaRef, {
            status: "ocupada",
            atualizadoEm: new Date().toISOString()
        });
    }

    transaction.set(referencia, pedido);
});

        return res.status(201).json({
            mensagem: "Pedido cadastrado com sucesso!",
            id: referencia.id,
            ...pedido
        });
    } catch (erro) {
        console.error("Erro ao cadastrar pedido:", erro);
        return res.status(500).json({
            erro: "Não foi possível cadastrar o pedido."
        });
    }
});


/* ATUALIZAR STATUS DO PEDIDO */

router.put("/:id/status", somenteAdminAoCancelar, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const transicoes = {
            aberto: ["em_preparo", "cancelado"],
            em_preparo: ["pronto", "cancelado"],
            pronto: ["entregue", "cancelado"],
            entregue: [],
            cancelado: []
        };

        if (!Object.hasOwn(transicoes, status)) {
            return res.status(400).json({
                erro: "Status inválido."
            });
        }

        const resultado = await db.runTransaction(async (transaction) => {
            const referencia = pedidos.doc(id);
            const documento = await transaction.get(referencia);

            if (!documento.exists) {
                return {
                    erro: "Pedido não encontrado.",
                    codigo: 404
                };
            }

            const pedido = documento.data();
            const statusAtual = pedido.status;
            const cargo = req.usuario.cargo;

            if (!transicoes[statusAtual]) {
                return {
                    erro: "O pedido possui um status desconhecido.",
                    codigo: 409
                };
            }

            if (
                !transicoes[statusAtual].includes(status) ||
                (status === "cancelado" && cargo !== "admin")
            ) {
                return {
                    erro: "Você não tem permissão para realizar essa alteração.",
                    codigo: 403
                };
            }

            let mesaLiberada = false;
            let referenciaMesa = null;

            // Verificar liberação quando o pedido for cancelado
            if (status === "cancelado" && pedido.tipo === "mesa" && pedido.mesaId) {

                const outrosPedidosQuery = pedidos.where(
                    "mesaId",
                    "==",
                    pedido.mesaId
                );

                const outrosPedidosSnapshot = await transaction.get(
                    outrosPedidosQuery
                );

                const outrosPedidos = outrosPedidosSnapshot.docs.filter(doc =>
                    doc.id !== id && doc.data().status !== "cancelado"
                );

                let existePendencia = false;

                for (const outroPedido of outrosPedidos) {
                    const contaQuery = db.collection("contas").where(
                        "pedidoId",
                        "==",
                        outroPedido.id
                    );

                    const contasSnapshot = await transaction.get(contaQuery);

                    const contaFechada = contasSnapshot.docs.some(
                        doc => doc.data().status === "fechada"
                    );

                    if (!contaFechada) {
                        existePendencia = true;
                        break;
                    }
                }

                referenciaMesa = db.collection("mesas").doc(pedido.mesaId);

                const mesaDocumento = await transaction.get(referenciaMesa);

                if (!existePendencia && mesaDocumento.exists) {
                    mesaLiberada = true;
                }
            }

            // Atualizar o pedido
            transaction.update(referencia, {
                status,
                atualizadoEm: new Date().toISOString()
            });

            // Liberar a mesa somente se não houver pendências
            if (mesaLiberada) {
                transaction.update(referenciaMesa, {
                    status: "livre",
                    atualizadoEm: new Date().toISOString()
                });
            }

            return {
                mensagem: "Status atualizado com sucesso!",
                id,
                status,
                mesaLiberada
            };
        });

        if (resultado.erro) {
            return res.status(resultado.codigo).json({
                erro: resultado.erro
            });
        }

        return res.json(resultado);

    } catch (erro) {
        console.error("Erro ao atualizar status:", erro);

        return res.status(500).json({
            erro: "Não foi possível atualizar o status do pedido."
        });
    }
});


export default router;
