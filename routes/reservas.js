
import { Router } from "express";
import { db } from "../config/firebase.js";
import { autenticar } from "../middlewares/autenticar.js";

const router = Router();
const reservas = db.collection("reservas");
const mesas = db.collection("mesas");

// LISTAR RESERVAS
router.get("/", async (req, res) => {
    try {
        const snapshot = await reservas.get();

        const lista = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return res.json(lista);
    } catch (erro) {
        console.error("Erro ao listar reservas:", erro);
        return res.status(500).json({
            erro: "Não foi possível listar as reservas."
        });
    }
});

// CADASTRAR RESERVA
router.post("/", async (req, res) => {
    try {
        const {
            nomeCliente,
            mesaId,
            data,
            hora,
            pessoas
        } = req.body;

        // Validar os dados
        if (
            typeof nomeCliente !== "string" ||
            !nomeCliente.trim() ||
            typeof mesaId !== "string" ||
            !mesaId.trim() ||
            typeof data !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
            typeof hora !== "string" ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ||
            !Number.isInteger(pessoas) ||
            pessoas < 1
        ) {
            return res.status(400).json({
                erro: "Informe nome, mesa, data, horário e quantidade de pessoas válidos."
            });
        }

        // Validar a data do calendário
        const dataValidada = new Date(`${data}T12:00:00Z`);

        if (
            Number.isNaN(dataValidada.getTime()) ||
            dataValidada.toISOString().slice(0, 10) !== data
        ) {
            return res.status(400).json({
                erro: "A data informada não existe."
            });
        }

        const hoje = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo"
});

if (data < hoje) {
    return res.status(400).json({
        erro: "Não é possível cadastrar reservas para datas passadas."
    });
}

        // Verificar se a mesa existe
        const mesaRef = mesas.doc(mesaId.trim());
        const mesaDoc = await mesaRef.get();

        if (!mesaDoc.exists) {
            return res.status(404).json({
                erro: "Mesa não encontrada."
            });
        }

        const mesa = mesaDoc.data();

        if (
            !Number.isInteger(mesa.capacidade) ||
            pessoas > mesa.capacidade
        ) {
            return res.status(400).json({
                erro: "A quantidade de pessoas ultrapassa a capacidade da mesa."
            });
        }

        // Verificar reserva ativa no mesmo horário
        const snapshot = await reservas
            .where("mesaId", "==", mesaId.trim())
            .get();

        const conflito = snapshot.docs.some(doc => {
            const reserva = doc.data();

            return reserva.data === data &&
                reserva.hora === hora &&
                reserva.status !== "cancelada";
        });

        if (conflito) {
            return res.status(409).json({
                erro: "Essa mesa já possui uma reserva nesse horário."
            });
        }

        // Salvar reserva
        const novaReserva = {
            nomeCliente: nomeCliente.trim(),
            mesaId: mesaId.trim(),
            data,
            hora,
            pessoas,
            status: "confirmada",
            funcionarioUid: req.usuario.uid,
            funcionarioNome: req.usuario.nome,
            criadaEm: new Date().toISOString()
        };

        const referencia = await reservas.add(novaReserva);

        return res.status(201).json({
            mensagem: "Reserva cadastrada com sucesso!",
            id: referencia.id,
            ...novaReserva
        });
    } catch (erro) {
        console.error("Erro ao cadastrar reserva:", erro);
        return res.status(500).json({
            erro: "Não foi possível cadastrar a reserva."
        });
    }
});

// CANCELAR RESERVA
router.put("/:id/cancelar", async (req, res) => {
    try {
        const { id } = req.params;
        const referencia = reservas.doc(id);
        const documento = await referencia.get();

        if (!documento.exists) {
            return res.status(404).json({
                erro: "Reserva não encontrada."
            });
        }

        if (documento.data().status === "cancelada") {
            return res.status(409).json({
                erro: "Essa reserva já foi cancelada."
            });
        }

        await referencia.update({
            status: "cancelada",
            canceladaEm: new Date().toISOString(),
            canceladaPor: req.usuario.uid,
            
        });

        return res.json({
            mensagem: "Reserva cancelada com sucesso!",
            id
        });
    } catch (erro) {
        console.error("Erro ao cancelar reserva:", erro);
        return res.status(500).json({
            erro: "Não foi possível cancelar a reserva."
        });
    }
});


// ALTERAR RESERVA
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nomeCliente, mesaId, data, hora, pessoas } = req.body;

        if (!nomeCliente || !mesaId || !data || !hora ||
            !Number.isInteger(pessoas) || pessoas < 1) {
            return res.status(400).json({
                erro: "Preencha todos os campos corretamente."
            });
        }

        const dataValida = new Date(`${data}T12:00:00Z`);

        if (Number.isNaN(dataValida.getTime()) ||
            dataValida.toISOString().slice(0, 10) !== data) {
            return res.status(400).json({ erro: "Data inválida." });
        }

        const hoje = new Date().toLocaleDateString("en-CA", {
            timeZone: "America/Sao_Paulo"
        });

        if (data < hoje) {
            return res.status(400).json({
                erro: "Não é possível cadastrar reservas para datas passadas."
            });
        }

        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
            return res.status(400).json({ erro: "Horário inválido." });
        }

        const referencia = reservas.doc(id);
        const documento = await referencia.get();

        if (!documento.exists) {
            return res.status(404).json({ erro: "Reserva não encontrada." });
        }

        if (documento.data().status === "cancelada") {
            return res.status(409).json({
                erro: "Não é possível alterar uma reserva cancelada."
            });
        }

        const mesaDoc = await mesas.doc(mesaId).get();

        if (!mesaDoc.exists) {
            return res.status(404).json({ erro: "Mesa não encontrada." });
        }

        if (pessoas > mesaDoc.data().capacidade) {
            return res.status(400).json({
                erro: "A quantidade de pessoas excede a capacidade da mesa."
            });
        }

        const conflito = await reservas
            .where("mesaId", "==", mesaId)
            .where("data", "==", data)
            .where("hora", "==", hora)
            .get();

        const reservaDuplicada = conflito.docs.some(doc =>
            doc.id !== id && doc.data().status !== "cancelada"
        );

        if (reservaDuplicada) {
            return res.status(409).json({
                erro: "Essa mesa já possui uma reserva nesse horário."
            });
        }

        await referencia.update({
            nomeCliente,
            mesaId,
            data,
            hora,
            pessoas,
            atualizadoEm: new Date().toISOString()
        });

        return res.json({
            mensagem: "Reserva alterada com sucesso!",
            id,
            nomeCliente,
            mesaId,
            data,
            hora,
            pessoas
        });

    } catch (erro) {
        console.error("Erro ao alterar reserva:", erro);
        return res.status(500).json({
            erro: "Não foi possível alterar a reserva."
        });
    }
});

export default router;
