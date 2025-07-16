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
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// Initialiser Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Configuration multer pour upload temporaire
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
        // Vérifier le type MIME
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé. Utilisez JPEG, PNG, WebP ou GIF.'));
        }
    }
});

// ===== UPLOAD ROUTES =====

// Upload d'image
app.post('/api/upload/image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier fourni' });
        }

        // Générer un nom de fichier unique
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${req.user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload vers Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('spot-images')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Erreur upload Supabase:', uploadError);
            return res.status(500).json({ error: 'Échec de l\'upload' });
        }

        // Obtenir l'URL publique
        const { data: { publicUrl } } = supabase
            .storage
            .from('spot-images')
            .getPublicUrl(fileName);

        // Sauvegarder en base de données
        const result = await pool.query(
            `INSERT INTO uploaded_files 
            (filename, original_name, mimetype, size, url, uploaded_by) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id, url`,
            [
                fileName,
                req.file.originalname,
                req.file.mimetype,
                req.file.size,
                publicUrl,
                req.user.id
            ]
        );

        res.json({
            success: true,
            file: {
                id: result.rows[0].id,
                url: result.rows[0].url,
                originalName: req.file.originalname
            }
        });
    } catch (error) {
        console.error('Erreur upload:', error);
        res.status(500).json({ error: 'Échec de l\'upload' });
    }
});

// Supprimer une image
app.delete('/api/upload/image/:fileId', authenticateToken, async (req, res) => {
    try {
        // Vérifier que l'utilisateur possède le fichier
        const fileResult = await pool.query(
            'SELECT filename, uploaded_by FROM uploaded_files WHERE id = $1',
            [req.params.fileId]
        );

        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: 'Fichier non trouvé' });
        }

        const file = fileResult.rows[0];
        
        // Vérifier les permissions
        if (file.uploaded_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Non autorisé' });
        }

        // Supprimer de Supabase Storage
        const { error: deleteError } = await supabase
            .storage
            .from('spot-images')
            .remove([file.filename]);

        if (deleteError) {
            console.error('Erreur suppression Supabase:', deleteError);
        }

        // Supprimer de la base de données
        await pool.query('DELETE FROM uploaded_files WHERE id = $1', [req.params.fileId]);

        res.json({ success: true, message: 'Fichier supprimé' });
    } catch (error) {
        console.error('Erreur suppression:', error);
        res.status(500).json({ error: 'Échec de la suppression' });
    }
});

// Fonction helper pour extraire l'ID YouTube
function extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Valider et formater l'URL YouTube
app.post('/api/validate-youtube', async (req, res) => {
    try {
        const { url } = req.body;
        const videoId = extractYouTubeId(url);
        
        if (!videoId) {
            return res.status(400).json({ error: 'URL YouTube invalide' });
        }

        res.json({
            valid: true,
            videoId: videoId,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur de validation' });
    }
});

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

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

// Rate limiting avec configuration correcte pour Render
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    // Configuration spécifique pour Render.com
    keyGenerator: function (req) {
        // Utiliser l'en-tête X-Forwarded-For si disponible
        return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    },
    handler: function (req, res) {
        res.status(429).json({
            error: 'Too many requests, please try again later.'
        });
    }
});

app.use('/api/', limiter);

// Remplacez votre configuration de pool par celle-ci dans server.js

// Configuration optimisée pour Supabase Session Pooler
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    // Configuration importante pour éviter les déconnexions
    connectionTimeoutMillis: 60000, // 60 secondes
    idleTimeoutMillis: 10000, // 10 secondes
    max: 10, // Maximum 10 connexions
    allowExitOnIdle: true, // Permet au process de se terminer proprement
    // Options spécifiques pour le pooler Supabase
    statement_timeout: 60000,
    query_timeout: 60000,
});

// Gestionnaire d'erreurs IMPORTANT
pool.on('error', (err, client) => {
    console.error('Erreur pool (ignorée):', err.code || err.message);
});

// NE PAS faire de test de connexion au démarrage
// car le pooler Supabase n'aime pas les connexions persistantes

