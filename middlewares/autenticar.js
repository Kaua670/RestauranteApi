import { auth, db } from "../config/firebase.js";

export async function autenticar(req, res, next) {
    try {
        const cabecalho = req.headers.authorization;

        if (!cabecalho || !cabecalho.startsWith("Bearer ")) {
            return res.status(401).json({
                erro: "Token de autenticação não informado."
            });
        }

        const token = cabecalho.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                erro: "Token de autenticação não informado."
            });
        }

        // Verificar token do Firebase
        const usuario = await auth.verifyIdToken(token);

        // Buscar funcionário no Firestore
        const funcionarioDoc = await db
            .collection("funcionarios")
            .doc(usuario.uid)
            .get();

        if (!funcionarioDoc.exists) {
            return res.status(403).json({
                erro: "Funcionário não cadastrado no sistema."
            });
        }

        const funcionario = funcionarioDoc.data();

        if (funcionario.ativo !== true) {
            return res.status(403).json({
                erro: "Funcionário inativo. Acesso negado."
            });
        }

        if (!["admin", "funcionario"].includes(funcionario.cargo)) {
            return res.status(403).json({
                erro: "Cargo não autorizado."
            });
        }

        // Disponibilizar dados para as rotas
        req.usuario = {
            uid: usuario.uid,
            email: usuario.email || null,
            nome: funcionario.nome || null,
            cargo: funcionario.cargo
        };

        next();

    } catch (erro) {
        console.error("Erro na autenticação:", erro);

        return res.status(401).json({
            erro: "Token inválido ou expirado."
        });
    }
}