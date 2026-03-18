#!/usr/bin/env node
// Register Oracle of Wit slash commands with the Discord API
// Usage: npm run register-commands
// Requires: DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN in env

const APP_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
    console.error('Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN');
    console.error('Set them in .env or export before running.');
    process.exit(1);
}

const commands = [
    {
        name: 'play',
        description: 'Create a new Oracle of Wit game room',
        options: [
            {
                name: 'category',
                description: 'Joke category',
                type: 3, // STRING
                required: false,
                choices: [
                    { name: 'Tech', value: 'tech' },
                    { name: 'Crypto', value: 'crypto' },
                    { name: 'General', value: 'general' },
                ]
            }
        ]
    },
    {
        name: 'leaderboard',
        description: 'View the top 10 Oracle of Wit players',
    },
    {
        name: 'stats',
        description: 'View global or player-specific stats',
        options: [
            {
                name: 'player',
                description: 'Player name (leave empty for global stats)',
                type: 3, // STRING
                required: false,
            }
        ]
    },
    {
        name: 'joke',
        description: 'Get a random joke setup to complete',
        options: [
            {
                name: 'category',
                description: 'Joke category',
                type: 3, // STRING
                required: false,
                choices: [
                    { name: 'Tech', value: 'tech' },
                    { name: 'Crypto', value: 'crypto' },
                    { name: 'General', value: 'general' },
                ]
            }
        ]
    },
    {
        name: 'history',
        description: 'View a player\'s on-chain game history',
        options: [
            {
                name: 'player',
                description: 'Player name to look up',
                type: 3, // STRING
                required: true,
            }
        ]
    },
];

async function main() {
    console.log('=== Oracle of Wit — Registering Discord Slash Commands ===\n');
    console.log(`Application ID: ${APP_ID}`);
    console.log(`Commands to register: ${commands.length}\n`);

    const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${BOT_TOKEN}`,
        },
        body: JSON.stringify(commands),
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`Failed: ${res.status} ${res.statusText}`);
        console.error(text);
        process.exit(1);
    }

    const registered = await res.json();
    console.log(`Registered ${registered.length} commands:`);
    for (const cmd of registered) {
        console.log(`  /${cmd.name} — ${cmd.description}`);
    }
    console.log('\nDone! Commands are now available globally (may take up to 1 hour to propagate).');
}

main().catch(e => { console.error(e); process.exit(1); });
