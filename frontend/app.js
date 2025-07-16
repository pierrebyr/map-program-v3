// Global variables
let spots = []; // Will be loaded from API
let map;
let markers = [];
let currentFilter = 'all';
let userLocation = null;

// Advanced filter state
let advancedFilterState = {
    minPrice: 0,
    maxPrice: 200,
    minRating: 0,
    openNow: false,
    editorPick: false,
    hasVideo: false,
    maxDistance: null
};

// Initialize application
async function initApp() {
    try {
        // Initialize authentication first
        await Auth.init();
        
        // Initialize map
        initMap();
        
        // Load data from API
        await loadSpotsFromAPI();
        
        // Initialize event listeners
        initEventListeners();
        
        // Add favorites filter button if user is logged in
        setTimeout(() => {
            addFavoritesFilter();
        }, 100);
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        document.getElementById('loading').innerHTML = 
            '<p style="color: white;">Failed to load application. Please refresh the page.</p>';
    }
}

// Dans frontend/app.js, vérifiez que loadSpotsFromAPI ressemble à ça :

// Load spots from API
async function loadSpotsFromAPI() {
    try {
        console.log('Chargement des spots depuis l\'API...');
        const data = await API.getSpots();
        
        // IMPORTANT : Utiliser les données de l'API, pas les données locales
        spots = data.spots.map(spot => API.formatSpotForFrontend(spot));
        
        console.log(`${spots.length} spots chargés depuis l'API`);
        
        // Add spots to map
        addSpotsToMap(spots);
        
        // Render spot cards
        renderSpotCards(spots);
        
        // Hide loading
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Failed to load spots:', error);
        
        // NE PAS utiliser les données locales en production !
        // Commenter ou supprimer ce bloc :
        /*
        if (typeof initialSpots !== 'undefined') {
            spots = [...initialSpots];
            addSpotsToMap(spots);
            renderSpotCards(spots);
        }
        */
        
        // Afficher une erreur à la place
        document.getElementById('loading').innerHTML = 
            '<p style="color: white;">Erreur de chargement. Veuillez rafraîchir la page.</p>';
    }
}

// Initialize map
function initMap() {
    map = L.map('map', {
        center: APP_CONFIG.map.defaultCenter,
        zoom: APP_CONFIG.map.defaultZoom,
        minZoom: APP_CONFIG.map.minZoom,
        maxZoom: APP_CONFIG.map.maxZoom,
        zoomControl: false
    });

    // Dark themed map tiles
    L.tileLayer(APP_CONFIG.map.tileProvider, {
        attribution: APP_CONFIG.map.attribution,
        subdomains: 'abcd',
        maxZoom: APP_CONFIG.map.maxZoom
    }).addTo(map);

    // Add zoom control to bottom right
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Try to get user location
    if (navigator.geolocation && APP_CONFIG.features.enableGeolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Add user location marker
            L.marker([userLocation.lat, userLocation.lng], {
                icon: L.divIcon({
                    html: '<div class="user-location-marker">📍</div>',
                    className: 'custom-div-icon',
                    iconSize: [30, 30]
                })
            }).addTo(map).bindPopup('Your Location');
        });
    }
}

// Initialize event listeners
function initEventListeners() {
    // Price inputs
    document.getElementById('minPrice').addEventListener('input', applyAdvancedFilters);
    document.getElementById('maxPrice').addEventListener('input', applyAdvancedFilters);
    
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    const debouncedSearch = Utils.debounce(searchPlaces, APP_CONFIG.ui.searchDebounceDelay);
    searchInput.addEventListener('input', debouncedSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchPlaces();
        }
    });
}

// Toggle advanced filters panel
function toggleAdvancedFilters() {
    const panel = document.getElementById('advancedFilters');
    panel.classList.toggle('active');
}

// Apply advanced filters
function applyAdvancedFilters() {
    // Update filter state
    advancedFilterState.minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
    advancedFilterState.maxPrice = parseFloat(document.getElementById('maxPrice').value) || Infinity;
    
    const ratingCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]:checked');
    advancedFilterState.minRating = Math.min(...Array.from(ratingCheckboxes)
        .filter(cb => cb.value && !isNaN(cb.value))
        .map(cb => parseFloat(cb.value)), 0);
    
    advancedFilterState.openNow = document.getElementById('openNow').checked;
    advancedFilterState.editorPick = document.getElementById('editorPick').checked;
    advancedFilterState.hasVideo = document.getElementById('hasVideo').checked;
    
    const distanceValue = document.getElementById('distanceFilter').value;
    advancedFilterState.maxDistance = distanceValue === 'all' ? null : parseFloat(distanceValue);

    // Apply all filters
    filterSpots(currentFilter);
}

// Reset filters
function resetFilters() {
    document.getElementById('minPrice').value = 0;
    document.getElementById('maxPrice').value = 200;
    document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('distanceFilter').value = 'all';
    
    advancedFilterState = {
        minPrice: 0,
        maxPrice: 200,
        minRating: 0,
        openNow: false,
        editorPick: false,
        hasVideo: false,
        maxDistance: null
    };
    
    filterSpots('all');
}