console.log('✅ Pool PostgreSQL configuré pour Supabase');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'changez-moi-par-une-longue-phrase-secrete';
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

// Ajoutez ces fonctions dans votre server.js après les routes existantes

// Modifier la route GET /api/spots pour inclure les médias
app.get('/api/spots', async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = `
            SELECT 
                s.*,
                c.name as category_name,
                c.icon as category_icon,
                c.slug as category_slug,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'type', m.type,
                            'url', m.url,
                            'caption', m.caption,
                            'thumbnail', m.thumbnail_url
                        )
                    ) FILTER (WHERE m.id IS NOT NULL), 
                    '[]'
                ) as media,
                COALESCE(
                    json_agg(
                        DISTINCT t.tip_text
                    ) FILTER (WHERE t.id IS NOT NULL), 
                    '[]'
                ) as tips,
                COALESCE(
                    json_build_object(
                        'instagram', MAX(CASE WHEN sl.platform = 'instagram' THEN sl.url END),
                        'website', MAX(CASE WHEN sl.platform = 'website' THEN sl.url END)
                    ),
                    '{}'
                ) as social,
                COALESCE(
                    json_build_object(
                        'open', MIN(CASE WHEN oh.day_of_week = EXTRACT(DOW FROM CURRENT_DATE) THEN oh.open_time END)::text,
                        'close', MIN(CASE WHEN oh.day_of_week = EXTRACT(DOW FROM CURRENT_DATE) THEN oh.close_time END)::text
                    ),
                    NULL
                ) as hours,
                json_build_object(
                    'name', a.name,
                    'avatar', a.avatar_url
                ) as author
            FROM spots s
            LEFT JOIN categories c ON s.category_id = c.id
            LEFT JOIN media m ON s.id = m.spot_id
            LEFT JOIN tips t ON s.id = t.spot_id
            LEFT JOIN social_links sl ON s.id = sl.spot_id
            LEFT JOIN opening_hours oh ON s.id = oh.spot_id
            LEFT JOIN authors a ON s.id = a.spot_id
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

        query += ` GROUP BY s.id, c.name, c.icon, c.slug, a.name, a.avatar_url`;

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
            editorPick: !!spot.editor_pick,
            media: spot.media || [],
            tips: spot.tips || [],
            social: spot.social || {},
            hours: spot.hours,
            author: spot.author && spot.author.name ? spot.author : null
        }));

        res.json({ spots: formattedSpots });
    } catch (error) {
        console.error('Get spots error:', error);
        res.status(500).json({ error: 'Failed to fetch spots' });
    }
});

// Modifier la route POST /api/spots pour inclure les médias
app.post('/api/spots', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const {
            name, description, latitude, longitude, categoryId,
            icon, rating, price, editorPick,
            media, tips, social, hours, author
        } = req.body;

        // Insérer le spot
        const spotResult = await client.query(
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

        const spotId = spotResult.rows[0].id;

        // Insérer les médias
        if (media && media.length > 0) {
            for (let i = 0; i < media.length; i++) {
                const m = media[i];
                await client.query(
                    'INSERT INTO media (spot_id, type, url, caption, thumbnail_url, display_order) VALUES ($1, $2, $3, $4, $5, $6)',
                    [spotId, m.type, m.url, m.caption, m.thumbnail, i]
                );
            }
        }

        // Insérer les tips
        if (tips && tips.length > 0) {
            for (let i = 0; i < tips.length; i++) {
                await client.query(
                    'INSERT INTO tips (spot_id, tip_text, display_order, created_by) VALUES ($1, $2, $3, $4)',
                    [spotId, tips[i], i, req.user.id]
                );
            }
        }

        // Insérer les liens sociaux
        if (social) {
            if (social.instagram) {
                await client.query(
                    'INSERT INTO social_links (spot_id, platform, url) VALUES ($1, $2, $3)',
                    [spotId, 'instagram', social.instagram]
                );
            }
            if (social.website) {
                await client.query(
                    'INSERT INTO social_links (spot_id, platform, url) VALUES ($1, $2, $3)',
                    [spotId, 'website', social.website]
                );
            }
        }

        // Insérer les heures d'ouverture
        if (hours && hours.open && hours.close) {
            // Pour simplifier, on met les mêmes heures pour tous les jours
            for (let day = 0; day <= 6; day++) {
                await client.query(
                    'INSERT INTO opening_hours (spot_id, day_of_week, open_time, close_time) VALUES ($1, $2, $3, $4)',
                    [spotId, day, hours.open, hours.close]
                );
            }
        }

        // Insérer l'auteur
        if (author && author.name) {
            await client.query(
                'INSERT INTO authors (spot_id, name, avatar_url) VALUES ($1, $2, $3)',
                [spotId, author.name, author.avatar || `https://i.pravatar.cc/100?u=${author.name}`]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({ 
            message: 'Spot created successfully',
            spotId: spotId 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create spot error:', error);
        res.status(500).json({ error: 'Failed to create spot' });
    } finally {
        client.release();
    }
});
// Ajoutez ces endpoints dans votre server.js

