// server.js - Backend API Server
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { body, validationResult } = require('express-validator');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5 // limit login attempts
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

        // Store session
        const tokenHash = await bcrypt.hash(token, 10);
        await pool.execute(
            'INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?)',
            [user.id, tokenHash, req.ip, req.get('user-agent')]
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

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        // Invalidate session
        await pool.execute(
            'DELETE FROM user_sessions WHERE user_id = ?',
            [req.user.id]
        );

        await logActivity(req.user.id, 'logout', 'user', req.user.id, {}, req);

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
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
        const { category, search, lat, lng, radius } = req.query;
        let query = `
            SELECT 
                s.*,
                c.name as category_name,
                c.icon as category_icon,
                c.slug as category_slug,
                a.name as author_name,
                a.avatar_url as author_avatar
            FROM spots s
            LEFT JOIN categories c ON s.category_id = c.id
            LEFT JOIN authors a ON s.id = a.spot_id
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

        if (lat && lng && radius) {
            // Haversine formula for distance calculation
            query += ` AND (
                6371 * acos(
                    cos(radians(?)) * cos(radians(latitude)) *
                    cos(radians(longitude) - radians(?)) +
                    sin(radians(?)) * sin(radians(latitude))
                )
            ) <= ?`;
            params.push(lat, lng, lat, radius);
        }

        const [spots] = await pool.execute(query, params);

        // Get additional data for each spot
        for (let spot of spots) {
            // Get media
            const [media] = await pool.execute(
                'SELECT * FROM media WHERE spot_id = ? ORDER BY display_order',
                [spot.id]
            );
            spot.media = media;

            // Get tips
            const [tips] = await pool.execute(
                'SELECT tip_text FROM tips WHERE spot_id = ? ORDER BY display_order',
                [spot.id]
            );
            spot.tips = tips.map(t => t.tip_text);

            // Get opening hours
            const [hours] = await pool.execute(
                'SELECT * FROM opening_hours WHERE spot_id = ? ORDER BY day_of_week',
                [spot.id]
            );
            spot.openingHours = hours;

            // Get social links
            const [social] = await pool.execute(
                'SELECT platform, url FROM social_links WHERE spot_id = ?',
                [spot.id]
            );
            spot.social = social.reduce((acc, s) => {
                acc[s.platform] = s.url;
                return acc;
            }, {});

            // Get related articles
            const [articles] = await pool.execute(
                'SELECT * FROM related_articles WHERE spot_id = ?',
                [spot.id]
            );
            spot.relatedArticle = articles[0] || null;
        }

        res.json({ spots });
    } catch (error) {
        console.error('Get spots error:', error);
        res.status(500).json({ error: 'Failed to fetch spots' });
    }
});

// Get single spot (public)
app.get('/api/spots/:id', async (req, res) => {
    try {
        const [spots] = await pool.execute(
            'SELECT * FROM spots WHERE id = ? AND is_active = true',
            [req.params.id]
        );

        if (spots.length === 0) {
            return res.status(404).json({ error: 'Spot not found' });
        }

        const spot = spots[0];
        // Get additional data (same as above)
        // ... [similar code to get media, tips, etc.]

        res.json({ spot });
    } catch (error) {
        console.error('Get spot error:', error);
        res.status(500).json({ error: 'Failed to fetch spot' });
    }
});

// Create new spot (admin only)
app.post('/api/spots', authenticateToken, requireAdmin, [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('description').trim().optional(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('categoryId').isInt().optional(),
    body('price').isFloat({ min: 0 }).optional(),
    body('rating').isFloat({ min: 0, max: 5 }).optional()
], validate, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const {
            name, description, latitude, longitude, categoryId,
            icon, rating, price, editorPick, hours, media,
            tips, social, relatedArticle, author
        } = req.body;

        // Insert spot
        const [result] = await connection.execute(
            `INSERT INTO spots (
                name, description, category_id, latitude, longitude,
                icon, rating, price, editor_pick, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, description, categoryId, latitude, longitude,
                icon || '📍', rating || 0, price || 0, editorPick || false,
                req.user.id, req.user.id
            ]
        );

        const spotId = result.insertId;

        // Insert opening hours
        if (hours) {
            for (const [day, times] of Object.entries(hours)) {
                await connection.execute(
                    'INSERT INTO opening_hours (spot_id, day_of_week, open_time, close_time) VALUES (?, ?, ?, ?)',
                    [spotId, day, times.open, times.close]
                );
            }
        }

        // Insert media
        if (media && media.length > 0) {
            for (let i = 0; i < media.length; i++) {
                const m = media[i];
                await connection.execute(
                    'INSERT INTO media (spot_id, type, url, thumbnail_url, caption, display_order) VALUES (?, ?, ?, ?, ?, ?)',
                    [spotId, m.type, m.url, m.thumbnail || null, m.caption || null, i]
                );
            }
        }

        // Insert tips
        if (tips && tips.length > 0) {
            for (let i = 0; i < tips.length; i++) {
                await connection.execute(
                    'INSERT INTO tips (spot_id, tip_text, display_order, created_by) VALUES (?, ?, ?, ?)',
                    [spotId, tips[i], i, req.user.id]
                );
            }
        }

        // Insert social links
        if (social) {
            for (const [platform, url] of Object.entries(social)) {
                await connection.execute(
                    'INSERT INTO social_links (spot_id, platform, url) VALUES (?, ?, ?)',
                    [spotId, platform, url]
                );
            }
        }

        // Insert related article
        if (relatedArticle) {
            await connection.execute(
                'INSERT INTO related_articles (spot_id, title, url) VALUES (?, ?, ?)',
                [spotId, relatedArticle.title, relatedArticle.url]
            );
        }

        // Insert author
        if (author) {
            await connection.execute(
                'INSERT INTO authors (spot_id, name, avatar_url) VALUES (?, ?, ?)',
                [spotId, author.name, author.avatar]
            );
        }

        await connection.commit();

        await logActivity(req.user.id, 'create', 'spot', spotId, { name }, req);

        res.status(201).json({ 
            message: 'Spot created successfully',
            spotId 
        });
    } catch (error) {
        await connection.rollback();
        console.error('Create spot error:', error);
        res.status(500).json({ error: 'Failed to create spot' });
    } finally {
        connection.release();
    }
});

