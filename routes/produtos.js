
import { Router } from "express";
import { db } from "../config/firebase.js";
import { somenteAdmin } from "../middlewares/somenteAdmin.js";

const router = Router();
const colecao = db.collection("produtos");

// Listar produtos do cardápio
router.get("/", async (req, res) => {
    try {
        const snapshot = await colecao.get();

        const produtos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json(produtos);
    } catch (erro) {
        console.error("Erro ao listar produtos:", erro);
        res.status(500).json({
            erro: "Não foi possível consultar os produtos."
        });
    }
});

// Cadastrar um produto
router.post("/", somenteAdmin, async (req, res) => {
    try {
        const {
            nome,
            descricao,
            categoria,
            preco,
            imagem = "",
            disponivel = true
        } = req.body;

        if (
            typeof nome !== "string" || !nome.trim() ||
            typeof descricao !== "string" ||
            typeof categoria !== "string" || !categoria.trim() ||
            typeof preco !== "number" ||
            !Number.isFinite(preco) || preco < 0 ||
            typeof imagem !== "string" ||
            typeof disponivel !== "boolean"
        ) {
            return res.status(400).json({
                erro: "Confira nome, descrição, categoria, preço, imagem e disponibilidade."
            });
        }

        const produto = {
            nome: nome.trim(),
            descricao: descricao.trim(),
            categoria: categoria.trim(),
            preco,
            imagem: imagem.trim(),
            disponivel,
            criadoEm: new Date().toISOString()
        };

        const referencia = await colecao.add(produto);

        res.status(201).json({
            mensagem: "Produto cadastrado com sucesso!",
            id: referencia.id,
            ...produto
        });
    } catch (erro) {
        console.error("Erro ao cadastrar produto:", erro);
        res.status(500).json({
            erro: "Não foi possível cadastrar o produto."
        });
    }
});



/* EDITAR PRODUTO */
router.put("/:id", somenteAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nome,
            descricao,
            categoria,
            preco,
            imagem = "",
            disponivel = true
        } = req.body;

        if (
            typeof nome !== "string" || !nome.trim() ||
            typeof descricao !== "string" ||
            typeof categoria !== "string" || !categoria.trim() ||
            typeof preco !== "number" ||
            !Number.isFinite(preco) || preco < 0 ||
            typeof imagem !== "string" ||
            typeof disponivel !== "boolean"
        ) {
            return res.status(400).json({
                erro: "Confira os dados enviados do produto."
            });
        }

        const referencia = colecao.doc(id);
        const documento = await referencia.get();

        if (!documento.exists) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        const produtoAtualizado = {
            nome: nome.trim(),
            descricao: descricao.trim(),
            categoria: categoria.trim(),
            preco,
            imagem: imagem.trim(),
            disponivel,
            atualizadoEm: new Date().toISOString()
        };

        await referencia.update(produtoAtualizado);

        return res.json({
            mensagem: "Produto atualizado com sucesso!",
            id,
            ...produtoAtualizado
        });
    } catch (erro) {
        console.error("Erro ao editar produto:", erro);
        return res.status(500).json({
            erro: "Não foi possível editar o produto."
        });
    }
});

/* EXCLUIR PRODUTO */
router.delete("/:id", somenteAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const referencia = colecao.doc(id);
        const documento = await referencia.get();

        if (!documento.exists) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        await referencia.delete();

        return res.json({
            mensagem: "Produto excluído com sucesso!",
            id
        });
    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);
        return res.status(500).json({
            erro: "Não foi possível excluir o produto."
        });
    }
});

export default router;