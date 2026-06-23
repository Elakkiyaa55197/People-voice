const db = require('./db');

console.log('====================================================');
console.log('   RUNNING PEOPLEVOICE CORE API & DB TESTS');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

try {
  // --- TEST 1: User Queries and Seed Data ---
  console.log('--- Test Group 1: Users & Auth ---');
  const users = db.getUsers();
  assert(users.length >= 2, 'Should contain at least 2 seeded users (Admin and Citizen)');
  
  const admin = db.findUserByEmail('admin@civic.org');
  assert(admin && admin.Role === 'Admin', 'Admin user should be retrieved with admin role');
  
  const invalidUser = db.findUserByEmail('doesnotexist@civic.org');
  assert(invalidUser === undefined, 'Non-existent user lookup should return undefined');

  // --- TEST 2: Register New User ---
  const newEmail = `user-${Date.now()}@test.com`;
  const newUser = db.createUser('Jane Doe', newEmail, 'pass123');
  assert(newUser.User_ID > 2, 'New user should have a sequential incremental User_ID');
  assert(newUser.Name === 'Jane Doe', 'New user name should match registration data');

  // Verify registration duplicate restriction
  try {
    db.createUser('Duplicate Test', newEmail, 'pass456');
    assert(false, 'Should throw an error when registering a duplicate email');
  } catch (err) {
    assert(err.message.includes('already registered'), 'Duplicate registration should throw email registered error');
  }

  // --- TEST 3: Complaint Filing ---
  console.log('\n--- Test Group 2: Complaint Filing ---');
  const startComplaints = db.getComplaints();
  
  const newComplaint = db.createComplaint(
    2, // John Doe's User_ID
    'Pothole',
    'Major damage on road near Albert Ekka Chowk.',
    23.3436,
    85.3125,
    'Albert Ekka Chowk, Ranchi, Jharkhand',
    'test-pothole.png',
    'High'
  );
  
  assert(newComplaint.Complaint_ID >= 104, 'New complaint should have a valid Complaint_ID');
  assert(newComplaint.Status === 'Pending', 'New complaint should default to Pending status');
  assert(newComplaint.Timeline.length === 1, 'New complaint should have exactly one timeline entry');
  
  // Verify notification created
  const notifications = db.getNotifications();
  assert(notifications.length > 0, 'Filing a complaint should generate a notification email');
  assert(notifications[0].to === 'citizen@civic.org', 'Notification should be addressed to the reporting citizen');

  // --- TEST 4: Proximity Analysis (Nearby Similar Complaints) ---
  console.log('\n--- Test Group 3: Proximity Analysis & Proximity Alert ---');
  
  // File a complaint close to Marine Drive, Mumbai (e.g. same type 'Pothole')
  const nearbyPothole = db.getNearbyComplaints(18.9410, 72.8250, 'Pothole');
  assert(nearbyPothole.length > 0, 'Should detect pothole complaint reported nearby');
  
  // File a complaint further away (e.g., in Delhi, 1000km away)
  const farAwayPothole = db.getNearbyComplaints(28.6300, 77.2100, 'Pothole');
  assert(farAwayPothole.length === 0, 'Should not detect complaints reported far away (> 5km default)');

  // Filter by different issue type
  const nearbyBrokenLight = db.getNearbyComplaints(18.9410, 72.8250, 'Broken Streetlight');
  assert(
    nearbyBrokenLight.every(c => c.Issue_Type === 'Broken Streetlight'),
    'Nearby filter should exclude complaints of a different issue type'
  );

  // --- TEST 5: Update Complaint Status (Admin workflow) ---
  console.log('\n--- Test Group 4: Administrative Management ---');
  
  const updated = db.updateComplaint(
    newComplaint.Complaint_ID,
    'In Progress',
    'High',
    'Inspection team dispatched to site.',
    'System Admin'
  );
  
  assert(updated.Status === 'In Progress', 'Status should update to In Progress');
  assert(updated.Timeline.length === 2, 'Timeline should now contain two events');
  assert(updated.Timeline[1].Message.includes('dispatched'), 'Timeline message should reflect updates');
  
  const latestNotifications = db.getNotifications();
  assert(
    latestNotifications[0].subject.includes('In Progress'), 
    'Updating status should send an update notification email'
  );

  // --- TEST 6: Seconding and Civic Karma Points ---
  console.log('\n--- Test Group 5: Seconding & Civic Karma Points ---');
  
  const userObj = db.findUserByEmail(newEmail);
  assert(userObj.Karma === 10, 'New user should start with 10 Karma points');
  
  const creator = db.getUsers().find(u => u.User_ID === 2);
  assert(creator.Karma >= 30, 'Creator should have gained Karma points for filing complaint');
  
  const initialUpvotes = newComplaint.Upvotes || 0;
  const initialCreatorKarma = creator.Karma;
  const initialSeconderKarma = userObj.Karma;
  
  const result = db.secondComplaint(newComplaint.Complaint_ID, userObj.User_ID);
  assert(result.seconded === true, 'secondComplaint should return seconded: true');
  assert(result.complaint.Upvotes === initialUpvotes + 1, 'Upvotes count should increment');
  
  const updatedCreator = db.getUsers().find(u => u.User_ID === 2);
  const updatedSeconder = db.getUsers().find(u => u.User_ID === userObj.User_ID);
  
  assert(updatedCreator.Karma === initialCreatorKarma + 10, 'Creator should gain 10 Karma points');
  assert(updatedSeconder.Karma === initialSeconderKarma + 5, 'Seconder should gain 5 Karma points');
  
  const retractResult = db.secondComplaint(newComplaint.Complaint_ID, userObj.User_ID);
  assert(retractResult.seconded === false, 'secondComplaint should return seconded: false when retracting');
  assert(retractResult.complaint.Upvotes === initialUpvotes, 'Upvotes count should return to initial');
  
  const finalCreator = db.getUsers().find(u => u.User_ID === 2);
  const finalSeconder = db.getUsers().find(u => u.User_ID === userObj.User_ID);
  
  assert(finalCreator.Karma === initialCreatorKarma, 'Creator Karma should be deducted on support retraction');
  assert(finalSeconder.Karma === initialSeconderKarma, 'Seconder Karma should be deducted on support retraction');

  console.log('\n====================================================');
  console.log(`   TEST RUN COMPLETED. Passed: ${passCount} | Failed: ${failCount}`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
} catch (error) {
  console.error('Fatal testing error:', error);
  process.exit(1);
}
