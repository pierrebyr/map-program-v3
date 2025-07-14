// server-simple.js - Version simplifiée sans base de données
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir les fichiers du frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Données en mémoire (remplace temporairement la base de données)
let spots = [
    {
        id: 1,
        name: "Tour Eiffel",
        description: "Le monument le plus emblématique de Paris",
        category: "museum",
        icon: "🗼",
        rating: 4.8,
        lat: 48.8584,
        lng: 2.2945,
        price: 26,
        editorPick: true
    },
    {
        id: 2,
        name: "Le Jules Verne",
        description: "Restaurant gastronomique dans la Tour Eiffel",
        category: "restaurant",
        icon: "🍽️",
        rating: 4.7,
        lat: 48.8582,
        lng: 2.2945,
        price: 190,
        editorPick: false
    },
    {
        id: 3,
        name: "Jardin du Luxembourg",
        description: "Magnifique parc au cœur de Paris",
        category: "park",
        icon: "🌳",
        rating: 4.6,
        lat: 48.8462,
        lng: 2.3372,
        price: 0,
        editorPick: true
    }
];

// Utilisateur admin par défaut
const adminUser = {
    id: 1,
    email: 'admin@example.com',
    password: 'admin123', // En production, ce serait hashé !
    fullName: 'Admin User',
    role: 'admin'
};

// Routes API

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        message: 'API is running (no database mode)',
        timestamp: new Date().toISOString()
    });
});

// Login simplifié
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (email === adminUser.email && password === adminUser.password) {
        res.json({
            token: 'fake-jwt-token-for-testing',
            user: {
                id: adminUser.id,
                email: adminUser.email,
                fullName: adminUser.fullName,
                role: adminUser.role
            }
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Get current user
app.get('/api/auth/me', (req, res) => {
    // Simuler un utilisateur connecté
    res.json({ 
        user: {
            id: adminUser.id,
            email: adminUser.email,
            full_name: adminUser.fullName,
            role: adminUser.role
        }
    });
});

// Get all spots
app.get('/api/spots', (req, res) => {
    const { category, search } = req.query;
    
    let filteredSpots = [...spots];
    
    if (category && category !== 'all') {
        filteredSpots = filteredSpots.filter(s => s.category === category);
    }
    
    if (search) {
        const searchLower = search.toLowerCase();
        filteredSpots = filteredSpots.filter(s => 
            s.name.toLowerCase().includes(searchLower) ||
            s.description.toLowerCase().includes(searchLower)
        );
    }
    
    res.json({ spots: filteredSpots });
});

// Get categories
app.get('/api/categories', (req, res) => {
    res.json({ 
        categories: [
            { id: 1, slug: 'restaurant', name: 'Food', icon: '🍽️', is_active: true },
            { id: 2, slug: 'museum', name: 'Culture', icon: '🏛️', is_active: true },
            { id: 3, slug: 'park', name: 'Nature', icon: '🌳', is_active: true },
            { id: 4, slug: 'shopping', name: 'Shopping', icon: '🛍️', is_active: true }
        ]
    });
});

// Create spot (simulé)
app.post('/api/spots', (req, res) => {
    const newSpot = {
        id: spots.length + 1,
        ...req.body,
        lat: parseFloat(req.body.latitude),
        lng: parseFloat(req.body.longitude)
    };
    spots.push(newSpot);
    res.status(201).json({ message: 'Spot created', spotId: newSpot.id });
});

// Update spot (simulé)
app.put('/api/spots/:id', (req, res) => {
    const spotId = parseInt(req.params.id);
    const spotIndex = spots.findIndex(s => s.id === spotId);
    
    if (spotIndex !== -1) {
        spots[spotIndex] = { ...spots[spotIndex], ...req.body };
        res.json({ message: 'Spot updated' });
    } else {
        res.status(404).json({ error: 'Spot not found' });
    }
});

// Delete spot (simulé)
app.delete('/api/spots/:id', (req, res) => {
    const spotId = parseInt(req.params.id);
    spots = spots.filter(s => s.id !== spotId);
    res.json({ message: 'Spot deleted' });
});

// Get users (simulé)
app.get('/api/users', (req, res) => {
    res.json({ 
        users: [adminUser]
    });
});

// Get logs (simulé)
app.get('/api/logs', (req, res) => {
    res.json({ 
        logs: [
            {
                id: 1,
                user_id: 1,
                action: 'login',
                created_at: new Date().toISOString(),
                email: adminUser.email
            }
        ]
    });
});

// Servir le frontend pour toutes les autres routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log('\n⚠️  Running in NO DATABASE mode - data is temporary!');
    console.log('📧 Login: admin@example.com / admin123');
});