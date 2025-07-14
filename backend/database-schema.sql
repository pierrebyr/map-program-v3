-- Création de la base de données
CREATE DATABASE IF NOT EXISTS liquid_glass_map;
USE liquid_glass_map;

-- Table des utilisateurs
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('user', 'admin') DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Table des catégories
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    color VARCHAR(7), -- Hex color
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_slug (slug)
);

-- Table des spots (lieux)
CREATE TABLE spots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    icon VARCHAR(10),
    rating DECIMAL(2, 1) DEFAULT 0,
    price DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'EUR',
    editor_pick BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by INT,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_location (latitude, longitude),
    INDEX idx_category (category_id),
    INDEX idx_active (is_active)
);

-- Table des heures d'ouverture
CREATE TABLE opening_hours (
    id INT PRIMARY KEY AUTO_INCREMENT,
    spot_id INT NOT NULL,
    day_of_week TINYINT NOT NULL, -- 0=Sunday, 1=Monday, etc.
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN DEFAULT false,
    FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE,
    UNIQUE KEY unique_spot_day (spot_id, day_of_week)
);

-- Table des médias
CREATE TABLE media (
    id INT PRIMARY KEY AUTO_INCREMENT,
    spot_id INT NOT NULL,
    type ENUM('image', 'video') NOT NULL,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    caption VARCHAR(255),
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE,
    INDEX idx_spot_order (spot_id, display_order)
);

-- Table des conseils (tips)
CREATE TABLE tips (
    id INT PRIMARY KEY AUTO_INCREMENT,
    spot_id INT NOT NULL,
    tip_text VARCHAR(500) NOT NULL,
    display_order INT DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_spot (spot_id)
);

-- Table des liens sociaux
CREATE TABLE social_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    spot_id INT NOT NULL,
    platform VARCHAR(50) NOT NULL, -- instagram, website, facebook, etc.
    url VARCHAR(500) NOT NULL,
    FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE,
    UNIQUE KEY unique_spot_platform (spot_id, platform)
);

-- Table des articles liés
CREATE TABLE related_articles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    spot_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    published_date DATE,
    FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE
);

-- Table des auteurs
CREATE TABLE authors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    spot_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    bio TEXT,
    FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE
);

-- Table des logs d'activité (pour audit)
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
    entity_type VARCHAR(50), -- 'spot', 'user', etc.
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_action (user_id, action),
    INDEX idx_created (created_at)
);

-- Table des sessions (pour gestion des tokens)
CREATE TABLE user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token_hash),
    INDEX idx_expires (expires_at)
);

-- Insertion des catégories par défaut
INSERT INTO categories (slug, name, icon) VALUES
('restaurant', 'Food', '🍽️'),
('museum', 'Culture', '🏛️'),
('park', 'Nature', '🌳'),
('shopping', 'Shopping', '🛍️');

-- Création d'un utilisateur admin par défaut (mot de passe: admin123)
-- Note: Le hash est pour bcrypt avec un salt de 10
INSERT INTO users (email, password_hash, full_name, role) VALUES
('admin@example.com', '$2b$10$YourHashHere', 'Admin User', 'admin');

-- Vue pour les spots avec toutes leurs informations
CREATE VIEW spots_full AS
SELECT 
    s.*,
    c.name as category_name,
    c.icon as category_icon,
    c.slug as category_slug,
    u1.full_name as created_by_name,
    u2.full_name as updated_by_name,
    GROUP_CONCAT(DISTINCT m.url) as media_urls,
    GROUP_CONCAT(DISTINCT t.tip_text) as tips
FROM spots s
LEFT JOIN categories c ON s.category_id = c.id
LEFT JOIN users u1 ON s.created_by = u1.id
LEFT JOIN users u2 ON s.updated_by = u2.id
LEFT JOIN media m ON s.id = m.spot_id
LEFT JOIN tips t ON s.id = t.spot_id
WHERE s.is_active = true
GROUP BY s.id;