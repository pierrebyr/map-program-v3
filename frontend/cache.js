// cache.js - Frontend Cache System

const Cache = {
    // Cache storage prefix
    PREFIX: 'lgm_cache_',
    
    // Get cache key with prefix
    getKey: function(key) {
        return this.PREFIX + key;
    },
    
    // Set cache with expiration
    set: function(key, data, expiryMinutes = 5) {
        try {
            const cacheData = {
                data: data,
                expiry: Date.now() + (expiryMinutes * 60 * 1000),
                timestamp: Date.now()
            };
            
            localStorage.setItem(this.getKey(key), JSON.stringify(cacheData));
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            // Clear old cache if storage is full
            this.clearExpired();
            return false;
        }
    },
    
    // Get from cache
    get: function(key) {
        try {
            const cached = localStorage.getItem(this.getKey(key));
            if (!cached) return null;
            
            const cacheData = JSON.parse(cached);
            
            // Check if expired
            if (Date.now() > cacheData.expiry) {
                this.remove(key);
                return null;
            }
            
            return cacheData.data;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    },
    
    // Remove from cache
    remove: function(key) {
        try {
            localStorage.removeItem(this.getKey(key));
            return true;
        } catch (error) {
            console.error('Cache remove error:', error);
            return false;
        }
    },
    
    // Clear all cache
    clear: function() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Cache clear error:', error);
            return false;
        }
    },
    
    // Clear expired items
    clearExpired: function() {
        try {
            const keys = Object.keys(localStorage);
            const now = Date.now();
            let cleared = 0;
            
            keys.forEach(key => {
                if (key.startsWith(this.PREFIX)) {
                    try {
                        const cached = JSON.parse(localStorage.getItem(key));
                        if (cached.expiry && now > cached.expiry) {
                            localStorage.removeItem(key);
                            cleared++;
                        }
                    } catch (e) {
                        // Invalid cache item, remove it
                        localStorage.removeItem(key);
                        cleared++;
                    }
                }
            });
            
            console.log(`Cleared ${cleared} expired cache items`);
            return cleared;
        } catch (error) {
            console.error('Clear expired error:', error);
            return 0;
        }
    },
    
    // Get cache size
    getSize: function() {
        let size = 0;
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith(this.PREFIX)) {
                size += localStorage.getItem(key).length;
            }
        });
        
        return size;
    },
    
    // Get cache statistics
    getStats: function() {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(key => key.startsWith(this.PREFIX));
        const now = Date.now();
        let expired = 0;
        let valid = 0;
        
        cacheKeys.forEach(key => {
            try {
                const cached = JSON.parse(localStorage.getItem(key));
                if (cached.expiry && now > cached.expiry) {
                    expired++;
                } else {
                    valid++;
                }
            } catch (e) {
                expired++;
            }
        });
        
        return {
            total: cacheKeys.length,
            valid: valid,
            expired: expired,
            sizeKB: Math.round(this.getSize() / 1024)
        };
    },
    
    // Cache with promise wrapper
    withCache: async function(key, fetchFunction, expiryMinutes = 5) {
        // Check cache first
        const cached = this.get(key);
        if (cached !== null) {
            console.log(`Cache hit for ${key}`);
            return cached;
        }
        
        console.log(`Cache miss for ${key}, fetching...`);
        
        try {
            // Fetch fresh data
            const data = await fetchFunction();
            
            // Store in cache
            this.set(key, data, expiryMinutes);
            
            return data;
        } catch (error) {
            console.error('Cache fetch error:', error);
            throw error;
        }
    }
};

// Auto-clear expired items on load
window.addEventListener('load', () => {
    Cache.clearExpired();
});

// Clear expired items periodically
setInterval(() => {
    Cache.clearExpired();
}, 5 * 60 * 1000); // Every 5 minutes

// Export for use
window.Cache = Cache;