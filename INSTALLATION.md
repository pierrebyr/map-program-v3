# Installation Guide - Liquid Glass Map with Database & Authentication

## Architecture Overview

This system consists of:
- **Frontend**: HTML/CSS/JS application with authentication
- **Backend**: Node.js/Express API server
- **Database**: MySQL for data storage
- **Authentication**: JWT-based auth system

## Prerequisites

1. **Node.js** (v14 or higher)
2. **MySQL** (v5.7 or higher)
3. **Git** (optional)

## Step 1: Database Setup

### 1.1 Install MySQL

**Windows:**
- Download MySQL installer from https://dev.mysql.com/downloads/installer/
- Run installer and follow the setup wizard
- Set a root password (remember it!)

**Mac:**
```bash
brew install mysql
brew services start mysql
mysql_secure_installation
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

### 1.2 Create Database

1. Login to MySQL:
```bash
mysql -u root -p
```

2. Create the database:
```sql
CREATE DATABASE liquid_glass_map;
USE liquid_glass_map;
```

3. Run the schema (copy content from `database-schema.sql`):
```sql
-- Paste all the SQL from database-schema.sql here
```

4. Create a database user (optional but recommended):
```sql
CREATE USER 'mapuser'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON liquid_glass_map.* TO 'mapuser'@'localhost';
FLUSH PRIVILEGES;
```

## Step 2: Backend Setup

### 2.1 Create Backend Directory

```bash
mkdir liquid-glass-map-system
cd liquid-glass-map-system
mkdir backend
cd backend
```

### 2.2 Initialize Node.js Project

```bash
npm init -y
```

### 2.3 Create Backend Files

Create these files in the `backend` directory:
- `package.json` (copy from backend/package.json artifact)
- `server.js` (copy from server.js artifact)
- `.env` (copy from .env.example and update values)

### 2.4 Install Dependencies

```bash
npm install
```

### 2.5 Configure Environment

Create `.env` file:
```env
PORT=3000
NODE_ENV=development

# Database - Update these!
DB_HOST=localhost
DB_USER=mapuser
DB_PASSWORD=your_secure_password
DB_NAME=liquid_glass_map

# JWT - Change this to a random string!
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=24h

# Frontend URL
FRONTEND_URL=http://localhost:8000

# Security
BCRYPT_ROUNDS=10
```

### 2.6 Create Default Admin User

1. Generate a password hash:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(hash => console.log(hash));"
```

2. Update the admin user in database:
```sql
UPDATE users SET password_hash = 'YOUR_GENERATED_HASH' WHERE email = 'admin@example.com';
```

### 2.7 Start Backend Server

```bash
# Development
npm run dev

# Production
npm start
```

The API should now be running at `http://localhost:3000`

## Step 3: Frontend Setup

### 3.1 Create Frontend Directory

```bash
cd ..  # Back to liquid-glass-map-system
mkdir frontend
cd frontend
```

### 3.2 Create Frontend Files

Create all these files in the `frontend` directory:
- `index.html`
- `styles.css`
- `config.js`
- `utils.js`
- `auth.js`
- `api.js`
- `data.js`
- `app.js`
- `admin.js`

### 3.3 Update Configuration

Edit `config.js`:
```javascript
api: {
    baseUrl: 'http://localhost:3000/api'  // Your backend URL
}
```

Edit `api.js`:
```javascript
BASE_URL: window.APP_CONFIG?.api?.baseUrl || 'http://localhost:3000/api'
```

### 3.4 Serve Frontend

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server -p 8000

# Using PHP
php -S localhost:8000
```

## Step 4: First Login

1. Open browser to `http://localhost:8000`
2. Click "Login" button
3. Use default admin credentials:
   - Email: `admin@example.com`
   - Password: `admin123`
4. **IMPORTANT**: Change the admin password immediately!

## Step 5: Data Migration

### 5.1 Import Existing Data

If you have existing JSON data:

```javascript
// Create a migration script: migrate.js
const mysql = require('mysql2/promise');
const fs = require('fs');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'mapuser',
        password: 'your_password',
        database: 'liquid_glass_map'
    });

    // Read your existing data
    const data = JSON.parse(fs.readFileSync('your-data.json'));

    for (const spot of data) {
        // Insert spot
        const [result] = await connection.execute(
            'INSERT INTO spots (name, description, latitude, longitude) VALUES (?, ?, ?, ?)',
            [spot.name, spot.description, spot.lat, spot.lng]
        );
        
        // Insert related data...
    }

    await connection.end();
}

migrate();
```

## Step 6: Production Deployment

### 6.1 Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secret
- [ ] Enable HTTPS
- [ ] Set up firewall rules
- [ ] Use environment variables for sensitive data
- [ ] Enable rate limiting
- [ ] Set up backup strategy

### 6.2 Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start backend
cd backend
pm2 start server.js --name liquid-glass-api

# Save PM2 config
pm2 save
pm2 startup
```

### 6.3 Nginx Configuration

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/frontend;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Step 7: Backup Strategy

### 7.1 Database Backup

Create a backup script:
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u mapuser -p liquid_glass_map > backup_$DATE.sql
```

### 7.2 Automated Backups

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup.sh
```

## Troubleshooting

### Database Connection Error
- Check MySQL is running: `sudo service mysql status`
- Verify credentials in `.env`
- Check firewall settings

### CORS Errors
- Ensure `FRONTEND_URL` in `.env` matches your frontend URL
- Check browser console for specific errors

### Authentication Issues
- Verify JWT_SECRET is set
- Check token expiration
- Clear browser localStorage

### Performance Issues
- Add indexes to database (already included in schema)
- Enable query caching in MySQL
- Use CDN for static assets

## Admin Features

### User Management
1. Login as admin
2. Click "Admin" button
3. Go to "Manage Users"
4. Change roles or deactivate users

### Spot Management
1. Admins see edit/delete buttons on each spot
2. Use "Manage Data" to import/export
3. Activity logs track all changes

### Security Features
- Password hashing with bcrypt
- JWT token expiration
- Rate limiting on auth endpoints
- Activity logging for audit trail

## Next Steps

1. **SSL Certificate**: Use Let's Encrypt for HTTPS
2. **Monitoring**: Set up logging and monitoring
3. **Backups**: Implement automated backup strategy
4. **CDN**: Use CloudFlare or similar for assets
5. **Email**: Configure email for password resets

## Support

For issues:
1. Check server logs: `pm2 logs`
2. Check browser console
3. Verify all services are running
4. Review error messages in network tab

Remember to:
- Keep dependencies updated
- Monitor security advisories
- Regular backups
- Test restore procedures