// Data management functions for admin
function toggleDataModal() {
    if (!Auth.isAdmin()) {
        alert('Admin access required');
        return;
    }
    
    const modal = document.getElementById('dataModal');
    modal.classList.toggle('active');
    
    // Initialize drag-drop when modal opens
    if (modal.classList.contains('active')) {
        initDragDrop();
        updateDataModalContent();
    }
}

// Update data modal content for database system
// Remplacez la fonction updateDataModalContent dans app.js par celle-ci :

function updateDataModalContent() {
    const modal = document.getElementById('dataModal');
    modal.innerHTML = `
        <div class="modal">
            <h3>Data Management</h3>
            
            <div class="import-tabs">
                <button class="import-tab active" onclick="switchTab('add')">Add New Spot</button>
                <button class="import-tab" onclick="switchTab('export')">Export Data</button>
                <button class="import-tab" onclick="switchTab('import')">Bulk Import</button>
            </div>

            <div id="importStatus" class="import-status">
                <p></p>
            </div>

            <!-- Add New Spot Tab -->
            <div id="add-content" class="import-content active">
                <form id="addSpotForm" onsubmit="handleAddSpot(event)">
                    <div class="form-group">
                        <label>Name *</label>
                        <input type="text" name="name" required class="form-input">
                    </div>
                    
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" rows="3" class="form-input"></textarea>
                    </div>
                    
                    <!-- Nouveau : Recherche par adresse -->
                    <div class="form-group">
                        <label>Address Search</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="addressSearch" placeholder="Enter address..." class="form-input" style="flex: 1;">
                            <button type="button" onclick="searchAddress()" class="filter-btn active">Search</button>
                        </div>
                        <small style="color: rgba(255,255,255,0.6); display: block; margin-top: 5px;">
                            Enter an address and click Search to auto-fill coordinates
                        </small>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Latitude *</label>
                            <input type="number" name="lat" required step="any" class="form-input" id="latInput">
                        </div>
                        <div class="form-group">
                            <label>Longitude *</label>
                            <input type="number" name="lng" required step="any" class="form-input" id="lngInput">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Category</label>
                            <select name="category" class="form-input">
                                <option value="restaurant">Restaurant</option>
                                <option value="museum">Museum</option>
                                <option value="park">Park</option>
                                <option value="shopping">Shopping</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Price (€)</label>
                            <input type="number" name="price" min="0" step="0.01" class="form-input">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Icon</label>
                            <input type="text" name="icon" placeholder="🍽️" maxlength="2" class="form-input">
                        </div>
                        <div class="form-group">
                            <label>Rating</label>
                            <input type="number" name="rating" min="0" max="5" step="0.1" class="form-input">
                        </div>
                    </div>
                    
                    <!-- Nouveau : Section médias -->
                    <div class="form-group">
                        <label>Media (Photos/Videos)</label>
                        <div id="mediaInputs">
                            <div class="media-input-group" style="margin-bottom: 10px;">
                                <input type="url" name="mediaUrl[]" placeholder="Image/Video URL" class="form-input" style="margin-bottom: 5px;">
                                <input type="text" name="mediaCaption[]" placeholder="Caption (optional)" class="form-input" style="margin-bottom: 5px;">
                                <select name="mediaType[]" class="form-input">
                                    <option value="image">Image</option>
                                    <option value="video">Video</option>
                                </select>
                            </div>
                        </div>
                        <button type="button" onclick="addMediaInput()" class="filter-btn" style="margin-top: 10px;">+ Add Another Media</button>
                    </div>
                    
                    <!-- Nouveau : Tips -->
                    <div class="form-group">
                        <label>Tips</label>
                        <div id="tipsInputs">
                            <input type="text" name="tips[]" placeholder="Add a helpful tip" class="form-input" style="margin-bottom: 5px;">
                        </div>
                        <button type="button" onclick="addTipInput()" class="filter-btn" style="margin-top: 10px;">+ Add Another Tip</button>
                    </div>
                    
                    <!-- Nouveau : Social Links -->
                    <div class="form-group">
                        <label>Social Links</label>
                        <input type="url" name="instagram" placeholder="Instagram URL (optional)" class="form-input" style="margin-bottom: 5px;">
                        <input type="url" name="website" placeholder="Website URL (optional)" class="form-input">
                    </div>
                    
                    <!-- Nouveau : Opening Hours -->
                    <div class="form-group">
                        <label>Opening Hours</label>
                        <div class="form-row">
                            <input type="time" name="openTime" placeholder="Open" class="form-input">
                            <input type="time" name="closeTime" placeholder="Close" class="form-input">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="editorPick">
                            Editor's Pick
                        </label>
                    </div>
                    
                    <button type="submit" class="submit-btn">Add Spot</button>
                </form>
            </div>

            <!-- Export Tab -->
            <div id="export-content" class="import-content">
                <h4 style="color: white; margin-bottom: 20px;">Export current map data</h4>
                <div style="display: flex; gap: 10px;">
                    <button class="filter-btn active" onclick="exportData('json')">Export as JSON</button>
                    <button class="filter-btn active" onclick="exportData('csv')">Export as CSV</button>
                </div>
            </div>

            <!-- Bulk Import Tab -->
            <div id="import-content" class="import-content">
                <div class="file-drop-zone" id="dropZone">
                    <p>📁 Drag and drop your JSON or CSV file here</p>
                    <p>or <span onclick="document.getElementById('fileInput').click()">browse files</span></p>
                    <input type="file" id="fileInput" accept=".json,.csv" style="display: none;" onchange="handleFileSelect(event)">
                </div>

                <h4 style="color: white; margin-bottom: 10px;">Or paste JSON data:</h4>
                <textarea id="jsonInput" placeholder="Paste your JSON data here..."></textarea>
                <button class="filter-btn active" onclick="importFromJSON()">Import JSON</button>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <button class="filter-btn" onclick="closeDataModal()">Close</button>
            </div>
        </div>
    `;
}

