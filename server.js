const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Save with unique name but keep extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'issue-' + uniqueSuffix + ext);
  }
});

// Filter to check file type
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);
  
  if (ext && mime) {
    return cb(null, true);
  }
  cb(new Error('Only image files (jpg, jpeg, png, gif, svg) are allowed!'));
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// --- AUTH API ---

// User Registration
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }
    const newUser = db.createUser(name, email, password);
    res.status(201).json({
      success: true,
      user: {
        User_ID: newUser.User_ID,
        Name: newUser.Name,
        Email: newUser.Email,
        Role: newUser.Role,
        Karma: newUser.Karma || 10
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// User/Admin Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const user = db.findUserByEmail(email);
  if (!user || user.Password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  res.status(200).json({
    success: true,
    user: {
      User_ID: user.User_ID,
      Name: user.Name,
      Email: user.Email,
      Role: user.Role,
      Karma: user.Karma || 10
    }
  });
});

// --- COMPLAINTS API ---

// Get all complaints or filtered by User_ID
app.get('/api/complaints', (req, res) => {
  try {
    const { userId } = req.query;
    let complaints = db.getComplaints();
    
    if (userId) {
      complaints = complaints.filter(c => c.User_ID === parseInt(userId));
    }
    
    // Sort complaints: newest first
    complaints.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    
    res.status(200).json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get a single complaint detail
app.get('/api/complaints/:id', (req, res) => {
  try {
    const complaint = db.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }
    res.status(200).json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// File a new complaint (with image upload)
app.post('/api/complaints', (req, res) => {
  // Use multer upload wrapper
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    
    try {
      const { userId, issueType, description, latitude, longitude, address, priority } = req.body;
      
      if (!userId || !issueType || !description || !latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'userId, issueType, description, latitude, longitude are required'
        });
      }

      // Check if image file was uploaded or if a preset was selected
      const imageFilename = req.file ? req.file.filename : (req.body.presetImage || null);

      const newComplaint = db.createComplaint(
        userId,
        issueType,
        description,
        latitude,
        longitude,
        address,
        imageFilename,
        priority
      );

      res.status(201).json({ success: true, complaint: newComplaint });
    } catch (dbErr) {
      res.status(500).json({ success: false, error: dbErr.message });
    }
  });
});

// Update complaint status or priority (Admin only, triggered from dashboard)
app.patch('/api/complaints/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, message, senderName } = req.body;

    if (!status && !priority && !message) {
      return res.status(400).json({ success: false, error: 'At least one field (status, priority, message) must be provided for update' });
    }

    const updatedComplaint = db.updateComplaint(
      id,
      status,
      priority,
      message,
      senderName || 'Administrator'
    );

    res.status(200).json({ success: true, complaint: updatedComplaint });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Query nearby similar complaints
app.get('/api/complaints/nearby', (req, res) => {
  try {
    const { lat, lng, issueType, maxDistanceKm } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'Latitude (lat) and longitude (lng) are required' });
    }

    const nearby = db.getNearbyComplaints(
      parseFloat(lat),
      parseFloat(lng),
      issueType,
      maxDistanceKm ? parseFloat(maxDistanceKm) : 5.0
    );

    res.status(200).json({ success: true, complaints: nearby });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Second / Upvote a complaint
app.post('/api/complaints/:id/second', (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required in the body' });
    }

    const { complaint, seconded } = db.secondComplaint(id, userId);
    res.status(200).json({ success: true, complaint, seconded });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Retrieve latest Karma score for a user
app.get('/api/users/:id/karma', (req, res) => {
  try {
    const { id } = req.params;
    const users = db.getUsers();
    const user = users.find(u => u.User_ID === parseInt(id));
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, karma: user.Karma || 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- NOTIFICATIONS/EMAILS LOG API ---
app.get('/api/notifications', (req, res) => {
  try {
    const notifications = db.getNotifications();
    res.status(200).json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to SPA index.html for unknown web paths
app.get('*', (req, res, next) => {
  // If it's an API route that fell through, return 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  CIVIC ISSUE REPORTING SYSTEM RUNNING ON PORT ${PORT}`);
  console.log(`  Access dashboard: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