// ===== FAVORITES ROUTES =====

// Get user's favorites
app.get('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                s.*,
                c.name as category_name,
                c.icon as category_icon,
                c.slug as category_slug,
                f.created_at as favorited_at
            FROM favorites f
            JOIN spots s ON f.spot_id = s.id
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE f.user_id = $1 AND s.is_active = true
            ORDER BY f.created_at DESC`,
            [req.user.id]
        );

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
            editorPick: !!spot.editor_pick,
            isFavorite: true,
            favoritedAt: spot.favorited_at
        }));

        res.json({ spots: formattedSpots });
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});

// Add to favorites
app.post('/api/favorites/:spotId', authenticateToken, async (req, res) => {
    try {
        const spotId = req.params.spotId;
        
        // Vérifier que le spot existe
        const spotCheck = await pool.query(
            'SELECT id FROM spots WHERE id = $1 AND is_active = true',
            [spotId]
        );
        
        if (spotCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Spot not found' });
        }
        
        // Ajouter aux favoris
        await pool.query(
            'INSERT INTO favorites (user_id, spot_id) VALUES ($1, $2) ON CONFLICT (user_id, spot_id) DO NOTHING',
            [req.user.id, spotId]
        );
        
        // Log activity
        await pool.query(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'favorite_add', 'spot', spotId]
        );
        
        res.json({ message: 'Added to favorites' });
    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

// Remove from favorites
app.delete('/api/favorites/:spotId', authenticateToken, async (req, res) => {
    try {
        const spotId = req.params.spotId;
        
        const result = await pool.query(
            'DELETE FROM favorites WHERE user_id = $1 AND spot_id = $2 RETURNING id',
            [req.user.id, spotId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Favorite not found' });
        }
        
        // Log activity
        await pool.query(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'favorite_remove', 'spot', spotId]
        );
        
        res.json({ message: 'Removed from favorites' });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

// Modifier la route GET /api/spots pour inclure l'état favori
app.get('/api/spots', async (req, res) => {
    try {
        const { category, search, favoritesOnly } = req.query;
        const userId = req.user?.id; // Si l'utilisateur est connecté
        
        let query = `
            SELECT 
                s.*,
                c.name as category_name,
                c.icon as category_icon,
                c.slug as category_slug,
                ${userId ? 'CASE WHEN f.id IS NOT NULL THEN true ELSE false END as is_favorite' : 'false as is_favorite'}
            FROM spots s
            LEFT JOIN categories c ON s.category_id = c.id
            ${userId ? 'LEFT JOIN favorites f ON s.id = f.spot_id AND f.user_id = $1' : ''}
            WHERE s.is_active = true
        `;
        
        const params = userId ? [userId] : [];
        let paramCount = userId ? 1 : 0;

        // Filtre pour les favoris uniquement
        if (favoritesOnly === 'true' && userId) {
            query += ` AND f.id IS NOT NULL`;
        }

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

        // Format spots
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
            editorPick: !!spot.editor_pick,
            isFavorite: !!spot.is_favorite
        }));

        res.json({ spots: formattedSpots });
    } catch (error) {
        console.error('Get spots error:', error);
        res.status(500).json({ error: 'Failed to fetch spots' });
    }
});