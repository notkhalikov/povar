"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const cors_1 = __importDefault(require("@fastify/cors"));
// Default whitelist — covers production Vercel deployments and local dev.
// Override in any environment via ALLOWED_ORIGINS (comma-separated).
const DEFAULT_ORIGINS = [
    'https://povar-one.vercel.app',
    'https://povar-notkhalikovs-projects.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
];
exports.default = (0, fastify_plugin_1.default)(async (app) => {
    const origin = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
        : DEFAULT_ORIGINS;
    await app.register(cors_1.default, { origin });
});