// Fonction pour rechercher une adresse
async function searchAddress() {
    const addressInput = document.getElementById('addressSearch');
    const address = addressInput.value.trim();
    
    if (!address) {
        alert('Please enter an address');
        return;
    }
    
    // Afficher un état de chargement
    addressInput.disabled = true;
    const originalText = event.target.textContent;
    event.target.textContent = 'Searching...';
    event.target.disabled = true;
    
    try {
        const result = await API.geocodeAddress(address);
        
        // Remplir les champs de coordonnées
        document.getElementById('latInput').value = result.lat;
        document.getElementById('lngInput').value = result.lng;
        
        // Afficher l'adresse trouvée
        showImportStatus(`Found: ${result.display_name}`, false);
        
        // Optionnel : centrer la carte sur cette position
        if (window.map) {
            map.setView([result.lat, result.lng], 16);
            
            // Ajouter un marqueur temporaire
            const tempMarker = L.marker([result.lat, result.lng])
                .addTo(map)
                .bindPopup('New spot location')
                .openPopup();
            
            // Supprimer le marqueur après 5 secondes
            setTimeout(() => map.removeLayer(tempMarker), 5000);
        }
    } catch (error) {
        showImportStatus('Address not found. Please try a different address or enter coordinates manually.', true);
    } finally {
        addressInput.disabled = false;
        event.target.textContent = originalText;
        event.target.disabled = false;
    }
}

// Fonction pour ajouter un champ média
function addMediaInput() {
    const container = document.getElementById('mediaInputs');
    const div = document.createElement('div');
    div.className = 'media-input-group';
    div.style.marginBottom = '10px';
    div.innerHTML = `
        <input type="url" name="mediaUrl[]" placeholder="Image/Video URL" class="form-input" style="margin-bottom: 5px;">
        <input type="text" name="mediaCaption[]" placeholder="Caption (optional)" class="form-input" style="margin-bottom: 5px;">
        <select name="mediaType[]" class="form-input">
            <option value="image">Image</option>
            <option value="video">Video</option>
        </select>
        <button type="button" onclick="this.parentElement.remove()" class="filter-btn" style="margin-left: 10px;">Remove</button>
    `;
    container.appendChild(div);
}

// Fonction pour ajouter un champ tip
function addTipInput() {
    const container = document.getElementById('tipsInputs');
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'tips[]';
    input.placeholder = 'Add a helpful tip';
    input.className = 'form-input';
    input.style.marginBottom = '5px';
    container.appendChild(input);
}

