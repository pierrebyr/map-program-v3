// api.js - API Client for Frontend

const API = {
    // Base URL from config or default
    BASE_URL: window.APP_CONFIG?.api?.baseUrl || 'https://map-program-v3.onrender.com/api',
    //                                              ↑ Assurez-vous que c'est votre URL Render
    // Request timeout
    TIMEOUT: window.APP_CONFIG?.api?.timeout || 30000,
    
    // Helper to make authenticated requests with retry logic
    request: async function(endpoint, options = {}, retries = 3) {
        const token = Auth.getToken();
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };
        
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);
        finalOptions.signal = controller.signal;
        
        try {
            const response = await fetch(`${this.BASE_URL}${endpoint}`, finalOptions);
            clearTimeout(timeoutId);
            
            const data = await response.json();
            
            if (!response.ok) {
                // Handle specific error codes
                if (response.status === 401) {
                    // Token expired, logout
                    Auth.logout();
                    throw new Error('Session expired. Please login again.');
                }
                
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            
            // Retry logic for network errors
            if (retries > 0 && (error.name === 'AbortError' || error.message === 'Failed to fetch')) {
                console.log(`Retrying request... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.request(endpoint, options, retries - 1);
            }
            
            console.error('API request failed:', error);
            throw error;
        }
    },
    
    // ===== SPOTS API =====
    
    // Get all spots with optional filters (with caching)
    getSpots: async function(filters = {}, useCache = true) {
        const queryParams = new URLSearchParams();
        
        if (filters.category && filters.category !== 'all') {
            queryParams.append('category', filters.category);
        }
        if (filters.search) {
            queryParams.append('search', filters.search);
        }
        if (filters.lat && filters.lng && filters.radius) {
            queryParams.append('lat', filters.lat);
            queryParams.append('lng', filters.lng);
            queryParams.append('radius', filters.radius);
        }
        
        const queryString = queryParams.toString();
        const endpoint = `/spots${queryString ? '?' + queryString : ''}`;
        const cacheKey = `spots_${queryString || 'all'}`;
        
        // Use cache if enabled
        if (useCache && window.Cache) {
            return Cache.withCache(
                cacheKey,
                () => this.request(endpoint),
                APP_CONFIG?.cache?.spotsExpiry / 60000 || 5 // Convert ms to minutes
            );
        }
        
        return this.request(endpoint);
    },
    
    // Get single spot (with caching)
    getSpot: async function(id, useCache = true) {
        const cacheKey = `spot_${id}`;
        
        if (useCache && window.Cache) {
            return Cache.withCache(
                cacheKey,
                () => this.request(`/spots/${id}`),
                APP_CONFIG?.cache?.spotsExpiry / 60000 || 5
            );
        }
        
        return this.request(`/spots/${id}`);
    },
    
    // Create new spot (admin only)
    createSpot: async function(spotData) {
        const result = await this.request('/spots', {
            method: 'POST',
            body: JSON.stringify(spotData)
        });
        
        // Clear spots cache
        if (window.Cache) {
            Cache.clear();
        }
        
        return result;
    },
    
    // Update spot (admin only)
    updateSpot: async function(id, updates) {
        const result = await this.request(`/spots/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        
        // Clear cache for this spot and all spots
        if (window.Cache) {
            Cache.remove(`spot_${id}`);
            Cache.clear(); // Clear all spots cache
        }
        
        return result;
    },
    
    // Delete spot (admin only)
    deleteSpot: async function(id) {
        const result = await this.request(`/spots/${id}`, {
            method: 'DELETE'
        });
        
        // Clear cache
        if (window.Cache) {
            Cache.remove(`spot_${id}`);
            Cache.clear();
        }
        
        return result;
    },
    
    // ===== CATEGORIES API =====
    
    getCategories: async function(useCache = true) {
        if (useCache && window.Cache) {
            return Cache.withCache(
                'categories',
                () => this.request('/categories'),
                APP_CONFIG?.cache?.categoriesExpiry / 60000 || 60
            );
        }
        
        return this.request('/categories');
    },
    
    // ===== USERS API (admin only) =====
    
    getUsers: async function(useCache = true) {
        if (useCache && window.Cache) {
            return Cache.withCache(
                'users',
                () => this.request('/users'),
                APP_CONFIG?.cache?.userExpiry / 60000 || 10
            );
        }
        
        return this.request('/users');
    },
    
    updateUserRole: async function(userId, role) {
        const result = await this.request(`/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        });
        
        // Clear users cache
        if (window.Cache) {
            Cache.remove('users');
        }
        
        return result;
    },
    
    // ===== ACTIVITY LOGS API (admin only) =====
    
    getActivityLogs: async function(limit = 50, offset = 0) {
        return this.request(`/logs?limit=${limit}&offset=${offset}`);
    },
    
    // ===== HEALTH CHECK =====
    
    healthCheck: async function() {
        try {
            const response = await fetch(`${this.BASE_URL}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            return response.ok;
        } catch (error) {
            return false;
        }
    },
    
    // ===== UPLOAD API (for future use) =====
    
    uploadImage: async function(file, onProgress) {
        const formData = new FormData();
        formData.append('image', file);
        
        const token = Auth.getToken();
        
        try {
            const xhr = new XMLHttpRequest();
            
            return new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && onProgress) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            resolve(data);
                        } catch (error) {
                            reject(new Error('Invalid response from server'));
                        }
                    } else {
                        reject(new Error(`Upload failed with status: ${xhr.status}`));
                    }
                });
                
                xhr.addEventListener('error', () => {
                    reject(new Error('Upload failed'));
                });
                
                xhr.addEventListener('abort', () => {
                    reject(new Error('Upload cancelled'));
                });
                
                xhr.open('POST', `${this.BASE_URL}/upload`);
                if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }
                
                xhr.send(formData);
            });
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    },
    
    // ===== HELPER FUNCTIONS =====
    
    // Convert spot data to the format expected by the frontend
    formatSpotForFrontend: function(spot) {
    // Les données viennent DÉJÀ au bon format depuis l'API !
    // On retourne juste l'objet tel quel
    return {
        id: spot.id,
        name: spot.name,
        description: spot.description,
        category: spot.category || 'restaurant',
        icon: spot.icon || '📍',
        rating: spot.rating || 0,
        lat: spot.lat,  // IMPORTANT : c'est déjà "lat", pas "latitude"
        lng: spot.lng,  // IMPORTANT : c'est déjà "lng", pas "longitude"
        price: spot.price || 0,
        editorPick: spot.editorPick || false,
        // On peut ajouter des valeurs par défaut pour les champs manquants
        hours: spot.hours || null,
        media: spot.media || [],
        tips: spot.tips || [],
        author: spot.author || null,
        social: spot.social || {},
        relatedArticle: spot.relatedArticle || null
    };
},
    
    // Format opening hours from database format
    formatOpeningHours: function(dbHours) {
        if (!dbHours || dbHours.length === 0) return null;
        
        // For simplicity, just get today's hours
        const today = new Date().getDay();
        const todayHours = dbHours.find(h => h.day_of_week === today);
        
        if (!todayHours || todayHours.is_closed) return null;
        
        return {
            open: todayHours.open_time.substring(0, 5), // Remove seconds
            close: todayHours.close_time.substring(0, 5)
        };
    },
    
    // Convert frontend spot data to database format
    formatSpotForDatabase: function(spot) {
        return {
            name: spot.name,
            description: spot.description,
            categoryId: this.getCategoryId(spot.category),
            latitude: spot.lat,
            longitude: spot.lng,
            icon: spot.icon,
            rating: spot.rating,
            price: spot.price,
            editorPick: spot.editorPick,
            hours: spot.hours,
            media: spot.media,
            tips: spot.tips,
            social: spot.social,
            relatedArticle: spot.relatedArticle,
            author: spot.author
        };
    },
    
    // Get category ID from slug (would need categories loaded)
    getCategoryId: function(slug) {
        const categoryMap = {
            'restaurant': 1,
            'museum': 2,
            'park': 3,
            'shopping': 4
        };
        return categoryMap[slug] || 1;
    },
    
    // Batch operations for better performance
    batchCreateSpots: async function(spotsArray, onProgress) {
        const total = spotsArray.length;
        const results = {
            success: [],
            failed: []
        };
        
        for (let i = 0; i < total; i++) {
            try {
                const result = await this.createSpot(spotsArray[i]);
                results.success.push(result);
            } catch (error) {
                results.failed.push({
                    spot: spotsArray[i],
                    error: error.message
                });
            }
            
            if (onProgress) {
                onProgress((i + 1) / total * 100, i + 1, total);
            }
        }
        
        return results;
    }
};
// ===== GEOCODING API =====
    
    // Fonction de géocodage
    geocodeAddress: async function(address) {
        try {
            // Utiliser Nominatim (OpenStreetMap) pour le géocodage gratuit
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'LiquidGlassMap/1.0' // Requis par Nominatim
                }
            });
            
            if (!response.ok) {
                throw new Error('Geocoding failed');
            }
            
            const data = await response.json();
            
            if (data.length === 0) {
                throw new Error('Address not found');
            }
            
            const result = data[0];
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                display_name: result.display_name,
                address: {
                    road: result.address?.road,
                    city: result.address?.city || result.address?.town || result.address?.village,
                    state: result.address?.state,
                    country: result.address?.country,
                    postcode: result.address?.postcode
                }
            };
        } catch (error) {
            console.error('Geocoding error:', error);
            throw new Error('Failed to geocode address: ' + error.message);
        }
    },
    
    // Fonction de géocodage inverse (coordonnées vers adresse)
    reverseGeocode: async function(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'LiquidGlassMap/1.0'
                }
            });
            
            if (!response.ok) {
                throw new Error('Reverse geocoding failed');
            }
            
            const data = await response.json();
            
            return {
                display_name: data.display_name,
                address: data.address
            };
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return null;
        }
    },

