// server.js - Version qui fonctionne avec Supabase/PostgreSQL
const express = require('express');
const { Client, Pool } = require('pg'); // PostgreSQL au lieu de MySQL !
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { body, validationResult } = require('express-validator');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers du frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

app.use('/api/', limiter);

// Configuration PostgreSQL pour Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_URL,
    ssl: {
        rejectUnauthorized: false // Important pour Supabase
    }
});

// Test de connexion
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Erreur de connexion à la base de données:', err.stack);
    } else {
        console.log('✅ Connecté à Supabase/PostgreSQL !');
        release();
    }
});

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '24h';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        message: 'API is running with Supabase!',
        timestamp: new Date().toISOString()
    });
});

// ===== AUTH ROUTES =====

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get user - PostgreSQL utilise $1, $2 au lieu de ?
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(401).json({ error: 'Account deactivated' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        // Check if user exists
        const existing = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
            [email, passwordHash, fullName]
        );

        const userId = result.rows[0].id;

        // Generate token
        const token = jwt.sign(
            { id: userId, email, role: 'user' },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            token,
            user: {
                id: userId,
                email,
                fullName,
                role: 'user'
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, full_name, role, created_at, last_login FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// ===== SPOTS ROUTES =====

// Get all spots
app.get('/api/spots', async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = `
            SELECT 
                s.*,
                c.name as category_name,
                c.icon as category_icon,
                c.slug as category_slug
            FROM spots s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.is_active = true
        `;
        
        const params = [];
        let paramCount = 0;

        if (category && category !== 'all') {
            paramCount++;
            query += ` AND c.slug = $${paramCount}`;
            params.push(category);
        }

        if (search) {
            paramCount++;
            query += ` AND (s.name ILIKE $${paramCount} OR s.description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        const result = await pool.query(query, params);

        // Format spots for frontend
        const formattedSpots = result.rows.map(spot => ({
            id: spot.id,
            name: spot.name,
            description: spot.description,
            category: spot.category_slug || 'restaurant',
            icon: spot.icon || spot.category_icon || '📍',
            rating: parseFloat(spot.rating) || 0,
            lat: parseFloat(spot.latitude),
            lng: parseFloat(spot.longitude),
            price: parseFloat(spot.price) || 0,
            editorPick: !!spot.editor_pick
        }));

        res.json({ spots: formattedSpots });
    } catch (error) {
        console.error('Get spots error:', error);
        res.status(500).json({ error: 'Failed to fetch spots' });
    }
});

// Get categories
app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM categories WHERE is_active = true ORDER BY name'
        );
        res.json({ categories: result.rows });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create spot (admin only)
app.post('/api/spots', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name, description, latitude, longitude, categoryId,
            icon, rating, price, editorPick
        } = req.body;

        const result = await pool.query(
            `INSERT INTO spots (
                name, description, category_id, latitude, longitude,
                icon, rating, price, editor_pick, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [
                name, description, categoryId || 1, latitude, longitude,
                icon || '📍', rating || 0, price || 0, editorPick || false,
                req.user.id, req.user.id
            ]
        );

        res.status(201).json({ 
            message: 'Spot created successfully',
            spotId: result.rows[0].id 
        });
    } catch (error) {
        console.error('Create spot error:', error);
        res.status(500).json({ error: 'Failed to create spot' });
    }
});

// Update spot (admin only)
app.put('/api/spots/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const spotId = req.params.id;
        const updates = req.body;

        // Build update query dynamically
        const fields = [];
        const values = [];
        let paramCount = 1;

        if (updates.name !== undefined) {
            fields.push(`name = $${paramCount++}`);
            values.push(updates.name);
        }
        if (updates.description !== undefined) {
            fields.push(`description = $${paramCount++}`);
            values.push(updates.description);
        }
        if (updates.price !== undefined) {
            fields.push(`price = $${paramCount++}`);
            values.push(updates.price);
        }
        if (updates.rating !== undefined) {
            fields.push(`rating = $${paramCount++}`);
            values.push(updates.rating);
        }
        if (updates.editorPick !== undefined) {
            fields.push(`editor_pick = $${paramCount++}`);
            values.push(updates.editorPick);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        fields.push(`updated_by = $${paramCount++}`);
        values.push(req.user.id);
        values.push(spotId);

        await pool.query(
            `UPDATE spots SET ${fields.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        res.json({ message: 'Spot updated successfully' });
    } catch (error) {
        console.error('Update spot error:', error);
        res.status(500).json({ error: 'Failed to update spot' });
    }
});

// Delete spot (admin only)
app.delete('/api/spots/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await pool.query(
            'UPDATE spots SET is_active = false WHERE id = $1',
            [req.params.id]
        );

        res.json({ message: 'Spot deleted successfully' });
    } catch (error) {
        console.error('Delete spot error:', error);
        res.status(500).json({ error: 'Failed to delete spot' });
    }
});

// Get users (admin only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, full_name, role, is_active, created_at, last_login FROM users'
        );
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get activity logs (admin only)
app.get('/api/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT l.*, u.email 
             FROM activity_logs l
             LEFT JOIN users u ON l.user_id = u.id
             ORDER BY l.created_at DESC 
             LIMIT 50`
        );
        res.json({ logs: result.rows });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Route catch-all pour le frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API available at http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend available at http://localhost:${PORT}`);
});