// Mise à jour de la fonction handleAddSpot pour gérer les nouveaux champs
async function handleAddSpot(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    // Collecter les médias
    const mediaUrls = form.querySelectorAll('input[name="mediaUrl[]"]');
    const mediaCaptions = form.querySelectorAll('input[name="mediaCaption[]"]');
    const mediaTypes = form.querySelectorAll('select[name="mediaType[]"]');
    const media = [];
    
    for (let i = 0; i < mediaUrls.length; i++) {
        if (mediaUrls[i].value) {
            media.push({
                url: mediaUrls[i].value,
                caption: mediaCaptions[i].value,
                type: mediaTypes[i].value
            });
        }
    }
    
    // Collecter les tips
    const tipInputs = form.querySelectorAll('input[name="tips[]"]');
    const tips = Array.from(tipInputs)
        .map(input => input.value.trim())
        .filter(tip => tip.length > 0);
    
    // Construire l'objet spot
    const spotData = {
        name: form.name.value,
        description: form.description.value,
        latitude: parseFloat(form.lat.value),
        longitude: parseFloat(form.lng.value),
        categoryId: API.getCategoryId(form.category.value),
        price: parseFloat(form.price.value) || 0,
        icon: form.icon.value || '📍',
        rating: parseFloat(form.rating.value) || 0,
        editorPick: form.editorPick.checked,
        media: media,
        tips: tips,
        social: {
            instagram: form.instagram.value || null,
            website: form.website.value || null
        },
        hours: form.openTime.value && form.closeTime.value ? {
            open: form.openTime.value,
            close: form.closeTime.value
        } : null,
        author: {
            name: Auth.currentUser.fullName || Auth.currentUser.email,
            avatar: `https://i.pravatar.cc/100?u=${Auth.currentUser.email}`
        }
    };
    
    try {
        await API.createSpot(spotData);
        showImportStatus('Spot added successfully!', false);
        form.reset();
        
        // Reload spots
        await loadSpotsFromAPI();
        
        // Fermer le modal après 2 secondes
        setTimeout(() => {
            closeDataModal();
        }, 2000);
    } catch (error) {
        showImportStatus('Failed to add spot: ' + error.message, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Spot';
    }
}

// Handle adding new spot
async function handleAddSpot(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    const spotData = {
        name: form.name.value,
        description: form.description.value,
        latitude: parseFloat(form.lat.value),
        longitude: parseFloat(form.lng.value),
        categoryId: API.getCategoryId(form.category.value),
        price: parseFloat(form.price.value) || 0,
        icon: form.icon.value || '📍',
        rating: parseFloat(form.rating.value) || 0,
        editorPick: form.editorPick.checked
    };
    
    try {
        await API.createSpot(spotData);
        showImportStatus('Spot added successfully!', false);
        form.reset();
        
        // Reload spots
        await loadSpotsFromAPI();
    } catch (error) {
        showImportStatus('Failed to add spot: ' + error.message, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Spot';
    }
}

function closeDataModal() {
    document.getElementById('dataModal').classList.remove('active');
}

function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update content
    document.querySelectorAll('.import-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tab}-content`).classList.add('active');
}

// File handling for bulk import
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const content = e.target.result;
        
        if (file.name.endsWith('.json')) {
            try {
                const data = JSON.parse(content);
                await importBulkData(data);
            } catch (error) {
                showImportStatus('Error parsing JSON file: ' + error.message, true);
            }
        } else if (file.name.endsWith('.csv')) {
            parseCSVAndImport(content);
        }
    };
    reader.readAsText(file);
}

// Import bulk data to database
async function importBulkData(data) {
    const dataArray = Array.isArray(data) ? data : [data];
    let successCount = 0;
    let errorCount = 0;
    
    showImportStatus(`Importing ${dataArray.length} spots...`, false);
    
    for (const spot of dataArray) {
        try {
            const spotData = API.formatSpotForDatabase(spot);
            await API.createSpot(spotData);
            successCount++;
        } catch (error) {
            console.error('Failed to import spot:', spot.name, error);
            errorCount++;
        }
    }
    
    const message = `Import complete: ${successCount} succeeded, ${errorCount} failed`;
    showImportStatus(message, errorCount > 0);
    
    // Reload spots
    await loadSpotsFromAPI();
}

// Initialize drag and drop
function initDragDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file) {
            const input = document.getElementById('fileInput');
            input.files = e.dataTransfer.files;
            handleFileSelect({ target: input });
        }
    });
}

async function importFromJSON() {
    const jsonInput = document.getElementById('jsonInput').value.trim();
    if (!jsonInput) {
        showImportStatus('Please paste JSON data', true);
        return;
    }
    
    try {
        const data = JSON.parse(jsonInput);
        await importBulkData(data);
        document.getElementById('jsonInput').value = '';
    } catch (error) {
        showImportStatus('Invalid JSON: ' + error.message, true);
    }
}

function parseCSVAndImport(csvText) {
    try {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = Utils.parseCSVLine(lines[i]);
            const obj = {};
            
            headers.forEach((header, index) => {
                const value = values[index]?.trim().replace(/^"(.*)"$/, '$1');
                
                // Map CSV fields to spot object
                if (header === 'lat' || header === 'latitude') obj.lat = parseFloat(value);
                else if (header === 'lng' || header === 'longitude') obj.lng = parseFloat(value);
                else if (header === 'rating') obj.rating = parseFloat(value);
                else if (header === 'price') obj.price = parseFloat(value);
                else obj[header] = value;
            });
            
            if (obj.name && obj.lat && obj.lng) {
                data.push(obj);
            }
        }
        
        importBulkData(data);
    } catch (error) {
        showImportStatus('Error parsing CSV: ' + error.message, true);
    }
}

function showImportStatus(message, isError) {
    const statusEl = document.getElementById('importStatus');
    if (!statusEl) return;
    
    const messageEl = statusEl.querySelector('p');
    
    messageEl.textContent = message;
    statusEl.classList.toggle('error', isError);
    statusEl.style.display = 'block';
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, APP_CONFIG.ui.importStatusDuration);
}

