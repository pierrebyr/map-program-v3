// notifications.js - Notification System

const Notifications = {
    // Container element
    container: null,
    
    // Queue for notifications
    queue: [],
    
    // Initialize notification system
    init: function() {
        // Create container if it doesn't exist
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    },
    
    // Show notification
    show: function(message, type = 'info', duration = 4000) {
        this.init();
        
        const notification = {
            id: Date.now(),
            message: message,
            type: type,
            duration: duration
        };
        
        // Add to queue
        this.queue.push(notification);
        
        // Create notification element
        const element = this.createElement(notification);
        this.container.appendChild(element);
        
        // Animate in
        setTimeout(() => {
            element.classList.add('show');
        }, 10);
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                this.remove(notification.id);
            }, duration);
        }
        
        return notification.id;
    },
    
    // Create notification element
    createElement: function(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type}`;
        element.id = `notification-${notification.id}`;
        
        // Icon based on type
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        element.innerHTML = `
            <span class="notification-icon">${icons[notification.type] || icons.info}</span>
            <span class="notification-message">${notification.message}</span>
            <button class="notification-close" onclick="Notifications.remove(${notification.id})">×</button>
        `;
        
        return element;
    },
    
    // Remove notification
    remove: function(id) {
        const element = document.getElementById(`notification-${id}`);
        if (!element) return;
        
        // Animate out
        element.classList.remove('show');
        element.classList.add('hide');
        
        // Remove from DOM
        setTimeout(() => {
            element.remove();
        }, 300);
        
        // Remove from queue
        this.queue = this.queue.filter(n => n.id !== id);
    },
    
    // Clear all notifications
    clear: function() {
        this.queue.forEach(notification => {
            this.remove(notification.id);
        });
        this.queue = [];
    },
    
    // Convenience methods
    success: function(message, duration) {
        return this.show(message, 'success', duration);
    },
    
    error: function(message, duration) {
        return this.show(message, 'error', duration || 6000);
    },
    
    warning: function(message, duration) {
        return this.show(message, 'warning', duration || 5000);
    },
    
    info: function(message, duration) {
        return this.show(message, 'info', duration);
    },
    
    // Show loading notification
    loading: function(message = 'Loading...') {
        const id = this.show(`
            <div class="notification-loading">
                <div class="loading-spinner"></div>
                <span>${message}</span>
            </div>
        `, 'info', 0);
        
        return {
            id: id,
            update: (newMessage) => {
                const element = document.querySelector(`#notification-${id} .notification-message`);
                if (element) {
                    element.innerHTML = `
                        <div class="notification-loading">
                            <div class="loading-spinner"></div>
                            <span>${newMessage}</span>
                        </div>
                    `;
                }
            },
            success: (message) => {
                this.remove(id);
                this.success(message);
            },
            error: (message) => {
                this.remove(id);
                this.error(message);
            },
            close: () => {
                this.remove(id);
            }
        };
    },
    
    // Confirm dialog
    confirm: function(message, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'notification-confirm-overlay';
        modal.innerHTML = `
            <div class="notification-confirm">
                <h3>Confirm</h3>
                <p>${message}</p>
                <div class="confirm-buttons">
                    <button class="confirm-btn cancel">Cancel</button>
                    <button class="confirm-btn confirm">Confirm</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add animation
        setTimeout(() => modal.classList.add('show'), 10);
        
        // Handle buttons
        const confirmBtn = modal.querySelector('.confirm');
        const cancelBtn = modal.querySelector('.cancel');
        
        const close = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        };
        
        confirmBtn.onclick = () => {
            close();
            if (onConfirm) onConfirm();
        };
        
        cancelBtn.onclick = () => {
            close();
            if (onCancel) onCancel();
        };
        
        // Close on overlay click
        modal.onclick = (e) => {
            if (e.target === modal) {
                close();
                if (onCancel) onCancel();
            }
        };
    }
};

// Export for use
window.Notifications = Notifications;

// Add notification styles
const notificationStyles = `
<style>
.notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
}

.notification {
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 300px;
    max-width: 500px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    transform: translateX(400px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: all;
}

.notification.show {
    transform: translateX(0);
}

.notification.hide {
    transform: translateX(400px);
    opacity: 0;
}

.notification-icon {
    font-size: 20px;
    flex-shrink: 0;
}

.notification-message {
    flex: 1;
    color: white;
    font-size: 14px;
    line-height: 1.4;
}

.notification-close {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.notification-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.notification-success {
    border-color: var(--success);
}

.notification-error {
    border-color: #FF3B30;
}

.notification-warning {
    border-color: var(--warning);
}

.notification-info {
    border-color: var(--primary);
}

.notification-loading {
    display: flex;
    align-items: center;
    gap: 12px;
}

.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.notification-confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(5px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.notification-confirm-overlay.show {
    opacity: 1;
}

.notification-confirm {
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    padding: 24px;
    min-width: 320px;
    max-width: 400px;
    transform: scale(0.9);
    transition: transform 0.3s ease;
}

.notification-confirm-overlay.show .notification-confirm {
    transform: scale(1);
}

.notification-confirm h3 {
    color: white;
    margin: 0 0 16px 0;
    font-size: 20px;
}

.notification-confirm p {
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 24px 0;
    line-height: 1.5;
}

.confirm-buttons {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.confirm-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 10px 20px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.confirm-btn:hover {
    background: rgba(255, 255, 255, 0.2);
}

.confirm-btn.confirm {
    background: var(--primary);
    border-color: var(--primary);
}

.confirm-btn.confirm:hover {
    background: #0066dd;
}

@media (max-width: 768px) {
    .notification-container {
        left: 10px;
        right: 10px;
        top: 10px;
    }
    
    .notification {
        min-width: auto;
        transform: translateY(-100px);
    }
    
    .notification.show {
        transform: translateY(0);
    }
    
    .notification.hide {
        transform: translateY(-100px);
    }
}
</style>
`;

// Add styles to document
document.addEventListener('DOMContentLoaded', () => {
    const styleElement = document.createElement('div');
    styleElement.innerHTML = notificationStyles;
    document.head.appendChild(styleElement.firstElementChild);
});