// Health check on startup
window.addEventListener('load', async () => {
    const isHealthy = await API.healthCheck();
    if (!isHealthy) {
        console.warn('API server is not responding. Some features may not work.');
        if (window.Notifications) {
            Notifications.warning('Server connection issue. Some features may be limited.');
        }
    }
});
// Ajoutez ces fonctions dans votre api.js

// ===== FAVORITES API =====
    
    // Toggle favorite status
    toggleFavorite: async function(spotId) {
        const spot = spots.find(s => s.id === spotId);
        if (!spot) return;
        
        try {
            if (spot.isFavorite) {
                await this.request(`/favorites/${spotId}`, { method: 'DELETE' });
                spot.isFavorite = false;
            } else {
                await this.request(`/favorites/${spotId}`, { method: 'POST' });
                spot.isFavorite = true;
            }
            
            // Mettre à jour l'UI
            if (typeof updateFavoriteUI === 'function') {
                updateFavoriteUI(spotId, spot.isFavorite);
            }
            
            // Clear cache
            if (window.Cache) {
                Cache.clear();
            }
            
            return spot.isFavorite;
        } catch (error) {
            console.error('Toggle favorite error:', error);
            throw error;
        }
    },
    
    // Get user's favorites
    getFavorites: async function() {
        return this.request('/favorites');
    }
};
// Ajoutez ceci dans votre fichier app.js :

