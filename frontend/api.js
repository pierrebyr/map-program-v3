// api.js - API Client for Frontend

const API = {
    // Base URL from config or default
    BASE_URL: window.APP_CONFIG?.api?.baseUrl || 'http://localhost:3000/api',
    
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
        return {
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
            hours: spot.openingHours ? this.formatOpeningHours(spot.openingHours) : null,
            media: spot.media || [],
            tips: spot.tips || [],
            author: spot.author_name ? {
                name: spot.author_name,
                avatar: spot.author_avatar
            } : null,
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

// Export for use in other files
window.API = API;

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