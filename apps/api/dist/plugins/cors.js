"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const cors_1 = __importDefault(require("@fastify/cors"));
const PROD_ORIGINS = ['https://povar-one.vercel.app'];
exports.default = (0, fastify_plugin_1.default)(async (app) => {
    let origin;
    if (process.env.CORS_ORIGIN) {
        // Explicit list always wins (covers custom domains, staging, etc.)
        origin = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
    }
    else if (process.env.NODE_ENV === 'production') {
        // In production with no explicit override, only allow the Vercel domain
        origin = PROD_ORIGINS;
    }
    else {
        // Development — allow all origins so the local Vite dev server works
        origin = true;
    }
    await app.register(cors_1.default, { origin });
});