function exportData(format) {
    const exportData = spots.map(spot => ({
        ...spot,
        author: spot.author?.name,
        authorAvatar: spot.author?.avatar,
        openTime: spot.hours?.open,
        closeTime: spot.hours?.close,
        mediaUrls: spot.media?.map(m => m.url).join(';'),
        tips: spot.tips?.join(';'),
        instagram: spot.social?.instagram,
        website: spot.social?.website
    }));
    
    if (format === 'json') {
        const dataStr = JSON.stringify(exportData, null, APP_CONFIG.export.jsonIndentation);
        Utils.downloadFile(dataStr, 'map-data.json', 'application/json');
    } else if (format === 'csv') {
        let csv = 'name,description,category,icon,rating,lat,lng,price,openTime,closeTime,editorPick,author,mediaUrls,tips,instagram,website\n';
        
        exportData.forEach(spot => {
            const row = [
                `"${spot.name}"`,
                `"${spot.description?.replace(/"/g, '""') || ''}"`,
                spot.category,
                spot.icon,
                spot.rating,
                spot.lat,
                spot.lng,
                spot.price || 0,
                spot.openTime || '',
                spot.closeTime || '',
                spot.editorPick || false,
                spot.author || '',
                spot.mediaUrls || '',
                spot.tips || '',
                spot.instagram || '',
                spot.website || ''
            ];
            csv += row.join(',') + '\n';
        });
        
        Utils.downloadFile(csv, 'map-data.csv', 'text/csv');
    }
}

// Create rich media popup content
function createPopupContent(spot) {
    const isAdmin = Auth.isAdmin();
    const isLoggedIn = Auth.isLoggedIn();
    
    const mediaHTML = spot.media && spot.media.length > 0 ? `
        <div class="media-gallery" id="gallery-${spot.id}">
            ${spot.media.map((media, index) => `
                <div class="media-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
                    ${media.type === 'image' ? 
                        `<img src="${media.url}" alt="${media.caption || spot.name}">` :
                        `<img src="${media.thumbnail || 'https://via.placeholder.com/420x250'}" alt="${spot.name}">
                         <div class="play-button" onclick="playVideo('${media.url}', ${spot.id}, ${index})"></div>`
                    }
                </div>
            `).join('')}
            ${spot.media.length > 1 ? `
                <div class="gallery-nav">
                    ${spot.media.map((_, index) => `
                        <div class="gallery-dot ${index === 0 ? 'active' : ''}" 
                             onclick="changeSlide(${spot.id}, ${index})"></div>
                    `).join('')}
                </div>
                <div class="gallery-arrows">
                    <div class="gallery-arrow" onclick="prevSlide(${spot.id})">‹</div>
                    <div class="gallery-arrow" onclick="nextSlide(${spot.id})">›</div>
                </div>
            ` : ''}
        </div>
    ` : '';

    const tipsHTML = spot.tips && spot.tips.length > 0 ? `
        <div class="popup-tips">
            <h4>💡 Insider Tips</h4>
            <ul>
                ${spot.tips.map(tip => `<li>${Utils.escapeHtml(tip)}</li>`).join('')}
            </ul>
        </div>
    ` : '';

    const socialHTML = spot.social ? `
        <div class="social-links">
            ${spot.social.instagram ? `
                <a href="${spot.social.instagram}" target="_blank" class="social-link">
                    <span>📷</span>
                </a>
            ` : ''}
            ${spot.social.website ? `
                <a href="${spot.social.website}" target="_blank" class="social-link">
                    <span>🌐</span>
                </a>
            ` : ''}
            <a href="#" class="social-link" onclick="shareLocation(${spot.id}); return false;">
                <span>📤</span>
            </a>
        </div>
    ` : '';

    const adminControls = isAdmin ? `
        <div class="popup-admin-controls">
            <button class="admin-control-btn edit" onclick="Admin.editSpot(${spot.id})" title="Edit">
                ✏️
            </button>
            <button class="admin-control-btn delete" onclick="Admin.deleteSpot(${spot.id})" title="Delete">
                🗑️
            </button>
        </div>
    ` : '';

    // Bouton favori pour les utilisateurs connectés
    const favoriteButton = isLoggedIn ? `
        <button class="action-btn ${spot.isFavorite ? 'favorite' : ''}" 
                onclick="toggleFavorite(${spot.id}); return false;">
            <span>${spot.isFavorite ? '❤️' : '🤍'}</span> 
            ${spot.isFavorite ? 'Favorited' : 'Add to Favorites'}
        </button>
    ` : '';

    return `
        <div class="popup-content">
            ${mediaHTML}
            <div class="popup-info">
                ${adminControls}
                <div class="popup-header">
                    <div class="popup-title">
                        <h3>${Utils.escapeHtml(spot.name)}</h3>
                        ${spot.author ? `
                            <div class="author-info">
                                <img src="${spot.author.avatar || 'https://i.pravatar.cc/100'}" alt="${spot.author.name}">
                                <span>by ${Utils.escapeHtml(spot.author.name)}</span>
                            </div>
                        ` : ''}
                    </div>
                    ${spot.editorPick ? '<span class="editor-badge">⭐ Editor\'s Pick</span>' : ''}
                </div>
                <p class="popup-description">${Utils.escapeHtml(spot.description || '')}</p>
                ${tipsHTML}
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <span class="spot-category">${spot.category}</span>
                    <span class="spot-rating">★ ${spot.rating}</span>
                    ${spot.price ? `<span class="spot-price">${Utils.formatPrice(spot.price)}</span>` : ''}
                </div>
                ${socialHTML}
            </div>
        </div>
    `;
}

