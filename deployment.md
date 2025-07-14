# Complete Deployment Guide

## Quick Start with Docker

### 1. Prerequisites
- Docker and Docker Compose installed
- Domain name (optional)
- SSL certificate (optional)

### 2. Clone or Create Project Structure
```bash
liquid-glass-map/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── Dockerfile
│   ├── .env
│   └── database-schema.sql
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── config.js
│   ├── utils.js
│   ├── cache.js
│   ├── notifications.js
│   ├── auth.js
│   ├── api.js
│   ├── data.js
│   ├── app.js
│   └── admin.js
├── docker-compose.yml
├── nginx.conf
└── .env
```

### 3. Configure Environment
Create `.env` file in root:
```bash
# MySQL Configuration
MYSQL_ROOT_PASSWORD=strongrootpassword
DB_NAME=liquid_glass_map
DB_USER=mapuser
DB_PASSWORD=strongdbpassword
DB_PORT=3306

# API Configuration
NODE_ENV=production
API_PORT=3000
JWT_SECRET=your-very-long-random-string-change-this

# Frontend Configuration
FRONTEND_PORT=80
FRONTEND_SSL_PORT=443
FRONTEND_URL=https://yourdomain.com

# PhpMyAdmin (optional)
PMA_PORT=8080
```

### 4. Update Frontend Configuration
Edit `frontend/config.js`:
```javascript
api: {
    baseUrl: 'https://yourdomain.com/api', // Update this!
    timeout: 30000,
    retryAttempts: 3
}
```

### 5. Deploy with Docker
```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Manual Deployment (Without Docker)

### Backend Deployment

#### 1. Server Requirements
- Node.js 14+
- MySQL 5.7+
- PM2 (process manager)
- Nginx

#### 2. Setup MySQL
```bash
# Login to MySQL
mysql -u root -p

# Create database and user
CREATE DATABASE liquid_glass_map;
CREATE USER 'mapuser'@'localhost' IDENTIFIED BY 'strongpassword';
GRANT ALL PRIVILEGES ON liquid_glass_map.* TO 'mapuser'@'localhost';
FLUSH PRIVILEGES;

# Import schema
mysql -u mapuser -p liquid_glass_map < backend/database-schema.sql
```

#### 3. Setup Backend
```bash
cd backend
npm install --production

# Create .env file with production values
cp .env.example .env
nano .env

# Run database seed
npm run seed

# Start with PM2
pm2 start server.js --name liquid-glass-api
pm2 save
pm2 startup
```

### Frontend Deployment

#### 1. Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Root directory
    root /var/www/liquid-glass-map/frontend;
    index index.html;
    
    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    
    # API Proxy
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 2. SSL with Let's Encrypt
```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d yourdomain.com

# Auto-renewal
certbot renew --dry-run
```

## Production Optimizations

### 1. Database Optimizations
```sql
-- Add indexes for better performance
CREATE INDEX idx_spots_category_active ON spots(category_id, is_active);
CREATE INDEX idx_spots_location ON spots(latitude, longitude);
CREATE INDEX idx_media_spot ON media(spot_id);
CREATE INDEX idx_tips_spot ON tips(spot_id);

-- Optimize tables
OPTIMIZE TABLE spots;
OPTIMIZE TABLE media;
OPTIMIZE TABLE tips;
```

### 2. Frontend Optimizations

#### Minify Assets
```bash
# Install minifiers
npm install -g terser clean-css-cli

# Minify JavaScript
terser app.js -o app.min.js --compress --mangle
terser api.js -o api.min.js --compress --mangle
# ... repeat for all JS files

# Minify CSS
cleancss -o styles.min.css styles.css

# Update index.html to use minified files
```

#### Enable CDN
1. Upload static assets to CDN
2. Update asset URLs in index.html
3. Configure CORS headers

### 3. Security Hardening

#### Backend Security
```javascript
// Add to server.js
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
```

#### Environment Variables
Never commit `.env` files. Use:
- AWS Secrets Manager
- HashiCorp Vault
- Docker Secrets
- Kubernetes Secrets

### 4. Monitoring & Logging

#### Setup Monitoring
```bash
# Install monitoring tools
npm install winston morgan

# Add to server.js
const winston = require('winston');
const morgan = require('morgan');

// Logging configuration
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

app.use(morgan('combined', { stream: logger.stream }));
```

#### Health Checks
```javascript
// Add to server.js
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
```

### 5. Backup Strategy

#### Automated Backups
```bash
#!/bin/bash
# backup.sh

# Configuration
BACKUP_DIR="/backups"
DB_NAME="liquid_glass_map"
DB_USER="mapuser"
DB_PASS="password"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# Backup uploaded files
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /path/to/uploads

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

# Upload to S3 (optional)
aws s3 sync $BACKUP_DIR s3://your-bucket/backups/
```

#### Cron Job
```bash
# Add to crontab
0 2 * * * /path/to/backup.sh >> /var/log/backup.log 2>&1
```

## Scaling Considerations

### 1. Database Scaling
- **Read Replicas**: For high read traffic
- **Connection Pooling**: Already implemented
- **Query Caching**: Enable MySQL query cache
- **Partitioning**: For very large datasets

### 2. Application Scaling
- **Load Balancer**: Nginx or HAProxy
- **Multiple Backend Instances**: PM2 cluster mode
- **Redis**: For session storage and caching
- **CDN**: CloudFlare or AWS CloudFront

### 3. Container Orchestration
For large-scale deployments:
```yaml
# kubernetes-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: liquid-glass-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: liquid-glass-backend
  template:
    metadata:
      labels:
        app: liquid-glass-backend
    spec:
      containers:
      - name: backend
        image: your-registry/liquid-glass-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL is running
   - Verify credentials in .env
   - Check firewall rules

2. **CORS Errors**
   - Ensure FRONTEND_URL in backend .env matches actual URL
   - Check Nginx proxy headers

3. **502 Bad Gateway**
   - Backend not running
   - Check PM2: `pm2 status`
   - Check logs: `pm2 logs`

4. **Static Files Not Loading**
   - Check Nginx root directory
   - Verify file permissions
   - Clear browser cache

### Debug Commands
```bash
# Check all services
docker-compose ps

# Backend logs
docker-compose logs backend

# Database logs
docker-compose logs mysql

# Nginx logs
docker-compose logs frontend

# Connect to MySQL
docker-compose exec mysql mysql -u root -p

# Run migrations manually
docker-compose exec backend npm run migrate
```

## Performance Monitoring

### 1. New Relic Setup
```javascript
// Add to top of server.js
if (process.env.NODE_ENV === 'production') {
    require('newrelic');
}
```

### 2. Google Analytics
Add to `index.html`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## Final Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database backed up
- [ ] Monitoring configured
- [ ] Error logging enabled
- [ ] Security headers set
- [ ] API rate limiting enabled
- [ ] Cache headers configured
- [ ] Health checks passing
- [ ] Admin password changed
- [ ] Test on mobile devices
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Team trained on admin features

## Support Resources

- **Documentation**: Keep this guide updated
- **Monitoring**: Set up alerts for downtime
- **Backups**: Test restore procedure monthly
- **Updates**: Schedule regular dependency updates
- **Security**: Subscribe to security advisories

Remember: Always test deployments in staging before production!