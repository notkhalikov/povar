"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
exports.default = (0, fastify_plugin_1.default)(async (app) => {
    await app.register(jwt_1.default, {
        secret: process.env.JWT_SECRET,
    });
    app.decorate('authenticate', async (req, reply) => {
        await req.jwtVerify();
    });
});