// Fonction pour mettre à jour l'UI des favoris
function updateFavoriteUI(spotId, isFavorite) {
    // Mettre à jour le marqueur sur la carte
    markers.forEach(marker => {
        const markerLatLng = marker.getLatLng();
        const spot = spots.find(s => s.id === spotId);
        if (spot && markerLatLng.lat === spot.lat && markerLatLng.lng === spot.lng) {
            const iconClass = `custom-marker ${spot.editorPick ? 'editor-pick' : ''} ${isFavorite ? 'favorite' : ''}`;
            const markerHtml = `<div class="${iconClass}">${spot.icon}${isFavorite ? '<span class="favorite-star">⭐</span>' : ''}</div>`;
            
            marker.setIcon(L.divIcon({
                html: markerHtml,
                className: 'custom-div-icon',
                iconSize: [40, 40],
                iconAnchor: [20, 40],
                popupAnchor: [0, -40]
            }));
        }
    });
    
    // Mettre à jour les cartes
    const card = document.querySelector(`.spot-card[data-spot-id="${spotId}"]`);
    if (card) {
        if (isFavorite) {
            card.classList.add('favorite');
        } else {
            card.classList.remove('favorite');
        }
    }
}

// Fonction pour toggler un favori
async function toggleFavorite(spotId) {
    if (!Auth.isLoggedIn()) {
        Auth.showLoginModal();
        return;
    }
    
    try {
        const isFavorite = await API.toggleFavorite(spotId);
        
        if (window.Notifications) {
            Notifications.success(isFavorite ? 'Added to favorites!' : 'Removed from favorites');
        }
    } catch (error) {
        if (window.Notifications) {
            Notifications.error('Failed to update favorite');
        }
    }
}