// Gallery navigation functions
function changeSlide(spotId, index) {
    const gallery = document.getElementById(`gallery-${spotId}`);
    if (!gallery) return;

    const slides = gallery.querySelectorAll('.media-slide');
    const dots = gallery.querySelectorAll('.gallery-dot');

    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    if (slides[index]) slides[index].classList.add('active');
    if (dots[index]) dots[index].classList.add('active');
}

function nextSlide(spotId) {
    const gallery = document.getElementById(`gallery-${spotId}`);
    if (!gallery) return;

    const activeSlide = gallery.querySelector('.media-slide.active');
    const slides = Array.from(gallery.querySelectorAll('.media-slide'));
    const currentIndex = slides.indexOf(activeSlide);
    const nextIndex = (currentIndex + 1) % slides.length;

    changeSlide(spotId, nextIndex);
}

function prevSlide(spotId) {
    const gallery = document.getElementById(`gallery-${spotId}`);
    if (!gallery) return;

    const activeSlide = gallery.querySelector('.media-slide.active');
    const slides = Array.from(gallery.querySelectorAll('.media-slide'));
    const currentIndex = slides.indexOf(activeSlide);
    const prevIndex = (currentIndex - 1 + slides.length) % slides.length;

    changeSlide(spotId, prevIndex);
}

function playVideo(videoUrl, spotId, slideIndex) {
    const gallery = document.getElementById(`gallery-${spotId}`);
    if (!gallery) return;

    const slide = gallery.querySelector(`.media-slide[data-index="${slideIndex}"]`);
    slide.innerHTML = `
        <video controls autoplay style="width: 100%; height: 100%; object-fit: cover;">
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
}

function getDirections(lat, lng) {
    // Open in Google Maps
    window.open(`https://www.google.com/maps/directions/?api=1&destination=${lat},${lng}`, '_blank');
}

function shareLocation(spotId) {
    const spot = spots.find(s => s.id === spotId);
    if (!spot) return;

    const shareData = {
        title: spot.name,
        text: spot.description,
        url: window.location.href + `#spot-${spotId}`
    };

    if (navigator.share && APP_CONFIG.features.enableSharing) {
        navigator.share(shareData);
    } else {
        // Fallback - copy to clipboard
        const text = `${spot.name} - ${spot.description}\n${window.location.href}#spot-${spotId}`;
        navigator.clipboard.writeText(text).then(() => {
            alert('Location link copied to clipboard!');
        });
    }
}

