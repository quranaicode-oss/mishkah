"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableHash = stableHash;
const FNV_PRIME = 0x01000193;
const OFFSET_BASIS = 0x811c9dc5;
function stableHash(input) {
    let hash = OFFSET_BASIS;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i) & 0xff;
        hash = Math.imul(hash, FNV_PRIME);
        hash >>>= 0;
    }
    return hash.toString(16).padStart(8, '0');
}
