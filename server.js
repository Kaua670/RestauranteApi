
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import produtosRouter from "./routes/produtos.js";
import mesasRouter from "./routes/mesas.js";
import pedidosRouter from "./routes/pedidos.js";
import reservasRouter from "./routes/reservas.js";
import contasRouter from "./routes/contas.js";
import pagamentosRouter from "./routes/pagamentos.js";
import authRouter from "./routes/auth.js";
import { autenticar } from "./middlewares/autenticar.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: "http://localhost:8080"
}));

app.use(express.json());
app.use("/api/mesas", autenticar, mesasRouter);
app.use("/api/pedidos", autenticar, pedidosRouter);
app.use("/api/reservas", autenticar, reservasRouter);
app.use("/api/contas", autenticar, contasRouter);
app.use("/api/pagamentos", autenticar, pagamentosRouter);
app.use("/api/auth", authRouter);
app.use("/api/produtos", autenticar, produtosRouter);

// Rota inicial para testar a API
app.get("/", (req, res) => {
    res.json({
        sistema: "Sistema de Gestão de Restaurante",
        status: "online",
        mensagem: "API funcionando corretamente!"
    });
});

// Rota de teste de saúde da API
app.get("/api/status", (req, res) => {
    res.json({
        status: "ok",
        servico: "api-restaurante"
    });
});

// TRATAMENTO GLOBAL DE ERROS
app.use((erro, req, res, next) => {
    console.error("Erro interno:", erro);

    return res.status(500).json({
        erro: "Erro interno no servidor."
    });
});

app.listen(PORT, () => {
    console.log("--------------------------------");
    console.log(" SISTEMA DE GESTÃO DE RESTAURANTE");
    console.log("--------------------------------");
    console.log(`API disponível em http://localhost:${PORT}`);
});
