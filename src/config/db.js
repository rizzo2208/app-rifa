const fs = require('fs');
const path = require('path');

// DATA_DIR lets a host (e.g. Railway) point storage at a persistent volume.
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const usersFile = path.join(dataDir, 'users.json');
const salesFile = path.join(dataDir, 'sales.json');
const configFile = path.join(dataDir, 'config.json');

const DEFAULT_CONFIG = { precioUnitario: 1000 };

function readJsonArray(file) {
    if (!fs.existsSync(file)) {
        return [];
    }
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) {
        return [];
    }
    return JSON.parse(raw);
}

function writeJsonArray(file, data) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadUsers() {
    return readJsonArray(usersFile);
}

function saveUsers(users) {
    writeJsonArray(usersFile, users);
}

function loadSales() {
    return readJsonArray(salesFile);
}

function saveSales(sales) {
    writeJsonArray(salesFile, sales);
}

function loadConfig() {
    if (!fs.existsSync(configFile)) {
        return { ...DEFAULT_CONFIG };
    }
    const raw = fs.readFileSync(configFile, 'utf8');
    if (!raw.trim()) {
        return { ...DEFAULT_CONFIG };
    }
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

function saveConfig(config) {
    const dir = path.dirname(configFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

module.exports = { loadUsers, saveUsers, loadSales, saveSales, loadConfig, saveConfig };
