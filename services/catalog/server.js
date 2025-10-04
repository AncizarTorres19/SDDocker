import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';


const app = express();
app.use(express.json());


const PORT = process.env.CATALOG_PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_CATALOG;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';


const pool = new Pool({ connectionString: DATABASE_URL });


let redisClient;
(async () => {
try {
redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error', err));
await redisClient.connect();
} catch (e) { console.error('Redis connect error:', e.message); }
})();


app.get('/health', (req, res) => res.json({ status: 'ok', service: 'catalog' }));


app.get('/items', async (req, res) => {
const client = await pool.connect();
try {
await client.query('CREATE TABLE IF NOT EXISTS items(id SERIAL PRIMARY KEY, name TEXT NOT NULL);');
const { rows: countRows } = await client.query('SELECT COUNT(*)::int AS c FROM items;');
if (countRows[0].c === 0) {
await client.query("INSERT INTO items(name) VALUES ('rope'),('ring'),('band');");
}
const { rows } = await client.query('SELECT id, name FROM items ORDER BY id;');


if (redisClient) await redisClient.set('catalog:lastCount', String(rows.length));


res.json(rows);
} catch (e) {
console.error(e);
res.status(500).json({ error: 'catalog error', detail: e.message });
} finally {
client.release();
}
});


app.listen(PORT, () => console.log(`Catalog on ${PORT}`));