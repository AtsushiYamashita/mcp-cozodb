#!/usr/bin/env node
/**
 * Interactive Setup Script for MCP CozoDB Server
 * 
 * Automatically configures the server for Claude Desktop, Gemini CLI, or Google Antigravity.
 * 
 * Usage:
 *   npm run setup              # Interactive mode
 *   npm run setup -- -h         # Show help
 *   npm run setup -- -t claude  # Auto-configure for Claude Desktop
 *   npm run setup -- -t gemini  # Auto-configure for Gemini CLI
 *   npm run setup -- -t antigravity  # Auto-configure for Google Antigravity
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Configuration Templates
// ---------------------------------------------------------------------------

const AGENT_CONFIGS = {
  claude: {
    name: 'Claude Desktop',
    configPath:
      os.platform() === 'win32'
        ? path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
        : path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    template: (scriptPath, engine, dbPath) => ({
      command: 'node',
      args: [scriptPath],
      env: {
        COZO_ENGINE: engine,
        ...(engine !== 'mem' && { COZO_PATH: dbPath }),
      },
    }),
    key: 'mcpServers.cozodb',
  },
  gemini: {
    name: 'Gemini CLI',
    configPath: null, // Will prompt for project path
    template: (scriptPath,engine, dbPath) => ({
      command: 'node',
      args: [scriptPath],
      env: {
        COZO_ENGINE: engine,
        ...(engine !== 'mem' && { COZO_PATH: dbPath }),
      },
    }),
    key: 'cozodb',
  },
  antigravity: {
    name: 'Google Antigravity',
    configPath: path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
    template: (scriptPath, engine, dbPath) => ({
      command: 'node',
      args: [scriptPath],
      env: {
        COZO_ENGINE: engine,
        ...(engine !== 'mem' && { COZO_PATH: dbPath }),
      },
    }),
    key: 'mcpServers.cozodb',
  },
};

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { help: false, target: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-h' || args[i] === '--help') {
      result.help = true;
    } else if (args[i] === '-t' || args[i] === '--target') {
      result.target = args[i + 1];
      i++; // Skip next arg
    }
  }

  return result;
}

function showHelp() {
  console.log(`
MCP CozoDB Server Setup

Automatically configure this MCP server for your AI agent.

USAGE:
  npm run setup                  Interactive mode (prompts for configuration)
  npm run setup -- -h            Show this help message
  npm run setup -- -t <agent>    Auto-configure for specific agent

SUPPORTED AGENTS:
  claude        Claude Desktop
  gemini        Gemini CLI
  antigravity   Google Antigravity

EXAMPLES:
  npm run setup                  # Interactive setup
  npm run setup -- -t claude     # Configure for Claude Desktop
  npm run setup -- -t antigravity # Configure for Google Antigravity

NOTES:
  - Setup will create dist/index.js if it doesn't exist (runs 'npm run build')
  - Configuration files are auto-detected (or you'll be prompted)
  - Existing configurations are preserved (new entry added)
  `);
}

// ---------------------------------------------------------------------------
// Interactive Prompts
// ---------------------------------------------------------------------------

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function promptAgent(rl) {
  console.log('\nSelect your AI agent:');
  console.log('  1. Claude Desktop');
  console.log('  2. Gemini CLI');
  console.log('  3. Google Antigravity');
  const answer = await question(rl, '\nEnter choice (1-3): ');
  const choices = { '1': 'claude', '2': 'gemini', '3': 'antigravity' };
  return choices[answer.trim()] || null;
}

async function promptEngine(rl) {
  console.log('\nSelect database engine:');
  console.log('  1. mem       (In-memory, no persistence)');
  console.log('  2. sqlite    (File-based, lightweight)');
  console.log('  3. rocksdb   (File-based, high performance)');
  const answer = await question(rl, '\nEnter choice (1-3, default: 1): ');
  const choices = { '1': 'mem', '2': 'sqlite', '3': 'rocksdb', '': 'mem' };
  return choices[answer.trim()] || 'mem';
}

async function promptDbPath(rl, engine) {
  if (engine === 'mem') return null;
  const defaultPath =
    os.platform() === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Local', 'mcp-cozodb', 'cozo.db')
      : path.join(os.homedir(), '.local', 'share', 'mcp-cozodb', 'cozo.db');
  const answer = await question(rl, `\nDatabase path (default: ${defaultPath}): `);
  const chosenPath = answer.trim() || defaultPath;
  
  // Ensure parent directory exists
  const dir = path.dirname(chosenPath);
  if (!fs.existsSync(dir)) {
    console.log(`Creating database directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
  
  return path.resolve(chosenPath); // Always return absolute path
}

async function promptConfigPath(rl, agent) {
  const config = AGENT_CONFIGS[agent];
  if (config.configPath && fs.existsSync(config.configPath)) {
    console.log(`\nFound config file: ${config.configPath}`);
    return config.configPath;
  }

  if (agent === 'gemini') {
    console.log('\nGemini CLI uses project-specific MCP configuration.');
    const projectPath = await question(rl, 'Enter project directory path: ');
    return path.join(projectPath.trim(), '.mcp', 'config.json');
  }

  console.log(`\nConfig file not found at: ${config.configPath}`);
  const customPath = await question(rl, 'Enter custom config path (or press Enter to create default): ');
  return customPath.trim() || config.configPath;
}

// ---------------------------------------------------------------------------
// Config File Editing
// ---------------------------------------------------------------------------

function ensureDistExists() {
  const distPath = path.join(PROJECT_ROOT, 'dist', 'index.js');
  if (!fs.existsSync(distPath)) {
    console.log('\n⚠️  dist/index.js not found. Running "npm run build"...');
    const { execSync } = require('child_process');
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  }
  return distPath;
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error(`⚠️  Error parsing ${configPath}: ${error.message}`);
    return {};
  }
}

function writeConfig(configPath, config) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function updateConfig(configPath, keyPath, newConfig) {
  const config = readConfig(configPath);
  setNestedValue(config, keyPath, newConfig);
  writeConfig(configPath, config);
}

// ---------------------------------------------------------------------------
// Main Setup Flow
// ---------------------------------------------------------------------------

async function setup() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  console.log('='.repeat(60));
  console.log('MCP CozoDB Server Setup');
  console.log('='.repeat(60));

  const rl = createInterface();

  try {
    // Step 1: Select agent
    let agent = args.target;
    if (!agent || !AGENT_CONFIGS[agent]) {
      agent = await promptAgent(rl);
      if (!agent) {
        console.error('\n❌ Invalid agent selection.');
        process.exit(1);
      }
    }

    const agentConfig = AGENT_CONFIGS[agent];
    console.log(`\n✓ Target agent: ${agentConfig.name}`);

    // Step 2: Select database engine
    const engine = await promptEngine(rl);
    console.log(`✓ Database engine: ${engine}`);

    // Step 3: Database path (if not mem)
    const dbPath = await promptDbPath(rl, engine);
    if (dbPath) {
      console.log(`✓ Database path: ${dbPath}`);
    }

    // Step 4: Find/create script path
    const scriptPath = ensureDistExists();
    console.log(`✓ Script path: ${scriptPath}`);

    // Step 5: Determine config path
    const configPath = await promptConfigPath(rl, agent);
    console.log(`✓ Config path: ${configPath}`);

    // Step 6: Generate and write configuration
    console.log('\n⚙️  Writing configuration...');
    const newConfig = agentConfig.template(scriptPath, engine, dbPath || './cozo.db');
    updateConfig(configPath, agentConfig.key, newConfig);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Setup complete!');
    console.log('='.repeat(60));
    console.log(`\nConfiguration written to: ${configPath}`);
    console.log(`\nNext steps:`);
    if (agent === 'claude') {
      console.log('  1. Restart Claude Desktop');
      console.log('  2. Open a conversation and verify "cozodb" appears in available tools');
    } else if (agent === 'gemini') {
      console.log('  1. Restart Gemini CLI');
      console.log('  2. Run: gemini chat');
      console.log('  3. Verify "cozodb" MCP server is loaded');
    } else if (agent === 'antigravity') {
      console.log('  1. Open Google Antigravity editor (or restart if already open)');
      console.log('  2. Click "..." → "MCP Servers" → "Manage MCP Servers"');
      console.log('  3. Click "Refresh" to reload configuration');
      console.log('  4. Verify "cozodb" shows green status');
      if (dbPath) {
        console.log(`\n  Note: Database will be created at: ${dbPath}`);
      }
    }
    console.log('');
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
setup();
