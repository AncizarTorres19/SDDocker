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


// Ensure items table exists
async function ensureItemsTable() {
	const client = await pool.connect();
	try {
		await client.query('CREATE TABLE IF NOT EXISTS items(id SERIAL PRIMARY KEY, name TEXT NOT NULL, price NUMERIC DEFAULT 0);');
	} finally {
		client.release();
	}
}

// List items
app.get('/items', async (req, res) => {
	try {
		await ensureItemsTable();
		const { rows } = await pool.query('SELECT id, name, price FROM items ORDER BY id;');
		if (redisClient) await redisClient.set('catalog:lastCount', String(rows.length));
		res.json(rows);
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: 'catalog error', detail: e.message });
	}
});

// Get single item
app.get('/items/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	try {
		await ensureItemsTable();
		const { rows } = await pool.query('SELECT id, name, price FROM items WHERE id = $1', [id]);
		if (rows.length === 0) return res.status(404).json({ error: 'not found' });
		res.json(rows[0]);
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: 'catalog error', detail: e.message });
	}
});

// Create item
app.post('/items', async (req, res) => {
	const { name, price } = req.body || {};
	if (!name) return res.status(400).json({ error: 'name required' });
	try {
		await ensureItemsTable();
		const { rows } = await pool.query('INSERT INTO items(name, price) VALUES($1,$2) RETURNING id, name, price;', [name, price || 0]);
		res.status(201).json(rows[0]);
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: 'catalog error', detail: e.message });
	}
});

// Update item
app.put('/items/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	const { name, price } = req.body || {};
	try {
		await ensureItemsTable();
		const { rows } = await pool.query('UPDATE items SET name = COALESCE($2, name), price = COALESCE($3, price) WHERE id = $1 RETURNING id, name, price;', [id, name, price]);
		if (rows.length === 0) return res.status(404).json({ error: 'not found' });
		res.json(rows[0]);
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: 'catalog error', detail: e.message });
	}
});

// Delete item
app.delete('/items/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	try {
		await ensureItemsTable();
		const { rowCount } = await pool.query('DELETE FROM items WHERE id = $1;', [id]);
		if (rowCount === 0) return res.status(404).json({ error: 'not found' });
		res.status(204).send();
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: 'catalog error', detail: e.message });
	}
});


app.listen(PORT, () => console.log(`Catalog on ${PORT}`));