// server.js - Version complète avec Frontend
const express = require('express');
const mysql = require('mysql2/promise');
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

// Security middleware - MODIFIÉ pour permettre le frontend
app.use(helmet({
    contentSecurityPolicy: false, // Désactivé pour simplifier
}));

// CORS modifié pour accepter toutes les origines en développement
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANT : Servir les fichiers du frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'liquid_glass_map',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Helper function to log activities
async function logActivity(userId, action, entityType, entityId, details = {}, req) {
    try {
        await pool.execute(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                userId,
                action,
                entityType,
                entityId,
                JSON.stringify(details),
                req.ip,
                req.get('user-agent')
            ]
        );
    } catch (error) {
        console.error('Activity logging error:', error);
    }
}

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        message: 'Liquid Glass Map API is running!',
        timestamp: new Date().toISOString()
    });
});

// ===== AUTH ROUTES =====

// Register new user
app.post('/api/auth/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('fullName').trim().isLength({ min: 2 })
], validate, async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        // Check if user exists
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert new user
        const [result] = await pool.execute(
            'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
            [email, passwordHash, fullName]
        );

        // Generate token
        const token = jwt.sign(
            { id: result.insertId, email, role: 'user' },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        await logActivity(result.insertId, 'register', 'user', result.insertId, { email }, req);

        res.json({
            token,
            user: {
                id: result.insertId,
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

// Login
app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], validate, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get user
        const [users] = await pool.execute(
            'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(401).json({ error: 'Account deactivated' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.execute(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        await logActivity(user.id, 'login', 'user', user.id, { email }, req);

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

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, full_name, role, created_at, last_login FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// ===== SPOTS ROUTES =====

// Get all spots (public)
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

        if (category && category !== 'all') {
            query += ' AND c.slug = ?';
            params.push(category);
        }

        if (search) {
            query += ' AND (s.name LIKE ? OR s.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [spots] = await pool.execute(query, params);

        // Format spots for frontend
        const formattedSpots = spots.map(spot => ({
            id: spot.id,
            name: spot.name,
            description: spot.description,
            category: spot.category_slug || 'restaurant',
            icon: spot.icon || spot.category_icon || '📍',
            rating: parseFloat(spot.rating) || 0,
            lat: parseFloat(spot.latitude),
            lng: parseFloat(spot.longitude),
            price: parseFloat(spot.price) || 0,
            editorPick: !!spot.editor_pick,
            // Add more fields as needed
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
        const [categories] = await pool.execute(
            'SELECT * FROM categories WHERE is_active = true ORDER BY name'
        );
        res.json({ categories });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create new spot (admin only) - Simplified for now
app.post('/api/spots', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name, description, latitude, longitude, categoryId,
            icon, rating, price, editorPick
        } = req.body;

        const [result] = await pool.execute(
            `INSERT INTO spots (
                name, description, category_id, latitude, longitude,
                icon, rating, price, editor_pick, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, description, categoryId || 1, latitude, longitude,
                icon || '📍', rating || 0, price || 0, editorPick || false,
                req.user.id, req.user.id
            ]
        );

        res.status(201).json({ 
            message: 'Spot created successfully',
            spotId: result.insertId 
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

        if (updates.name !== undefined) {
            fields.push('name = ?');
            values.push(updates.name);
        }
        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description);
        }
        if (updates.price !== undefined) {
            fields.push('price = ?');
            values.push(updates.price);
        }
        if (updates.rating !== undefined) {
            fields.push('rating = ?');
            values.push(updates.rating);
        }
        if (updates.editorPick !== undefined) {
            fields.push('editor_pick = ?');
            values.push(updates.editorPick);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        fields.push('updated_by = ?');
        values.push(req.user.id);
        values.push(spotId);

        await pool.execute(
            `UPDATE spots SET ${fields.join(', ')} WHERE id = ?`,
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
        await pool.execute(
            'UPDATE spots SET is_active = false WHERE id = ?',
            [req.params.id]
        );

        res.json({ message: 'Spot deleted successfully' });
    } catch (error) {
        console.error('Delete spot error:', error);
        res.status(500).json({ error: 'Failed to delete spot' });
    }
});

// Get all users (admin only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, full_name, role, is_active, created_at, last_login FROM users'
        );
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get activity logs (admin only)
app.get('/api/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [logs] = await pool.execute(
            `SELECT l.*, u.email FROM activity_logs l
             LEFT JOIN users u ON l.user_id = u.id
             ORDER BY l.created_at DESC LIMIT 50`
        );
        res.json({ logs });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// IMPORTANT : Route catch-all pour le frontend
// Doit être APRÈS toutes les routes API
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Test database connection and start server
async function startServer() {
    try {
        // Test database connection
        const connection = await pool.getConnection();
        console.log('✅ Connected to MySQL database');
        connection.release();

        // Initialize database if needed
        try {
            // Check if tables exist
            const [tables] = await pool.execute(
                "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
                [process.env.DB_NAME || 'liquid_glass_map']
            );

            if (tables[0].count === 0) {
                console.log('⚠️  No tables found. Please run the database schema first.');
                console.log('Run: mysql -u root -p < backend/database-schema.sql');
            } else {
                // Check if admin exists
                const [admins] = await pool.execute(
                    "SELECT COUNT(*) as count FROM users WHERE email = 'admin@example.com'"
                );

                if (admins[0].count === 0) {
                    console.log('📝 Creating default admin user...');
                    const adminPassword = await bcrypt.hash('admin123', 10);
                    await pool.execute(
                        'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
                        ['admin@example.com', adminPassword, 'Admin User', 'admin']
                    );
                    console.log('✅ Admin user created: admin@example.com / admin123');
                }
            }
        } catch (error) {
            console.log('⚠️  Database not fully initialized:', error.message);
        }

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 API available at http://localhost:${PORT}/api`);
            console.log(`🌐 Frontend available at http://localhost:${PORT}`);
            console.log('\n📋 Available endpoints:');
            console.log('   GET  /api/health - Health check');
            console.log('   POST /api/auth/login - Login');
            console.log('   POST /api/auth/register - Register');
            console.log('   GET  /api/spots - Get all spots');
            console.log('   GET  /api/categories - Get categories');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.error('\n🔧 Troubleshooting:');
        console.error('1. Check your database credentials in .env file');
        console.error('2. Make sure MySQL is running');
        console.error('3. Verify the database exists');
        process.exit(1);
    }
}

// Start the server
startServer();