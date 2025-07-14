// admin.js - Admin Dashboard Functions

const Admin = {
    // Show admin dashboard
    showDashboard: async function() {
        if (!Auth.isAdmin()) {
            alert('Admin access required');
            return;
        }
        
        const modal = document.getElementById('adminDashboard');
        modal.classList.add('active');
        
        // Load statistics
        await this.loadStats();
    },
    
    // Hide admin dashboard
    hideDashboard: function() {
        const modal = document.getElementById('adminDashboard');
        modal.classList.remove('active');
    },
    
    // Load dashboard statistics
    loadStats: async function() {
        try {
            // Get spots count
            const spotsData = await API.getSpots();
            document.getElementById('totalSpots').textContent = spotsData.spots.length;
            
            // Get users count (admin only)
            const usersData = await API.getUsers();
            document.getElementById('totalUsers').textContent = usersData.users.length;
            
            // Get recent activities
            const logsData = await API.getActivityLogs(10);
            document.getElementById('recentActivities').textContent = logsData.logs.length;
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },
    
    // Show user management section
    showUserManagement: async function() {
        const content = document.getElementById('adminContent');
        content.innerHTML = '<div class="loading-ring"></div>';
        
        try {
            const data = await API.getUsers();
            
            let html = `
                <h3>User Management</h3>
                <div class="admin-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Last Login</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.users.forEach(user => {
                const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';
                html += `
                    <tr>
                        <td>${user.email}</td>
                        <td>${user.full_name || '-'}</td>
                        <td>
                            <select onchange="Admin.updateUserRole(${user.id}, this.value)" 
                                    ${user.id === Auth.currentUser.id ? 'disabled' : ''}>
                                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </td>
                        <td>
                            <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                                ${user.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>${lastLogin}</td>
                        <td>
                            <button class="small-btn" onclick="Admin.toggleUserStatus(${user.id}, ${!user.is_active})"
                                    ${user.id === Auth.currentUser.id ? 'disabled' : ''}>
                                ${user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            content.innerHTML = html;
        } catch (error) {
            content.innerHTML = `<p class="error">Failed to load users: ${error.message}</p>`;
        }
    },
    
    // Update user role
    updateUserRole: async function(userId, newRole) {
        if (!confirm(`Change user role to ${newRole}?`)) {
            // Revert select
            this.showUserManagement();
            return;
        }
        
        try {
            await API.updateUserRole(userId, newRole);
            alert('User role updated successfully');
        } catch (error) {
            alert('Failed to update user role: ' + error.message);
            this.showUserManagement();
        }
    },
    
    // Show activity logs
    showActivityLogs: async function() {
        const content = document.getElementById('adminContent');
        content.innerHTML = '<div class="loading-ring"></div>';
        
        try {
            const data = await API.getActivityLogs(50);
            
            let html = `
                <h3>Recent Activity Logs</h3>
                <div class="admin-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Entity</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.logs.forEach(log => {
                const date = new Date(log.created_at).toLocaleString();
                const details = log.details ? JSON.parse(log.details) : {};
                html += `
                    <tr>
                        <td>${date}</td>
                        <td>${log.email || 'System'}</td>
                        <td><span class="action-badge ${log.action}">${log.action}</span></td>
                        <td>${log.entity_type || '-'}</td>
                        <td>${this.formatLogDetails(details)}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            content.innerHTML = html;
        } catch (error) {
            content.innerHTML = `<p class="error">Failed to load logs: ${error.message}</p>`;
        }
    },
    
    // Format log details for display
    formatLogDetails: function(details) {
        if (!details || Object.keys(details).length === 0) return '-';
        
        // Show only important fields
        const important = ['name', 'email', 'role', 'category'];
        const filtered = Object.entries(details)
            .filter(([key]) => important.includes(key))
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        
        return filtered || '-';
    },
    
    // Show spot management
    showSpotManagement: function() {
        const content = document.getElementById('adminContent');
        content.innerHTML = `
            <h3>Spot Management</h3>
            <p>Use the main map interface to manage spots. Admin controls are visible on each spot.</p>
            <button class="submit-btn" onclick="Admin.hideDashboard()">Go to Map</button>
        `;
    },
    
    // Edit spot (from map popup)
    editSpot: async function(spotId) {
        const spot = spots.find(s => s.id === spotId);
        if (!spot) return;
        
        // Create edit form in modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal edit-spot-modal">
                <button class="modal-close" onclick="this.parentElement.parentElement.remove()">×</button>
                <h2>Edit Spot</h2>
                <form id="editSpotForm" onsubmit="Admin.handleEditSpot(event, ${spotId})">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" name="name" value="${spot.name}" required class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" rows="3" class="form-input">${spot.description}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select name="category" class="form-input">
                            <option value="restaurant" ${spot.category === 'restaurant' ? 'selected' : ''}>Restaurant</option>
                            <option value="museum" ${spot.category === 'museum' ? 'selected' : ''}>Museum</option>
                            <option value="park" ${spot.category === 'park' ? 'selected' : ''}>Park</option>
                            <option value="shopping" ${spot.category === 'shopping' ? 'selected' : ''}>Shopping</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Price</label>
                        <input type="number" name="price" value="${spot.price || 0}" min="0" step="0.01" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Rating</label>
                        <input type="number" name="rating" value="${spot.rating}" min="0" max="5" step="0.1" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="editorPick" ${spot.editorPick ? 'checked' : ''}>
                            Editor's Pick
                        </label>
                    </div>
                    <button type="submit" class="submit-btn">Save Changes</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    // Handle edit spot form submission
    handleEditSpot: async function(event, spotId) {
        event.preventDefault();
        
        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        const updates = {
            name: form.name.value,
            description: form.description.value,
            categoryId: API.getCategoryId(form.category.value),
            price: parseFloat(form.price.value),
            rating: parseFloat(form.rating.value),
            editorPick: form.editorPick.checked
        };
        
        try {
            await API.updateSpot(spotId, updates);
            alert('Spot updated successfully');
            
            // Remove modal
            form.closest('.modal-overlay').remove();
            
            // Reload spots
            window.location.reload();
        } catch (error) {
            alert('Failed to update spot: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Changes';
        }
    },
    
    // Delete spot
    deleteSpot: async function(spotId) {
        const spot = spots.find(s => s.id === spotId);
        if (!spot) return;
        
        if (!confirm(`Are you sure you want to delete "${spot.name}"?`)) {
            return;
        }
        
        try {
            await API.deleteSpot(spotId);
            alert('Spot deleted successfully');
            
            // Reload spots
            window.location.reload();
        } catch (error) {
            alert('Failed to delete spot: ' + error.message);
        }
    },
    
    // Add admin controls to spot card
    addSpotControls: function(spotElement, spotId) {
        if (!Auth.isAdmin()) return;
        
        const controls = document.createElement('div');
        controls.className = 'admin-controls';
        controls.innerHTML = `
            <button class="admin-control-btn edit" onclick="Admin.editSpot(${spotId})" title="Edit">
                ✏️
            </button>
            <button class="admin-control-btn delete" onclick="Admin.deleteSpot(${spotId})" title="Delete">
                🗑️
            </button>
        `;
        
        spotElement.appendChild(controls);
    }
};

// Make functions globally accessible
window.showAdminDashboard = () => Admin.showDashboard();
window.hideAdminDashboard = () => Admin.hideDashboard();
window.showUserManagement = () => Admin.showUserManagement();
window.showActivityLogs = () => Admin.showActivityLogs();
window.showSpotManagement = () => Admin.showSpotManagement();
window.Admin = Admin;