// Modifier la fonction createPopupContent pour ajouter le bouton favori
function createPopupContent(spot) {
    const isAdmin = Auth.isAdmin();
    const isLoggedIn = Auth.isLoggedIn();
    
    // ... (code existant) ...
    
    // Ajouter le bouton favori dans les actions
    const favoriteButton = isLoggedIn ? `
        <button class="action-btn ${spot.isFavorite ? 'favorite' : ''}" 
                onclick="toggleFavorite(${spot.id}); return false;">
            <span>${spot.isFavorite ? '❤️' : '🤍'}</span> 
            ${spot.isFavorite ? 'Favorited' : 'Add to Favorites'}
        </button>
    ` : '';
    
    // Modifier la section popup-actions
    const actionsHTML = `
        <div class="popup-actions">
            ${favoriteButton}
            <a href="#" class="action-btn" onclick="getDirections(${spot.lat}, ${spot.lng}); return false;">
                <span>🧭</span> Get Directions
            </a>
            ${spot.relatedArticle ? `
                <a href="${spot.relatedArticle.url}" class="action-btn primary">
                    <span>📖</span> Read Article
                </a>
            ` : ''}
        </div>
    `;
    
    // ... (reste du code) ...
}

// Modifier la fonction renderSpotCards pour ajouter l'indicateur de favori
function renderSpotCards(spotsToRender) {
    const panel = document.getElementById('spotsPanel');
    panel.innerHTML = '';

    spotsToRender.forEach(spot => {
        const card = document.createElement('div');
        card.className = `spot-card ${spot.editorPick ? 'editor-pick' : ''} ${spot.isFavorite ? 'favorite' : ''}`;
        card.setAttribute('data-spot-id', spot.id);
        
        // ... (code existant) ...
        
        // Ajouter l'indicateur de favori
        const favoriteIndicator = spot.isFavorite ? '<span class="favorite-indicator">❤️</span>' : '';
        
        card.innerHTML = `
            ${favoriteIndicator}
            ${adminControls}
            ${spot.editorPick ? '<div class="editor-badge">⭐ Editor\'s Pick</div>' : ''}
            <!-- ... reste du HTML ... -->
        `;
        
        // ... (reste du code) ...
    });
}

// Ajouter un bouton de filtre pour les favoris
function addFavoritesFilter() {
    const filterButtons = document.querySelector('.filter-buttons');
    if (filterButtons && Auth.isLoggedIn()) {
        const favoritesBtn = document.createElement('button');
        favoritesBtn.className = 'filter-btn';
        favoritesBtn.innerHTML = '❤️ My Favorites';
        favoritesBtn.onclick = () => filterFavorites();
        filterButtons.appendChild(favoritesBtn);
    }
}

// Fonction pour filtrer les favoris
async function filterFavorites() {
    if (!Auth.isLoggedIn()) {
        Auth.showLoginModal();
        return;
    }
    
    // Mettre à jour les boutons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    try {
        // Charger uniquement les favoris
        const data = await API.getSpots({ favoritesOnly: true });
        const favoriteSpots = data.spots.map(spot => API.formatSpotForFrontend(spot));
        
        // Mettre à jour la carte et les cartes
        addSpotsToMap(favoriteSpots);
        renderSpotCards(favoriteSpots);
        
        if (favoriteSpots.length === 0 && window.Notifications) {
            Notifications.info('You haven\'t added any favorites yet');
        }
    } catch (error) {
        console.error('Failed to load favorites:', error);
        if (window.Notifications) {
            Notifications.error('Failed to load favorites');
        }
    }
}
// À la fin de api.js, assurez-vous que cette ligne existe :
window.API = API;