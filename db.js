const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const COMPLAINTS_FILE = path.join(DATA_DIR, 'complaints.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

// Ensure data directory and files exist
function initDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }

  // Initialize Users
  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = [
      {
        User_ID: 1,
        Name: 'System Admin',
        Email: 'admin@civic.org',
        Password: 'admin123', // In a real app we would hash passwords, but keeping it simple/visible for the mini project
        Role: 'Admin'
      },
      {
        User_ID: 2,
        Name: 'John Doe',
        Email: 'citizen@civic.org',
        Password: 'citizen123',
        Role: 'Citizen'
      }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
  }

  // Initialize Complaints
  if (!fs.existsSync(COMPLAINTS_FILE)) {
    const defaultComplaints = [
      {
        Complaint_ID: 101,
        User_ID: 2,
        Issue_Type: 'Pothole',
        Description: 'Deep pothole in the middle of the road. Hazardous for two-wheelers.',
        Location: {
          latitude: 18.9402,
          longitude: 72.8242,
          address: 'Marine Drive, Netaji Subhash Chandra Bose Road, Mumbai, Maharashtra 400020'
        },
        Image: 'pothole.svg',
        Status: 'In Progress',
        Priority: 'High',
        Date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        Timeline: [
          {
            Status: 'Pending',
            Message: 'Complaint registered by John Doe.',
            Date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            Status: 'In Progress',
            Message: 'Assigned to Brihanmumbai Municipal Corporation (BMC) Road Dept.',
            Date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        Upvotes: 0,
        UpvotedBy: []
      },
      {
        Complaint_ID: 102,
        User_ID: 2,
        Issue_Type: 'Broken Streetlight',
        Description: 'Streetlight is broken, making the road pitch dark and unsafe at night.',
        Location: {
          latitude: 28.6304,
          longitude: 77.2177,
          address: 'Connaught Place, Radial Road 1, New Delhi, Delhi 110001'
        },
        Image: 'broken_light.svg',
        Status: 'Pending',
        Priority: 'Medium',
        Date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        Timeline: [
          {
            Status: 'Pending',
            Message: 'Complaint registered by John Doe.',
            Date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        Upvotes: 0,
        UpvotedBy: []
      },
      {
        Complaint_ID: 103,
        User_ID: 2,
        Issue_Type: 'Water Leakage',
        Description: 'Main water supply pipe leaking, flooding the pavement near the market.',
        Location: {
          latitude: 12.9719,
          longitude: 77.6412,
          address: 'Indiranagar Double Road, Bengaluru, Karnataka 560038'
        },
        Image: 'water_leak.svg',
        Status: 'Resolved',
        Priority: 'High',
        Date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        Timeline: [
          {
            Status: 'Pending',
            Message: 'Complaint registered by John Doe.',
            Date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            Status: 'In Progress',
            Message: 'BBMP Plumbing crews dispatched to isolate the leak.',
            Date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            Status: 'Resolved',
            Message: 'Pipe replaced and paving restored. Leak fully resolved by Bengaluru Water Supply Board.',
            Date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        Upvotes: 0,
        UpvotedBy: []
      }
    ];
    fs.writeFileSync(COMPLAINTS_FILE, JSON.stringify(defaultComplaints, null, 2));
  }

  // Initialize Notifications Log (simulated email logs)
  if (!fs.existsSync(NOTIFICATIONS_FILE)) {
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify([], null, 2));
  }

  // Migration to add Karma to existing users
  if (fs.existsSync(USERS_FILE)) {
    try {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      let modified = false;
      users.forEach(u => {
        if (u.Karma === undefined) {
          u.Karma = u.Role === 'Admin' ? 100 : 10;
          modified = true;
        }
      });
      if (modified) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
      }
    } catch (e) {}
  }

  // Migration to add Upvotes and UpvotedBy to existing complaints
  if (fs.existsSync(COMPLAINTS_FILE)) {
    try {
      const complaints = JSON.parse(fs.readFileSync(COMPLAINTS_FILE, 'utf8'));
      let modified = false;
      complaints.forEach(c => {
        if (c.Upvotes === undefined) {
          c.Upvotes = 0;
          c.UpvotedBy = [];
          modified = true;
        }
      });
      if (modified) {
        fs.writeFileSync(COMPLAINTS_FILE, JSON.stringify(complaints, null, 2));
      }
    } catch (e) {}
  }
}

// Read helper
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return [];
  }
}

// Write helper
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Haversine formula to calculate distance in km between two lat/lng pairs
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

const db = {
  // --- USERS API ---
  getUsers: () => {
    initDB();
    return readJSON(USERS_FILE);
  },

  findUserByEmail: (email) => {
    const users = db.getUsers();
    return users.find(u => u.Email.toLowerCase() === email.toLowerCase());
  },

  createUser: (name, email, password) => {
    initDB();
    const users = readJSON(USERS_FILE);
    
    // Check if user already exists
    if (users.some(u => u.Email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Email is already registered');
    }

    const nextId = users.length > 0 ? Math.max(...users.map(u => u.User_ID)) + 1 : 1;
    const newUser = {
      User_ID: nextId,
      Name: name,
      Email: email,
      Password: password,
      Role: 'Citizen', // Default role
      Karma: 10 // Starting Karma points
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);
    return newUser;
  },

  // --- COMPLAINTS API ---
  getComplaints: () => {
    initDB();
    return readJSON(COMPLAINTS_FILE);
  },

  getComplaintById: (id) => {
    const complaints = db.getComplaints();
    return complaints.find(c => c.Complaint_ID === parseInt(id));
  },

  createComplaint: (userId, issueType, description, latitude, longitude, address, image, priority) => {
    initDB();
    const complaints = readJSON(COMPLAINTS_FILE);
    const nextId = complaints.length > 0 ? Math.max(...complaints.map(c => c.Complaint_ID)) + 1 : 101;

    const newComplaint = {
      Complaint_ID: nextId,
      User_ID: parseInt(userId),
      Issue_Type: issueType,
      Description: description,
      Location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || 'Location not specified'
      },
      Image: image || null,
      Status: 'Pending',
      Priority: priority || 'Medium',
      Date: new Date().toISOString(),
      Timeline: [
        {
          Status: 'Pending',
          Message: 'Complaint registered successfully.',
          Date: new Date().toISOString()
        }
      ],
      Upvotes: 0,
      UpvotedBy: []
    };

    complaints.push(newComplaint);
    writeJSON(COMPLAINTS_FILE, complaints);

    // Award +20 Karma points for filing a new complaint
    db.awardKarma(userId, 20);

    // Send email notification (logged)
    const user = db.getUsers().find(u => u.User_ID === parseInt(userId));
    if (user) {
      db.sendEmailNotification(
        user.Email,
        `Complaint Filed: #${newComplaint.Complaint_ID} - ${newComplaint.Issue_Type}`,
        `Hello ${user.Name},\n\nYour complaint regarding "${newComplaint.Issue_Type}" has been successfully logged with Priority: ${newComplaint.Priority}.\n\nDetails: ${newComplaint.Description}\nLocation: ${newComplaint.Location.address}\n\nYou can track the status on your dashboard using Complaint ID: #${newComplaint.Complaint_ID}.\n\nBest regards,\nCivic Issue Resolution Team`
      );
    }

    return newComplaint;
  },

  updateComplaint: (complaintId, status, priority, updateMessage, senderName) => {
    initDB();
    const complaints = readJSON(COMPLAINTS_FILE);
    const index = complaints.findIndex(c => c.Complaint_ID === parseInt(complaintId));

    if (index === -1) {
      throw new Error('Complaint not found');
    }

    const complaint = complaints[index];
    const prevStatus = complaint.Status;

    const oldStatus = complaint.Status;
    if (status) complaint.Status = status;
    if (priority) complaint.Priority = priority;

    const changeMsg = updateMessage || `Complaint updated by ${senderName}. Status: ${status || complaint.Status}, Priority: ${priority || complaint.Priority}`;
    
    complaint.Timeline.push({
      Status: status || complaint.Status,
      Message: changeMsg,
      Date: new Date().toISOString()
    });

    complaints[index] = complaint;
    writeJSON(COMPLAINTS_FILE, complaints);

    // Award +50 Karma points to the creator if status moves to Resolved
    if (status === 'Resolved' && oldStatus !== 'Resolved') {
      db.awardKarma(complaint.User_ID, 50);
    }

    // Notify user if status changed or update message sent
    const user = db.getUsers().find(u => u.User_ID === complaint.User_ID);
    if (user) {
      db.sendEmailNotification(
        user.Email,
        `Update on Complaint: #${complaint.Complaint_ID} [${complaint.Status}]`,
        `Hello ${user.Name},\n\nThere is an update on your complaint #${complaint.Complaint_ID} regarding "${complaint.Issue_Type}".\n\nLatest Status: ${complaint.Status}\nUpdate Details: ${changeMsg}\n\nThank you for helping us maintain our civic infrastructure.\n\nBest regards,\nCivic Issue Resolution Team`
      );
    }

    return complaint;
  },

  // --- MOCK EMAIL NOTIFICATION SYSTEM ---
  getNotifications: () => {
    initDB();
    return readJSON(NOTIFICATIONS_FILE);
  },

  sendEmailNotification: (toEmail, subject, body) => {
    initDB();
    const notifications = readJSON(NOTIFICATIONS_FILE);
    const newMail = {
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      to: toEmail,
      subject: subject,
      body: body,
      sentAt: new Date().toISOString()
    };
    notifications.unshift(newMail); // newest first
    writeJSON(NOTIFICATIONS_FILE, notifications);
    console.log(`[MOCK EMAIL SENT] To: ${toEmail} | Subject: ${subject}`);
    return newMail;
  },

  // --- NEARBY SIMILAR COMPLAINTS ---
  getNearbyComplaints: (latitude, longitude, issueType, maxDistanceKm = 5.0) => {
    const complaints = db.getComplaints();
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) return [];

    return complaints
      .map(c => {
        const dist = getDistanceKm(lat, lng, c.Location.latitude, c.Location.longitude);
        return { ...c, distanceKm: parseFloat(dist.toFixed(2)) };
      })
      .filter(c => {
        // filter by distance and issue type, and skip resolved complaints
        const isNear = c.distanceKm <= maxDistanceKm;
        const isSameType = !issueType || c.Issue_Type.toLowerCase() === issueType.toLowerCase();
        const isNotResolved = c.Status !== 'Resolved';
        return isNear && isSameType && isNotResolved;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  },

  // --- CIVIC GAMIFICATION AND UPVOTING ---
  awardKarma: (userId, points) => {
    initDB();
    const users = readJSON(USERS_FILE);
    const index = users.findIndex(u => u.User_ID === parseInt(userId));
    if (index === -1) return 0;
    
    const user = users[index];
    user.Karma = Math.max(0, (user.Karma || 0) + points);
    users[index] = user;
    writeJSON(USERS_FILE, users);
    return user.Karma;
  },

  secondComplaint: (complaintId, userId) => {
    initDB();
    const complaints = readJSON(COMPLAINTS_FILE);
    const index = complaints.findIndex(c => c.Complaint_ID === parseInt(complaintId));
    if (index === -1) {
      throw new Error('Complaint not found');
    }

    const complaint = complaints[index];
    if (!complaint.UpvotedBy) {
      complaint.UpvotedBy = [];
      complaint.Upvotes = 0;
    }

    const userIdx = complaint.UpvotedBy.indexOf(parseInt(userId));
    let seconded = false;

    if (userIdx === -1) {
      // Citizen seconds the issue
      complaint.UpvotedBy.push(parseInt(userId));
      complaint.Upvotes = complaint.UpvotedBy.length;
      seconded = true;

      // Award +10 Karma to original creator, and +5 Karma to the seconder
      db.awardKarma(complaint.User_ID, 10);
      db.awardKarma(userId, 5);
    } else {
      // Citizen retracts their support
      complaint.UpvotedBy.splice(userIdx, 1);
      complaint.Upvotes = complaint.UpvotedBy.length;
      seconded = false;

      // Deduct points
      db.awardKarma(complaint.User_ID, -10);
      db.awardKarma(userId, -5);
    }

    complaints[index] = complaint;
    writeJSON(COMPLAINTS_FILE, complaints);
    return { complaint, seconded };
  }
};

module.exports = db;
