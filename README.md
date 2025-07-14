# Liquid Glass Map System - Travel Magazine Edition

A beautiful, interactive map application with a glassmorphism design for showcasing tourist spots, restaurants, and points of interest.

## File Structure

```
project/
│
├── index.html      # Main HTML structure
├── styles.css      # All styling and CSS
├── data.js         # Initial tourist spots data
├── app.js          # Main application logic
└── README.md       # This file
```

## Features

- **Interactive Map**: Dark-themed map with custom markers
- **Glassmorphism UI**: Beautiful frosted glass effect panels
- **Advanced Filtering**: Filter by price, rating, features, and distance
- **Media Galleries**: Support for images and videos in location popups
- **Data Management**: Import/export data in JSON or CSV formats
- **Search Functionality**: Search locations by name, description, or tips
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

1. **Basic Setup**: Simply open `index.html` in a web browser. All files should be in the same directory.

2. **Running Locally**: For best results, use a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   ```

3. **Deployment**: Upload all files to your web hosting service maintaining the same structure.

## Data Format

### JSON Structure
```javascript
{
    name: "Location Name",
    description: "Detailed description",
    category: "restaurant|museum|park|shopping",
    icon: "🍽️",
    rating: 4.5,
    lat: 48.8566,
    lng: 2.3522,
    price: 50,
    hours: { open: "09:00", close: "22:00" },
    editorPick: false,
    author: {
        name: "Author Name",
        avatar: "https://example.com/avatar.jpg"
    },
    media: [{
        type: "image|video",
        url: "https://example.com/media.jpg",
        caption: "Media caption",
        thumbnail: "https://example.com/thumb.jpg"
    }],
    tips: ["Tip 1", "Tip 2", "Tip 3"],
    relatedArticle: {
        title: "Article Title",
        url: "https://example.com/article"
    },
    social: {
        instagram: "https://instagram.com/handle",
        website: "https://example.com"
    }
}
```

### CSV Format
Headers: `name,description,category,icon,rating,lat,lng,price,hours,editorPick,authorName,authorAvatar,media1URL,media1Type,media1Caption,tip1,tip2,tip3,websiteURL,instagramURL`

## Customization

### Changing Map Center
In `app.js`, modify the `initMap` function:
```javascript
map = L.map('map', {
    center: [YOUR_LATITUDE, YOUR_LONGITUDE],
    zoom: 13
});
```

### Adding New Categories
1. Add new filter button in `index.html`
2. Update filter logic in `app.js`
3. Add corresponding styles in `styles.css`

### Modifying Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --primary: #007AFF;
    --editor-pick: #FF6B6B;
    --success: #34C759;
    --warning: #FF9500;
}
```

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (may need -webkit- prefixes)
- Mobile browsers: Fully responsive

## Dependencies

- **Leaflet.js**: v1.9.4 - Interactive map library
- **OpenStreetMap**: Map tiles provider

## Troubleshooting

1. **Map not loading**: Check internet connection and ensure Leaflet CDN is accessible
2. **Styles not applying**: Ensure `styles.css` is in the same directory as `index.html`
3. **Data not loading**: Check browser console for JavaScript errors
4. **Import failing**: Ensure JSON/CSV format matches the templates

## License

This project is open source and available for personal and commercial use.

## Credits

- Map tiles by [OpenStreetMap](https://www.openstreetmap.org/)
- Leaflet.js by [Vladimir Agafonkin](https://leafletjs.com/)
- Sample images from [Unsplash](https://unsplash.com/)