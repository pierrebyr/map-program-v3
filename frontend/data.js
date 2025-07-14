// Initial tourist spots data
const initialSpots = [
    {
        id: 1,
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
            { type: "image", url: "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=800", caption: "Night view with lights" },
            { type: "video", url: "https://cdn.pixabay.com/vimeo/328940142/paris-24502.mp4?width=640&hash=7f1e7d3f3c9d8b9a9f8f7d3f3c9d8b9a9f8f7d3f", thumbnail: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800" }
        ],
        tips: [
            "Visit early morning or late evening to avoid crowds",
            "Book tickets online to skip the queue",
            "The view from Trocadéro is perfect for photos"
        ],
        relatedArticle: {
            title: "48 Hours in Paris: A Perfect Weekend Guide",
            url: "#"
        },
        social: {
            instagram: "https://instagram.com/toureiffelofficielle",
            website: "https://www.toureiffel.paris"
        }
    },
    {
        id: 2,
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
            { type: "image", url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800", caption: "Signature dish presentation" },
            { type: "image", url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800", caption: "Dining room with panoramic views" }
        ],
        tips: [
            "Reservations essential - book 2-3 months ahead",
            "Lunch menu offers better value",
            "Dress code: Smart casual required"
        ],
        relatedArticle: {
            title: "Paris's Most Spectacular Dining Views",
            url: "#"
        },
        social: {
            instagram: "https://instagram.com/lejulesverneparis",
            website: "https://www.lejules-verne.com"
        }
    },
    {
        id: 3,
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
            { type: "image", url: "https://images.unsplash.com/photo-1575385043265-42f10a75ff90?w=800", caption: "Medici Fountain" },
            { type: "image", url: "https://images.unsplash.com/photo-1593277992013-05e17a5f417d?w=800", caption: "Palace and gardens view" },
            { type: "image", url: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800", caption: "Spring blooms" }
        ],
        tips: [
            "Free chairs available throughout the park",
            "Puppet shows for kids on weekends",
            "Best picnic spots near the pond"
        ],
        relatedArticle: {
            title: "Secret Gardens of Paris",
            url: "#"
        },
        social: {
            website: "https://www.senat.fr/visite/jardin/"
        }
    },
    {
        id: 4,
        name: "Louvre Museum",
        description: "The world's largest art museum houses over 35,000 works including the Mona Lisa, Venus de Milo, and countless treasures spanning 9,000 years of history.",
        category: "museum",
        icon: "🏛️",
        rating: 4.9,
        lat: 48.8606,
        lng: 2.3376,
        price: 17,
        hours: { open: "09:00", close: "18:00" },
        author: {
            name: "David Laurent",
            avatar: "https://i.pravatar.cc/100?img=7"
        },
        media: [
            { type: "image", url: "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=800", caption: "Glass pyramid entrance" },
            { type: "image", url: "https://images.unsplash.com/photo-1555999017-8e320096c893?w=800", caption: "Gallery halls" },
            { type: "video", url: "https://cdn.pixabay.com/vimeo/846439422/louvre-175396.mp4?width=640&hash=8f2e8d4f4c0e9c0b0f9f8d4f4c0e9c0b0f9f8d4f", thumbnail: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=800" }
        ],
        tips: [
            "Wednesday and Friday open until 9:45 PM",
            "Free admission first Sunday of each month",
            "Download the official app for audio guides"
        ],
        relatedArticle: {
            title: "Louvre Masterpieces: What Not to Miss",
            url: "#"
        },
        social: {
            instagram: "https://instagram.com/museelouvre",
            website: "https://www.louvre.fr"
        }
    },
    {
        id: 5,
        name: "Champs-Élysées",
        description: "The most famous avenue in the world stretches 1.9km from Place de la Concorde to Arc de Triomphe, lined with luxury boutiques, cafes, and theaters.",
        category: "shopping",
        icon: "🛍️",
        rating: 4.5,
        lat: 48.8698,
        lng: 2.3078,
        price: 0,
        hours: { open: "10:00", close: "20:00" },
        author: {
            name: "Claire Dubois",
            avatar: "https://i.pravatar.cc/100?img=9"
        },
        media: [
            { type: "image", url: "https://images.unsplash.com/photo-1509439507567-fb5c088bb16f?w=800", caption: "Evening lights on the avenue" },
            { type: "image", url: "https://images.unsplash.com/photo-1550340499-a6c60fc8287c?w=800", caption: "Arc de Triomphe view" }
        ],
        tips: [
            "Best shopping between George V and Franklin Roosevelt",
            "Christmas lights from November to January",
            "Side streets offer better dining options"
        ],
        relatedArticle: {
            title: "Shopping in Paris: From Haute Couture to Hidden Boutiques",
            url: "#"
        },
        social: {
            website: "https://www.paris.fr"
        }
    }
];

// Sample data for loading
const sampleSpots = [
    {
        name: "Sacré-Cœur",
        description: "Perched atop Montmartre hill, this stunning basilica offers panoramic views of Paris. The white-domed church is a masterpiece of Romano-Byzantine architecture.",
        category: "museum",
        icon: "⛪",
        rating: 4.7,
        lat: 48.8867,
        lng: 2.3431,
        price: 0,
        hours: { open: "06:00", close: "22:30" },
        editorPick: true,
        author: {
            name: "Sample Author",
            avatar: "https://i.pravatar.cc/100?img=10"
        },
        media: [
            { type: "image", url: "https://images.unsplash.com/photo-1590655209636-118c1b667530?w=800", caption: "Sacré-Cœur facade" }
        ],
        tips: ["Climb the dome for 360° views", "Visit at sunset for best photos"],
        social: { website: "http://www.sacre-coeur-montmartre.com" }
    },
    {
        name: "Musée d'Orsay",
        description: "Housed in a beautiful Beaux-Arts railway station, this museum features the world's finest collection of Impressionist and Post-Impressionist masterpieces.",
        category: "museum",
        icon: "🎨",
        rating: 4.8,
        lat: 48.8600,
        lng: 2.3266,
        price: 16,
        hours: { open: "09:30", close: "18:00" },
        author: {
            name: "Art Enthusiast",
            avatar: "https://i.pravatar.cc/100?img=11"
        },
        media: [
            { type: "image", url: "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800", caption: "Museum interior" }
        ],
        tips: ["Thursday open until 9:45 PM", "Audio guide included in ticket"],
        social: { website: "https://www.musee-orsay.fr" }
    },
    {
        name: "Marché des Enfants Rouges",
        description: "Paris's oldest covered market dating from 1615. A vibrant food market offering international cuisine from Moroccan to Japanese in a historic setting.",
        category: "restaurant",
        icon: "🥘",
        rating: 4.4,
        lat: 48.8636,
        lng: 2.3629,
        price: 15,
        hours: { open: "08:30", close: "20:00" },
        author: {
            name: "Food Lover",
            avatar: "https://i.pravatar.cc/100?img=12"
        },
        media: [
            { type: "image", url: "https://images.unsplash.com/photo-1555992336-03a23f0c7daf?w=800", caption: "Market stalls" }
        ],
        tips: ["Go early for fresh produce", "Try the Moroccan sandwiches"],
        social: {}
    }
];