// Add spots to map
function addSpotsToMap(spotsToAdd) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    spotsToAdd.forEach(spot => {
        const isEditorPick = spot.editorPick ? 'editor-pick' : '';
        const markerHtml = `<div class="custom-marker ${isEditorPick}">${spot.icon}</div>`;
        
        const customIcon = L.divIcon({
            html: markerHtml,
            className: 'custom-div-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });

        const marker = L.marker([spot.lat, spot.lng], { icon: customIcon })
            .addTo(map)
            .bindPopup(createPopupContent(spot), {
                maxWidth: APP_CONFIG.ui.popupMaxWidth,
                className: 'custom-popup'
            });

        markers.push(marker);
    });
}

// Render spot cards
function renderSpotCards(spotsToRender) {
    const panel = document.getElementById('spotsPanel');
    panel.innerHTML = '';

    spotsToRender.forEach(spot => {
        const card = document.createElement('div');
        card.className = `spot-card ${spot.editorPick ? 'editor-pick' : ''} ${spot.isFavorite ? 'favorite' : ''}`;
        card.setAttribute('data-spot-id', spot.id);
        
        const isOpen = spot.hours ? Utils.isOpenNow(spot.hours) : true;
        const priceIndicator = Utils.formatPrice(spot.price);
        
        const adminControls = Auth.isAdmin() ? `
            <div class="admin-controls">
                <button class="admin-control-btn edit" onclick="Admin.editSpot(${spot.id})" title="Edit">
                    ✏️
                </button>
                <button class="admin-control-btn delete" onclick="Admin.deleteSpot(${spot.id})" title="Delete">
                    🗑️
                </button>
            </div>
        ` : '';
        
        const favoriteIndicator = spot.isFavorite ? '<span class="favorite-indicator">❤️</span>' : '';
        
        card.innerHTML = `
            ${favoriteIndicator}
            ${adminControls}
            ${spot.editorPick ? '<div class="editor-badge">⭐ Editor\'s Pick</div>' : ''}
            <h3>${spot.icon} ${Utils.escapeHtml(spot.name)}</h3>
            <p>${Utils.truncateText(spot.description, 100)}</p>
            <div class="spot-meta">
                <span class="spot-category">${spot.category}</span>
                <span class="spot-rating">★ ${spot.rating}</span>
                ${spot.price !== undefined ? `<span class="spot-price">${priceIndicator}</span>` : ''}
            </div>
            ${spot.hours ? `
                <div class="spot-status">
                    <div class="status-dot ${isOpen ? '' : 'closed'}"></div>
                    <span>${isOpen ? 'Open now' : 'Closed'}</span>
                </div>
            ` : ''}
        `;
        card.onclick = (e) => {
            // Don't focus if clicking on admin controls
            if (!e.target.closest('.admin-controls')) {
                focusOnSpot(spot);
            }
        };
        panel.appendChild(card);
    });
}

// Focus on specific spot
function focusOnSpot(spot) {
    map.setView([spot.lat, spot.lng], 16, {
        animate: true,
        duration: 1
    });

    // Open popup
    markers.forEach(marker => {
        const latlng = marker.getLatLng();
        if (latlng.lat === spot.lat && latlng.lng === spot.lng) {
            marker.openPopup();
        }
    });
}

// Filter spots with advanced filters
function filterSpots(category) {
    currentFilter = category;
    
    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // If no event, find the button by category
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.textContent.includes('All') && category === 'all') btn.classList.add('active');
            else if (btn.textContent.includes('Food') && category === 'restaurant') btn.classList.add('active');
            else if (btn.textContent.includes('Culture') && category === 'museum') btn.classList.add('active');
            else if (btn.textContent.includes('Nature') && category === 'park') btn.classList.add('active');
            else if (btn.textContent.includes('Shopping') && category === 'shopping') btn.classList.add('active');
        });
    }

    // Filter spots
    let filteredSpots = category === 'all' 
        ? [...spots]
        : spots.filter(spot => spot.category === category);

    // Apply advanced filters
    filteredSpots = filteredSpots.filter(spot => {
        // Price filter
        if (spot.price !== undefined && (spot.price < advancedFilterState.minPrice || spot.price > advancedFilterState.maxPrice)) {
            return false;
        }
        
        // Rating filter
        if (advancedFilterState.minRating > 0 && spot.rating < advancedFilterState.minRating) {
            return false;
        }
        
        // Open now filter
        if (advancedFilterState.openNow && spot.hours && !Utils.isOpenNow(spot.hours)) {
            return false;
        }
        
        // Editor pick filter
        if (advancedFilterState.editorPick && !spot.editorPick) {
            return false;
        }
        
        // Has video filter
        if (advancedFilterState.hasVideo && (!spot.media || !spot.media.some(m => m.type === 'video'))) {
            return false;
        }
        
        // Distance filter
        if (advancedFilterState.maxDistance && userLocation) {
            const distance = Utils.calculateDistance(userLocation.lat, userLocation.lng, spot.lat, spot.lng);
            if (distance > advancedFilterState.maxDistance) {
                return false;
            }
        }
        
        return true;
    });

    // Update map and cards
    addSpotsToMap(filteredSpots);
    renderSpotCards(filteredSpots);
}

// Search functionality
async function searchPlaces() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    if (!searchTerm) {
        // If search is empty, show all spots
        filterSpots(currentFilter);
        return;
    }
    
    try {
        // Search through API
        const data = await API.getSpots({ search: searchTerm });
        const searchResults = data.spots.map(spot => API.formatSpotForFrontend(spot));
        
        // Update local spots array with search results
        spots = searchResults;
        
        // Apply current filters to search results
        filterSpots(currentFilter);
    } catch (error) {
        console.error('Search failed:', error);
        
        // Fallback to local search
        const searchTermLower = searchTerm.toLowerCase();
        const filteredSpots = spots.filter(spot => 
            spot.name.toLowerCase().includes(searchTermLower) ||
            spot.description?.toLowerCase().includes(searchTermLower) ||
            (spot.tips && spot.tips.some(tip => tip.toLowerCase().includes(searchTermLower))) ||
            (spot.author && spot.author.name.toLowerCase().includes(searchTermLower))
        );

        addSpotsToMap(filteredSpots);
        renderSpotCards(filteredSpots);
    }
}

