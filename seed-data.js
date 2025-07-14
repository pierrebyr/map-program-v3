// seed-data.js - Database Seeding Script
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Sample data
const sampleSpots = [
    {
        name: "Eiffel Tower",
        description: "The iron lady of Paris stands tall at 330 meters, offering breathtaking views of the city. This architectural marvel attracts millions of visitors yearly with its timeless elegance.",
        category: "museum",
        icon: "🗼",
        rating: 4.8,
        lat: 48.8584,
        lng: 2.2945,
        price: 26,
        hours: { open: "09:30", close: "23:45" },
        editorPick: true,
        author: {
            name: "Sophie Martin",
            avatar: "https://i.pravatar.cc/100?img=1"
        },
        media: [
            { type: "image", url: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=800", caption: "Eiffel Tower at sunset" },
            { type: "image", url: "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=800", caption: "Night view with lights" }
        ],
        tips: [
            "Visit early morning or late evening to avoid crowds",
            "Book tickets online to skip the queue",
            "The view from Trocadéro is perfect for photos"
        ],
        social: {
            instagram: "https://instagram.com/toureiffelofficielle",
            website: "https://www.toureiffel.paris"
        }
    },
    {
        name: "Le Jules Verne",
        description: "Michelin-starred dining experience 125 meters above Paris. Chef Frédéric Anton creates contemporary French cuisine with a view that matches the exceptional food.",
        category: "restaurant",
        icon: "🍽️",
        rating: 4.7,
        lat: 48.8582,
        lng: 2.2945,
        price: 190,
        hours: { open: "12:00", close: "21:30" },
        author: {
            name: "Marcus Chen",
            avatar: "https://i.pravatar.cc/100?img=3"
        },
        media: [
            { type: "image", url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800", caption: "Signature dish presentation" }
        ],
        tips: [
            "Reservations essential - book 2-3 months ahead",
            "Lunch menu offers better value",
            "Dress code: Smart casual required"
        ],
        social: {
            instagram: "https://instagram.com/lejulesverneparis",
            website: "https://www.lejules-verne.com"
        }
    },
    {
        name: "Luxembourg Gardens",
        description: "A 23-hectare oasis in the heart of Paris. These palace gardens feature beautiful flowerbeds, tree-lined promenades, and the famous Medici Fountain.",
        category: "park",
        icon: "🌳",
        rating: 4.6,
        lat: 48.8462,
        lng: 2.3372,
        price: 0,
        hours: { open: "07:30", close: "20:30" },
        editorPick: true,
        author: {
            name: "Emma Wilson",
            avatar: "https://i.pravatar.cc/100?img=5"
        },
        media: [
            { type: "image", url: "https://images.unsplash.com/photo-1575385043265-42f10a75ff90?w=800", caption: "Medici Fountain" }
        ],
        tips: [
            "Free chairs available throughout the park",
            "Puppet shows for kids on weekends",
            "Best picnic spots near the pond"
        ],
        social: {
            website: "https://www.senat.fr/visite/jardin/"
        }
    }
];

async function seedDatabase() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'liquid_glass_map'
        });

        console.log('Connected to database');

        // Check if data already exists
        const [existingSpots] = await connection.execute('SELECT COUNT(*) as count FROM spots');
        if (existingSpots[0].count > 0) {
            console.log('Database already contains data. Skipping seed.');
            return;
        }

        // Create admin user
        console.log('Creating admin user...');
        const adminPassword = await bcrypt.hash('admin123', 10);
        const [adminResult] = await connection.execute(
            'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
            ['admin@example.com', adminPassword, 'Admin User', 'admin']
        );
        const adminId = adminResult.insertId;

        // Create sample regular user
        const userPassword = await bcrypt.hash('user123', 10);
        await connection.execute(
            'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
            ['user@example.com', userPassword, 'Sample User', 'user']
        );

        console.log('Users created successfully');

        // Get category mappings
        const [categories] = await connection.execute('SELECT id, slug FROM categories');
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.slug] = cat.id;
        });

        // Insert spots
        console.log('Inserting sample spots...');
        for (const spotData of sampleSpots) {
            try {
                // Insert spot
                const [spotResult] = await connection.execute(
                    `INSERT INTO spots (
                        name, description, category_id, latitude, longitude,
                        icon, rating, price, editor_pick, created_by, updated_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        spotData.name,
                        spotData.description,
                        categoryMap[spotData.category] || categoryMap['restaurant'],
                        spotData.lat,
                        spotData.lng,
                        spotData.icon,
                        spotData.rating,
                        spotData.price,
                        spotData.editorPick || false,
                        adminId,
                        adminId
                    ]
                );

                const spotId = spotResult.insertId;
                console.log(`Created spot: ${spotData.name} (ID: ${spotId})`);

                // Insert opening hours
                if (spotData.hours) {
                    // For simplicity, apply same hours to all weekdays
                    for (let day = 1; day <= 5; day++) {
                        await connection.execute(
                            'INSERT INTO opening_hours (spot_id, day_of_week, open_time, close_time) VALUES (?, ?, ?, ?)',
                            [spotId, day, spotData.hours.open, spotData.hours.close]
                        );
                    }
                    // Weekend hours (closed on Sunday as example)
                    await connection.execute(
                        'INSERT INTO opening_hours (spot_id, day_of_week, open_time, close_time) VALUES (?, ?, ?, ?)',
                        [spotId, 6, spotData.hours.open, spotData.hours.close]
                    );
                    await connection.execute(
                        'INSERT INTO opening_hours (spot_id, day_of_week, is_closed) VALUES (?, ?, ?)',
                        [spotId, 0, true]
                    );
                }

                // Insert media
                if (spotData.media) {
                    for (let i = 0; i < spotData.media.length; i++) {
                        const media = spotData.media[i];
                        await connection.execute(
                            'INSERT INTO media (spot_id, type, url, caption, display_order) VALUES (?, ?, ?, ?, ?)',
                            [spotId, media.type, media.url, media.caption, i]
                        );
                    }
                }

                // Insert tips
                if (spotData.tips) {
                    for (let i = 0; i < spotData.tips.length; i++) {
                        await connection.execute(
                            'INSERT INTO tips (spot_id, tip_text, display_order, created_by) VALUES (?, ?, ?, ?)',
                            [spotId, spotData.tips[i], i, adminId]
                        );
                    }
                }

                // Insert social links
                if (spotData.social) {
                    for (const [platform, url] of Object.entries(spotData.social)) {
                        await connection.execute(
                            'INSERT INTO social_links (spot_id, platform, url) VALUES (?, ?, ?)',
                            [spotId, platform, url]
                        );
                    }
                }

                // Insert author
                if (spotData.author) {
                    await connection.execute(
                        'INSERT INTO authors (spot_id, name, avatar_url) VALUES (?, ?, ?)',
                        [spotId, spotData.author.name, spotData.author.avatar]
                    );
                }

            } catch (error) {
                console.error(`Error inserting spot ${spotData.name}:`, error);
            }
        }

        console.log('\n✅ Database seeded successfully!');
        console.log('\n📧 Login credentials:');
        console.log('   Admin: admin@example.com / admin123');
        console.log('   User: user@example.com / user123');
        console.log('\n⚠️  Please change these passwords after first login!');

    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run seeding
seedDatabase();