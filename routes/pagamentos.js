
import { Router } from "express";
import { db } from "../config/firebase.js";
import { somenteAdmin } from "../middlewares/somenteAdmin.js";

const router = Router();

const contas = db.collection("contas");
const pagamentos = db.collection("pagamentos");
const pedidos = db.collection("pedidos");
const mesas = db.collection("mesas");

// LISTAR PAGAMENTOS
router.get("/", async (req, res) => {
    try {
        const snapshot = await pagamentos.get();

        return res.json(
            snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
        );
    } catch (erro) {
        console.error("Erro ao listar pagamentos:", erro);
        return res.status(500).json({
            erro: "Não foi possível listar os pagamentos."
        });
    }
});

// REGISTRAR PAGAMENTO
router.post("/", async (req, res) => {
    try {
        const { contaId, valor, metodo } = req.body;

        if (!req.usuario?.nome) {
    return res.status(409).json({
        erro: "Nome do funcionário não encontrado no cadastro."
    });
}

        const metodosPermitidos = [
            "dinheiro",
            "pix",
            "cartao_credito",
            "cartao_debito"
        ];

        if (
            typeof contaId !== "string" ||
            Math.abs(valor * 100 - Math.round(valor * 100)) > 0.0000001 ||
            !contaId.trim() ||
            typeof valor !== "number" ||
            !Number.isFinite(valor) ||
            valor <= 0 ||
            !Number.isSafeInteger(Math.round(valor * 100)) ||
            !metodosPermitidos.includes(metodo)
        ) {
            return res.status(400).json({
                erro: "Informe uma conta, um valor positivo válido e um método de pagamento permitido."
            });
        }

        const contaRef = contas.doc(contaId.trim());
        const pedidoRef = null;
        const pagamentoRef = pagamentos.doc();

        const resultado = await db.runTransaction(async transacao => {
            const contaDoc = await transacao.get(contaRef);

            if (!contaDoc.exists) {
                const erro = new Error("Conta não encontrada.");
                erro.status = 404;
                throw erro;
            }

            const conta = contaDoc.data();

            if (conta.status !== "aberta") {
                const erro = new Error("A conta não está aberta.");
                erro.status = 409;
                throw erro;
            }

            if (
    typeof conta.valorTotal !== "number" ||
    !Number.isFinite(conta.valorTotal) ||
    typeof conta.valorPago !== "number" ||
    !Number.isFinite(conta.valorPago)
) {
    const erro = new Error("Os valores registrados na conta são inválidos.");
    erro.status = 409;
    throw erro;
}

const valorTotalCentavos = Math.round(conta.valorTotal * 100);
const valorPagoCentavos = Math.round(conta.valorPago * 100);
const valorCentavos = Math.round(valor * 100);
const saldoCentavos = valorTotalCentavos - valorPagoCentavos;
            if (
                !Number.isSafeInteger(valorTotalCentavos) ||
                !Number.isSafeInteger(valorPagoCentavos) ||
                valorTotalCentavos < 0 ||
                valorPagoCentavos < 0 ||
                valorPagoCentavos > valorTotalCentavos
            ) {
                const erro = new Error("Os valores registrados na conta são inválidos.");
                erro.status = 409;
                throw erro;
            }

            if (valorCentavos > saldoCentavos) {
                const erro = new Error("O pagamento ultrapassa o saldo restante.");
                erro.status = 400;
                throw erro;
            }

            const novoValorPagoCentavos = valorPagoCentavos + valorCentavos;
            const novoSaldoCentavos = valorTotalCentavos - novoValorPagoCentavos;

            const novoValorPago = novoValorPagoCentavos / 100;
            const novoSaldo = novoSaldoCentavos / 100;
            const quitada = novoSaldoCentavos === 0;

            const pagamento = {
    contaId: contaRef.id,
    valor: valorCentavos / 100,
    metodo,
    status: "confirmado",
    funcionarioUid: req.usuario.uid,
    funcionarioNome: req.usuario.nome,
    criadoEm: new Date().toISOString()
};

            transacao.set(pagamentoRef, pagamento);

            transacao.update(contaRef, {
                valorPago: novoValorPago,
                saldo: novoSaldo,
                status: quitada ? "paga" : "aberta",
                atualizadoEm: new Date().toISOString()
            });

            return {
                pagamento,
                valorPago: novoValorPago,
                saldo: novoSaldo,
                statusConta: quitada ? "paga" : "aberta"
            };
        });

        return res.status(201).json({
            mensagem: "Pagamento registrado com sucesso!",
            pagamentoId: pagamentoRef.id,
            ...resultado
        });
    } catch (erro) {
        console.error("Erro ao registrar pagamento:", erro);
        return res.status(erro.status || 500).json({
            erro: erro.message || "Não foi possível registrar o pagamento."
        });
    }
});