// Initialize when page loads
window.addEventListener('load', function() {
    // Multiple initialization attempts
    let attempts = 0;
    const maxAttempts = 5;
    
    function tryInitApp() {
        attempts++;
        
        if (typeof L !== 'undefined') {
            console.log('Leaflet loaded, initializing app...');
            initApp();
        } else if (attempts < maxAttempts) {
            console.log(`Leaflet not loaded yet, attempt ${attempts}/${maxAttempts}`);
            setTimeout(tryInitApp, 1000);
        } else {
            // Try loading Leaflet dynamically as last resort
            console.error('Failed to load Leaflet, attempting dynamic load...');
            loadLeafletDynamically();
        }
    }
    
    // Dynamic loading fallback
    function loadLeafletDynamically() {
        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(link);
        
        // Load JS
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        script.onload = function() {
            console.log('Leaflet loaded dynamically');
            initApp();
        };
        script.onerror = function() {
            document.getElementById('loading').innerHTML = '<p style="color: white;">Error loading map library. Please check your internet connection and refresh the page.</p>';
        };
        document.head.appendChild(script);
    }
    
    // Start initialization
    tryInitApp();
});

// Make functions globally accessible
window.filterSpots = filterSpots;
window.toggleAdvancedFilters = toggleAdvancedFilters;
window.applyAdvancedFilters = applyAdvancedFilters;
window.resetFilters = resetFilters;
window.toggleDataModal = toggleDataModal;
window.closeDataModal = closeDataModal;
window.switchTab = switchTab;
window.handleFileSelect = handleFileSelect;
window.importFromJSON = importFromJSON;
window.exportData = exportData;
window.searchPlaces = searchPlaces;
window.changeSlide = changeSlide;
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.playVideo = playVideo;
window.getDirections = getDirections;
window.shareLocation = shareLocation;
window.handleAddSpot = handleAddSpot;

// Ajoutez ces fonctions dans app.js (après les autres fonctions)

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

// Ajouter un bouton de filtre pour les favoris
function addFavoritesFilter() {
    const filterButtons = document.querySelector('.filter-buttons');
    if (filterButtons && Auth.isLoggedIn()) {
        // Vérifier si le bouton n'existe pas déjà
        if (!document.querySelector('.filter-btn.favorites-btn')) {
            const favoritesBtn = document.createElement('button');
            favoritesBtn.className = 'filter-btn favorites-btn';
            favoritesBtn.innerHTML = '❤️ My Favorites';
            favoritesBtn.onclick = () => filterFavorites();
            filterButtons.appendChild(favoritesBtn);
        }
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

// Ajouter ces fonctions pour la recherche d'adresse
async function searchAddress() {
    const addressInput = document.getElementById('addressSearch');
    const address = addressInput.value.trim();
    
    if (!address) {
        alert('Please enter an address');
        return;
    }
    
    // Afficher un état de chargement
    addressInput.disabled = true;
    const searchBtn = event.target;
    const originalText = searchBtn.textContent;
    searchBtn.textContent = 'Searching...';
    searchBtn.disabled = true;
    
    try {
        const result = await API.geocodeAddress(address);
        
        // Remplir les champs de coordonnées
        document.getElementById('latInput').value = result.lat;
        document.getElementById('lngInput').value = result.lng;
        
        // Afficher l'adresse trouvée
        showImportStatus(`Found: ${result.display_name}`, false);
        
        // Optionnel : centrer la carte sur cette position
        if (window.map) {
            map.setView([result.lat, result.lng], 16);
            
            // Ajouter un marqueur temporaire
            const tempMarker = L.marker([result.lat, result.lng])
                .addTo(map)
                .bindPopup('New spot location')
                .openPopup();
            
            // Supprimer le marqueur après 5 secondes
            setTimeout(() => map.removeLayer(tempMarker), 5000);
        }
    } catch (error) {
        showImportStatus('Address not found. Please try a different address or enter coordinates manually.', true);
    } finally {
        addressInput.disabled = false;
        searchBtn.textContent = originalText;
        searchBtn.disabled = false;
    }
}

// Fonction pour ajouter un champ média
function addMediaInput() {
    const container = document.getElementById('mediaInputs');
    const div = document.createElement('div');
    div.className = 'media-input-group';
    div.style.marginBottom = '10px';
    div.innerHTML = `
        <input type="url" name="mediaUrl[]" placeholder="Image/Video URL" class="form-input" style="margin-bottom: 5px;">
        <input type="text" name="mediaCaption[]" placeholder="Caption (optional)" class="form-input" style="margin-bottom: 5px;">
        <select name="mediaType[]" class="form-input">
            <option value="image">Image</option>
            <option value="video">Video</option>
        </select>
        <button type="button" onclick="this.parentElement.remove()" class="filter-btn" style="margin-left: 10px;">Remove</button>
    `;
    container.appendChild(div);
}

// Fonction pour ajouter un champ tip
function addTipInput() {
    const container = document.getElementById('tipsInputs');
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'tips[]';
    input.placeholder = 'Add a helpful tip';
    input.className = 'form-input';
    input.style.marginBottom = '5px';
    container.appendChild(input);
}

// Rendre les fonctions globales
window.updateFavoriteUI = updateFavoriteUI;
window.toggleFavorite = toggleFavorite;
window.addFavoritesFilter = addFavoritesFilter;
window.filterFavorites = filterFavorites;
window.searchAddress = searchAddress;
window.addMediaInput = addMediaInput;
window.addTipInput = addTipInput;