// Update spot (admin only)
app.put('/api/spots/:id', authenticateToken, requireAdmin, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const spotId = req.params.id;
        const updates = req.body;

        // Update main spot data
        if (updates.name !== undefined || updates.description !== undefined || 
            updates.latitude !== undefined || updates.longitude !== undefined) {
            
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
            if (updates.latitude !== undefined) {
                fields.push('latitude = ?');
                values.push(updates.latitude);
            }
            if (updates.longitude !== undefined) {
                fields.push('longitude = ?');
                values.push(updates.longitude);
            }
            if (updates.categoryId !== undefined) {
                fields.push('category_id = ?');
                values.push(updates.categoryId);
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

            fields.push('updated_by = ?');
            values.push(req.user.id);

            values.push(spotId);

            await connection.execute(
                `UPDATE spots SET ${fields.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Update other related data if provided
        // ... [similar update logic for media, tips, hours, etc.]

        await connection.commit();

        await logActivity(req.user.id, 'update', 'spot', spotId, updates, req);

        res.json({ message: 'Spot updated successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Update spot error:', error);
        res.status(500).json({ error: 'Failed to update spot' });
    } finally {
        connection.release();
    }
});

// Delete spot (admin only)
app.delete('/api/spots/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const spotId = req.params.id;

        // Soft delete
        await pool.execute(
            'UPDATE spots SET is_active = false, updated_by = ? WHERE id = ?',
            [req.user.id, spotId]
        );

        await logActivity(req.user.id, 'delete', 'spot', spotId, {}, req);

        res.json({ message: 'Spot deleted successfully' });
    } catch (error) {
        console.error('Delete spot error:', error);
        res.status(500).json({ error: 'Failed to delete spot' });
    }
});

// ===== CATEGORIES ROUTES =====

// Get all categories
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

// ===== USER MANAGEMENT ROUTES (admin only) =====

// Get all users
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

// Update user role
app.put('/api/users/:id/role', authenticateToken, requireAdmin, [
    body('role').isIn(['user', 'admin'])
], validate, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE users SET role = ? WHERE id = ?',
            [req.body.role, req.params.id]
        );

        await logActivity(req.user.id, 'update_role', 'user', req.params.id, { role: req.body.role }, req);

        res.json({ message: 'User role updated successfully' });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// ===== ACTIVITY LOGS (admin only) =====

app.get('/api/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const [logs] = await pool.execute(
            `SELECT 
                l.*,
                u.email,
                u.full_name
            FROM activity_logs l
            LEFT JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?`,
            [parseInt(limit), parseInt(offset)]
        );

        res.json({ logs });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
});