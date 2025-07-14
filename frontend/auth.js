// auth.js - Frontend Authentication System

const Auth = {
    // API configuration
    API_BASE_URL: window.APP_CONFIG?.api?.baseUrl || 'http://localhost:3000/api',
    
    // Storage keys
    TOKEN_KEY: 'auth_token',
    USER_KEY: 'auth_user',
    
    // Current user state
    currentUser: null,
    
    // Initialize authentication
    init: async function() {
        const token = this.getToken();
        const user = this.getStoredUser();
        
        if (token && user) {
            this.currentUser = user;
            this.setAuthHeader(token);
            
            // Verify token is still valid
            try {
                const response = await this.verifyToken();
                if (response.user) {
                    this.currentUser = response.user;
                    this.updateStoredUser(response.user);
                }
            } catch (error) {
                // Token invalid, clear auth
                this.logout();
            }
        }
        
        this.updateUI();
    },
    
    // Get stored token
    getToken: function() {
        return localStorage.getItem(this.TOKEN_KEY);
    },
    
    // Get stored user
    getStoredUser: function() {
        const userStr = localStorage.getItem(this.USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
    },
    
    // Set auth header for API requests
    setAuthHeader: function(token) {
        if (window.fetch) {
            // Override fetch to include auth header
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                if (args[0].startsWith(Auth.API_BASE_URL)) {
                    args[1] = args[1] || {};
                    args[1].headers = {
                        ...args[1].headers,
                        'Authorization': `Bearer ${token}`
                    };
                }
                return originalFetch.apply(this, args);
            };
        }
    },
    
    // Store auth data
    storeAuth: function(token, user) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUser = user;
        this.setAuthHeader(token);
    },
    
    // Update stored user
    updateStoredUser: function(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUser = user;
    },
    
    // Clear auth data
    clearAuth: function() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.currentUser = null;
    },
    
    // Login
    login: async function(email, password) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }
            
            this.storeAuth(data.token, data.user);
            this.updateUI();
            
            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Register
    register: async function(email, password, fullName) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, fullName })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }
            
            this.storeAuth(data.token, data.user);
            this.updateUI();
            
            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Logout
    logout: async function() {
        const token = this.getToken();
        
        if (token) {
            try {
                await fetch(`${this.API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
        
        this.clearAuth();
        this.updateUI();
        window.location.reload();
    },
    
    // Verify token
    verifyToken: async function() {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('No token');
        }
        
        const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        return await response.json();
    },
    
    // Check if user is logged in
    isLoggedIn: function() {
        return !!this.currentUser && !!this.getToken();
    },
    
    // Check if user is admin
    isAdmin: function() {
        return this.currentUser && this.currentUser.role === 'admin';
    },
    
    // Update UI based on auth state
    updateUI: function() {
        const isLoggedIn = this.isLoggedIn();
        const isAdmin = this.isAdmin();
        
        // Update auth buttons
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const userInfo = document.getElementById('userInfo');
        const adminPanel = document.getElementById('adminPanel');
        
        if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : 'flex';
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'flex' : 'none';
        
        if (userInfo && isLoggedIn) {
            userInfo.style.display = 'flex';
            userInfo.querySelector('.user-email').textContent = this.currentUser.email;
            userInfo.querySelector('.user-role').textContent = this.currentUser.role;
        } else if (userInfo) {
            userInfo.style.display = 'none';
        }
        
        // Show/hide admin features
        if (adminPanel) {
            adminPanel.style.display = isAdmin ? 'flex' : 'none';
        }
        
        // Show/hide admin controls on spots
        document.querySelectorAll('.admin-controls').forEach(el => {
            el.style.display = isAdmin ? 'flex' : 'none';
        });
        
        // Update data management button
        const dataBtn = document.querySelector('.data-toggle-btn');
        if (dataBtn) {
            dataBtn.style.display = isAdmin ? 'flex' : 'none';
        }
    },
    
    // Show login modal
    showLoginModal: function() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.add('active');
            this.switchAuthTab('login');
        }
    },
    
    // Hide login modal
    hideLoginModal: function() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.remove('active');
        }
    },
    
    // Switch auth tab
    switchAuthTab: function(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        
        document.querySelector(`.auth-tab[data-tab="${tab}"]`)?.classList.add('active');
        document.getElementById(`${tab}Form`)?.classList.add('active');
    },
    
    // Handle login form submission
    handleLogin: async function(event) {
        event.preventDefault();
        
        const form = event.target;
        const email = form.email.value;
        const password = form.password.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        const errorMsg = form.querySelector('.error-message');
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        
        // Clear previous errors
        if (errorMsg) errorMsg.style.display = 'none';
        
        const result = await this.login(email, password);
        
        if (result.success) {
            this.hideLoginModal();
            // Reload to get fresh data with auth
            window.location.reload();
        } else {
            if (errorMsg) {
                errorMsg.textContent = result.error;
                errorMsg.style.display = 'block';
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    },
    
    // Handle register form submission
    handleRegister: async function(event) {
        event.preventDefault();
        
        const form = event.target;
        const email = form.email.value;
        const password = form.password.value;
        const confirmPassword = form.confirmPassword.value;
        const fullName = form.fullName.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        const errorMsg = form.querySelector('.error-message');
        
        // Clear previous errors
        if (errorMsg) errorMsg.style.display = 'none';
        
        // Validate passwords match
        if (password !== confirmPassword) {
            if (errorMsg) {
                errorMsg.textContent = 'Passwords do not match';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        // Validate password length
        if (password.length < 6) {
            if (errorMsg) {
                errorMsg.textContent = 'Password must be at least 6 characters';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';
        
        const result = await this.register(email, password, fullName);
        
        if (result.success) {
            this.hideLoginModal();
            // Reload to get fresh data with auth
            window.location.reload();
        } else {
            if (errorMsg) {
                errorMsg.textContent = result.error;
                errorMsg.style.display = 'block';
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    }
};

// Export for use in other files
window.Auth = Auth;