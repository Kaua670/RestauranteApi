export function somenteAdmin(req, res, next) {
    if (!req.usuario) {
        return res.status(401).json({
            erro: "É necessário fazer login."
        });
    }

    if (req.usuario.cargo !== "admin") {
        return res.status(403).json({
            erro: "Acesso permitido somente para administradores."
        });
    }

    next();
}

export function somenteAdminAoCancelar(req, res, next) {
    if (req.body?.status === "cancelado") {
        return somenteAdmin(req, res, next);
    }

    next();
}