// FECHAR CONTA
router.put("/conta/:id/fechar", somenteAdmin, async (req, res) => {
    try {
    const contaRef = contas.doc(req.params.id);

    const resultado = await db.runTransaction(async transacao => {
        const contaDoc = await transacao.get(contaRef);

        if (!contaDoc.exists) {
            const erro = new Error("Conta não encontrada.");
            erro.status = 404;
            throw erro;
        }

        const conta = contaDoc.data();

        if (conta.status === "fechada") {
            const erro = new Error("Essa conta já foi fechada.");
            erro.status = 409;
            throw erro;
        }

        const totalCentavos = Math.round(conta.valorTotal * 100);
        const pagoCentavos = Math.round(conta.valorPago * 100);

        if (
            !Number.isSafeInteger(totalCentavos) ||
            !Number.isSafeInteger(pagoCentavos) ||
            totalCentavos < 0 ||
            pagoCentavos < 0 ||
            pagoCentavos !== totalCentavos ||
            conta.status !== "paga" ||
            conta.saldo !== 0
        ) {
            const erro = new Error(
                "A conta precisa estar totalmente paga para ser fechada."
            );
            erro.status = 409;
            throw erro;
        }

        // Localizar o pedido vinculado à conta
        if (!conta.pedidoId || typeof conta.pedidoId !== "string") {
            const erro = new Error("ID do pedido não encontrado na conta.");
            erro.status = 409;
            throw erro;
        }

        const pedidoRef = pedidos.doc(conta.pedidoId);
        const pedidoDoc = await transacao.get(pedidoRef);

        if (!pedidoDoc.exists) {
            const erro = new Error("Pedido vinculado à conta não encontrado.");
            erro.status = 409;
            throw erro;
        }

        const pedido = pedidoDoc.data();

        let mesaRef = null;
        let mesaLiberada = false;

        // Se o pedido pertence a uma mesa, verificar outros pedidos
        if (pedido.tipo === "mesa" && pedido.mesaId) {
            const outrosPedidosQuery = pedidos.where(
                "mesaId",
                "==",
                pedido.mesaId
            );

            const outrosPedidosSnapshot = await transacao.get(
                outrosPedidosQuery
            );

            const outrosPedidos = outrosPedidosSnapshot.docs.filter(doc =>
                doc.id !== pedidoRef.id &&
                doc.data().status !== "cancelado"
            );

            // Verificar se os outros pedidos possuem contas fechadas
            const outrasContas = await Promise.all(
                outrosPedidos.map(outro =>
                    transacao.get(
                        contas.where("pedidoId", "==", outro.id).limit(1)
                    )
                )
            );

            const existePedidoPendente = outrasContas.some(snapshot =>
                snapshot.empty ||
                snapshot.docs[0].data().status !== "fechada"
            );

            mesaRef = mesas.doc(pedido.mesaId);
            const mesaDoc = await transacao.get(mesaRef);

            if (!mesaDoc.exists) {
                const erro = new Error("Mesa vinculada ao pedido não encontrada.");
                erro.status = 409;
                throw erro;
            }

            mesaLiberada = !existePedidoPendente;
        }

        // Todas as leituras foram feitas. Agora podemos escrever.
        transacao.update(contaRef, {
            status: "fechada",
            fechadaEm: new Date().toISOString(),
            fechadaPor: req.usuario.uid
        });

        if (mesaRef && mesaLiberada) {
            transacao.update(mesaRef, {
                status: "livre",
                atualizadoEm: new Date().toISOString()
            });
        }

        return { mesaLiberada };
    });

    return res.json({
        mensagem: "Conta fechada com sucesso!",
        id: contaRef.id,
        mesaLiberada: resultado.mesaLiberada
    });

} catch (erro) {
    console.error("Erro ao fechar conta:", erro);

    return res.status(erro.status || 500).json({
        erro: erro.message || "Não foi possível fechar a conta."
    });
}
});

export default router;
