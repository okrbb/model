# 🗺️ Modelovanie Detašovaných Pracovísk

Aplikácia na interaktívne modelovanie detašovaných pracovísk (DP) v Slovenskej republike s role-based access control a Firebase synchronizáciou.

## 🚀 Quick Start

### Prerequisites
- Moderný webový prehliadač (Chrome, Firefox, Edge)
- Firebase projekt s Firestore a Authentication

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd ref
   ```

2. **Configure Firebase:**
   ```bash
   cp js/firebase-config.template.js js/firebase-config.js
   ```
   
   Edit `js/firebase-config.js` and add your Firebase project credentials from [Firebase Console](https://console.firebase.google.com/).

3. **Open in browser:**
   ```bash
   # Simple HTTP server (Python)
   python3 -m http.server 8000
   
   # Or use any other local server (nginx, Apache, etc.)
   ```
   
   Then open `http://localhost:8000`

## 🔐 Security

**⚠️ IMPORTANT:** Never commit `js/firebase-config.js` to Git!

- File is listed in `.gitignore` 
- Contains Firebase API keys and project IDs
- See [SECURITY.md](SECURITY.md) for detailed security instructions

## 📋 Features

### Authentication
- Email/password authentication
- Password change capability
- Role-based access control (Admin, Region Editor, Viewer)
- Automatic region selection for regional editors

### Core Features
- Interactive map with district coloring
- Create and manage detached workplaces (DP)
- Assign districts to workplaces
- Edit district capacities (FTE)
- Export maps as PNG
- Automatic Firebase synchronization
- Complete audit trail

### Admin Features
- User and role management
- Assign users to specific regions
- Full system overview
- Model reset (with two-step confirmation)

## 📖 User Guide

Open the application and click **NÁVOD** button for complete user guide in Slovak language.

### Basic Workflow

1. **Select Region** - Choose region from dropdown ("Zvolte aktívny kraj")
2. **Create DP** - Click "+ PRIDAŤ DP" to create new workplace
3. **Assign Districts** - Click on districts to assign them to active DP
4. **Manage Capacities** - Edit FTE in right panel
5. **Export** - Export visualization as PNG

## 🏗️ Project Structure

```
ref/
├── index.html              # Main application
├── js/
│   ├── app.js              # Application logic
│   ├── firebase-config.template.js  # Configuration template
│   ├── firebase-config.js   # Configuration (IGNORED in Git)
│   ├── firebase-sync.js    # Firebase sync layer
│   ├── map.js              # Leaflet map functionality
│   ├── ui.js               # UI rendering
│   └── data.js             # Static data (districts, regions)
├── css/
│   └── style.css           # Styling
├── data/
│   └── *.geojson           # GeoJSON district boundaries
├── firestore.rules         # Firestore security rules
└── setup-users-firestore.js # Script to populate initial users
```

## 🔧 Firebase Setup

### Firestore Collections

1. **okr_region_models/{regionKey}**
   - Stores region data, workplaces, and district assignments
   - Sub-collections for districts and workspace data

2. **users/{uid}**
   - User profile with role and region assignment
   - Fields: `email`, `role`, `regionKey`

3. **district_meta/{docId}**
   - District metadata maintained by admins

### Firestore Rules

Rules in `firestore.rules` enforce:
- Public read access to region models (everyone can view)
- Authentication required for writes
- Admin-only write for some collections
- Region editor can only edit their assigned region

Deploy rules to Firebase:
```bash
firebase deploy --only firestore:rules
```

## 📝 Initial Setup

After Firebase configuration:

1. **Create users in Firebase Auth** with email/password
2. **Populate Firestore users collection:**
   ```bash
   node setup-users-firestore.js
   ```
3. **Assign roles and regions** via admin panel in application
4. **Deploy Firestore rules** to enable role-based access

## 🎨 Customization

- **Colors:** Edit `colorPalette` in `js/data.js`
- **Regions:** Modify region definitions in `js/data.js`
- **Styling:** Update `css/style.css`
- **Map:** Configure Leaflet options in `js/map.js`

## 🐛 Troubleshooting

### "Missing or insufficient permissions"
- Ensure Firestore rules are published
- Check user role in Firestore `/users/{uid}` document
- Verify Firebase authentication is working

### Map not displaying
- Check GeoJSON files in `data/` folder
- Verify Leaflet is loaded correctly
- Check browser console for errors

### Firebase sync not working
- Verify Firebase configuration in `js/firebase-config.js`
- Check Firestore is enabled in Firebase console
- Ensure correct project ID

## 📄 License

Internal use only

## 🤝 Support

For questions or issues, see [SECURITY.md](SECURITY.md) for security-related questions.

---

**Last Updated:** 2026-06-22
