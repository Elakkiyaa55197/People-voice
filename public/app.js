/* ==========================================================================
  URBANVOICE - FRONTEND APPLICATION LOGIC
  ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
  let allComplaints = [];
  let map = null;
  let marker = null;
  let selectedPresetImage = '';
  let activeView = 'view-home';

  // --- CONFIG (Centered in India for nation-wide reporting) ---
  const DEFAULT_LAT = 20.5937;
  const DEFAULT_LNG = 78.9629;

  // --- GOOGLE MAPS LIGHT THEME STYLES ---
  const mapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#e8eef8' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f8fafc' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#cbd5e1' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#cbd5e1' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
    { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
    { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#e2e8f0' }] }
  ];

  // --- ELEMENT SELECTORS ---
  const views = {
    home: document.getElementById('view-home'),
    auth: document.getElementById('view-auth'),
    report: document.getElementById('view-report'),
    myComplaints: document.getElementById('view-my-complaints'),
    admin: document.getElementById('view-admin'),
  };

  const navs = {
    home: document.getElementById('nav-home'),
    report: document.getElementById('nav-report'),
    myComplaints: document.getElementById('nav-my-complaints'),
    admin: document.getElementById('nav-admin'),
    auth: document.getElementById('nav-auth'),
    logout: document.getElementById('nav-logout'),
    logo: document.getElementById('logo-btn'),
  };

  const widgets = {
    profile: document.getElementById('user-profile-widget'),
    displayName: document.getElementById('user-display-name'),
    toastContainer: document.getElementById('toast-container'),
  };

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    if (type === 'error') iconClass = 'fa-circle-exclamation';
    
    toast.innerHTML = `
      <i class="fa-solid ${iconClass}"></i>
      <span>${message}</span>
    `;
    
    widgets.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 4000);
  }

  // --- ROUTING / VIEW CONTROLLER ---
  function showView(viewId) {
    // Hide all views
    Object.keys(views).forEach(key => {
      views[key].classList.remove('active');
    });
    
    // Show active view
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.add('active');
      activeView = viewId;
    }

    // Manage nav button active classes
    Object.keys(navs).forEach(key => {
      if (navs[key]) navs[key].classList.remove('active');
    });

    if (viewId === 'view-home' && navs.home) navs.home.classList.add('active');
    if (viewId === 'view-report' && navs.report) navs.report.classList.add('active');
    if (viewId === 'view-my-complaints' && navs.myComplaints) navs.myComplaints.classList.add('active');
    if (viewId === 'view-admin' && navs.admin) navs.admin.classList.add('active');

    // Trigger actions based on view loaded
    if (viewId === 'view-home') {
      loadHomeData();
    } else if (viewId === 'view-my-complaints') {
      loadUserComplaints();
    } else if (viewId === 'view-admin') {
      loadAdminDashboard();
    } else if (viewId === 'view-report') {
      initReportMap();
    }
  }

  // Update navbar visibility based on login state
  async function updateNavbar() {
    if (currentUser) {
      if (navs.auth) navs.auth.style.display = 'none';
      if (widgets.profile) widgets.profile.style.display = 'flex';

      // Silently fetch and sync fresh Karma score
      try {
        const response = await fetch(`/api/users/${currentUser.User_ID}/karma`);
        const result = await response.json();
        if (result.success) {
          currentUser.Karma = result.karma;
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
      } catch (err) {}

      if (widgets.displayName) {
        widgets.displayName.innerHTML = `
          <span>${currentUser.Name} (${currentUser.Role})</span>
          <span class="user-karma-badge" title="Civic Karma Points">🏆 ${currentUser.Karma || 10} Karma</span>
        `;
      }
      
      if (currentUser.Role === 'Admin') {
        if (navs.admin) navs.admin.style.display = 'inline-flex';
        if (navs.myComplaints) navs.myComplaints.style.display = 'none';
      } else {
        if (navs.admin) navs.admin.style.display = 'none';
        if (navs.myComplaints) navs.myComplaints.style.display = 'inline-flex';
      }
    } else {
      if (navs.auth) navs.auth.style.display = 'inline-flex';
      if (widgets.profile) widgets.profile.style.display = 'none';
      if (navs.admin) navs.admin.style.display = 'none';
      if (navs.myComplaints) navs.myComplaints.style.display = 'none';
    }
  }

  // --- GOOGLE MAPS INTEGRATION ---
  function initReportMap() {
    // Avoid double initialization
    if (map) {
      return;
    }

    // Create Google Map centered in India
    const mapOptions = {
      center: { lat: DEFAULT_LAT, lng: DEFAULT_LNG },
      zoom: 5,
      styles: mapStyle,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    };

    map = new google.maps.Map(document.getElementById('report-map'), mapOptions);

    // Draggable purple pin using SVG path
    marker = new google.maps.Marker({
      position: { lat: DEFAULT_LAT, lng: DEFAULT_LNG },
      map: map,
      draggable: true,
      title: "Drag to pin civic issue",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#6366f1',
        fillOpacity: 1.0,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 8
      }
    });

    // Populate initial coordinates
    updateFormCoordinates(DEFAULT_LAT, DEFAULT_LNG);

    // Drag events
    google.maps.event.addListener(marker, 'dragend', () => {
      const pos = marker.getPosition();
      const lat = pos.lat();
      const lng = pos.lng();
      updateFormCoordinates(lat, lng);
      reverseGeocode(lat, lng);
    });

    // Map click events
    google.maps.event.addListener(map, 'click', (e) => {
      marker.setPosition(e.latLng);
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      updateFormCoordinates(lat, lng);
      reverseGeocode(lat, lng);
    });
  }

  function updateFormCoordinates(lat, lng) {
    document.getElementById('report-latitude').value = lat.toFixed(6);
    document.getElementById('report-longitude').value = lng.toFixed(6);
    document.getElementById('coord-lat').textContent = lat.toFixed(6);
    document.getElementById('coord-lng').textContent = lng.toFixed(6);

    // Check if issue type is selected, search nearby
    const issueType = document.getElementById('report-issue-type').value;
    if (issueType) {
      checkNearbyDuplicates(lat, lng, issueType);
    }
  }

  // Google Maps Reverse Geocoding
  function reverseGeocode(lat, lng) {
    const addressInput = document.getElementById('report-address');
    addressInput.value = 'Locating address...';

    const geocoder = new google.maps.Geocoder();
    const latlng = { lat: parseFloat(lat), lng: parseFloat(lng) };

    geocoder.geocode({ location: latlng }, (results, status) => {
      if (status === 'OK') {
        if (results[0]) {
          addressInput.value = results[0].formatted_address;
        } else {
          addressInput.value = `Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        }
      } else {
        addressInput.value = `Location near (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
    });
  }

  // --- PROXIMITY CHECK (ANTI-DUPLICATE) ---
  async function checkNearbyDuplicates(lat, lng, issueType) {
    const nearbyPanel = document.getElementById('nearby-panel');
    const nearbyList = document.getElementById('nearby-complaints-list');
    
    try {
      const res = await fetch(`/api/complaints/nearby?lat=${lat}&lng=${lng}&issueType=${issueType}&maxDistanceKm=2.0`);
      const data = await res.json();
      
      if (data.success && data.complaints.length > 0) {
        nearbyPanel.style.display = 'block';
        nearbyList.innerHTML = '';
        
        data.complaints.forEach(issue => {
          const item = document.createElement('div');
          item.className = 'nearby-item';
          
          const imgPath = issue.Image ? `/uploads/${issue.Image}` : '/uploads/pothole.svg';
          
          item.innerHTML = `
            <img class="nearby-item-img" src="${imgPath}" alt="Similar Issue">
            <div class="nearby-item-info">
              <div class="flex-between">
                <strong>#${issue.Complaint_ID} - ${issue.Issue_Type}</strong>
                <span class="proximity-tag">${issue.distanceKm} km away</span>
              </div>
              <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0.25rem 0;">${issue.Description.substring(0, 50)}...</p>
              <div class="nearby-item-meta">
                <span>Status: <strong class="badge-status ${issue.Status.toLowerCase().replace(' ', '-')}">${issue.Status}</strong></span>
                <span>Priority: <strong>${issue.Priority}</strong></span>
              </div>
            </div>
          `;
          
          // Let user click similar issues to inspect details
          item.classList.add('cursor-pointer');
          item.addEventListener('click', () => {
            showComplaintDetail(issue.Complaint_ID);
          });
          
          nearbyList.appendChild(item);
        });
      } else {
        nearbyPanel.style.display = 'none';
      }
    } catch (err) {
      console.error('Error fetching nearby complaints:', err);
    }
  }

  // Trigger nearby search when changing issue category
  document.getElementById('report-issue-type').addEventListener('change', (e) => {
    const lat = parseFloat(document.getElementById('report-latitude').value);
    const lng = parseFloat(document.getElementById('report-longitude').value);
    if (!isNaN(lat) && !isNaN(lng)) {
      checkNearbyDuplicates(lat, lng, e.target.value);
    }
  });

  // --- PHOTO UPLOAD & PRESET DRAG-N-DROP ---
  const fileDropzone = document.getElementById('file-dropzone');
  const imageInput = document.getElementById('report-image-input');
  const filePreview = document.getElementById('file-preview');
  const filePreviewImg = document.getElementById('file-preview-img');
  const clearImageBtn = document.getElementById('clear-image-btn');
  const presetOptions = document.querySelectorAll('.preset-photo-option');

  // Trigger input click on dropzone click
  fileDropzone.addEventListener('click', () => {
    // but not if clicked inputs
  });

  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelected(file);
    }
  });

  // Drag-and-drop actions
  ['dragenter', 'dragover'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropzone.classList.remove('dragover');
    }, false);
  });

  fileDropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      imageInput.files = e.dataTransfer.files;
      handleFileSelected(file);
    } else {
      showToast('Please upload an image file!', 'error');
    }
  });

  function handleFileSelected(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      filePreviewImg.src = e.target.result;
      filePreview.style.display = 'block';
      fileDropzone.style.display = 'none';
      
      // Deselect preset options
      resetPresetSelection();
    };
    reader.readAsDataURL(file);
  }

  clearImageBtn.addEventListener('click', () => {
    imageInput.value = '';
    filePreviewImg.src = '';
    filePreview.style.display = 'none';
    fileDropzone.style.display = 'block';
  });

  // Preset Selection Click
  presetOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      resetPresetSelection();
      opt.classList.add('selected');
      selectedPresetImage = opt.getAttribute('data-filename');
      
      // If we chose a preset, clear the file input upload
      imageInput.value = '';
      filePreviewImg.src = '';
      filePreview.style.display = 'none';
      fileDropzone.style.display = 'block';
    });
  });

  function resetPresetSelection() {
    presetOptions.forEach(opt => opt.classList.remove('selected'));
    selectedPresetImage = '';
  }

  // --- RENDER COMPLAINTS ---
  function renderComplaintsGrid(gridElement, complaintsList) {
    gridElement.innerHTML = '';
    
    if (complaintsList.length === 0) {
      gridElement.innerHTML = `
        <div class="glass-panel text-center" style="grid-column: 1 / -1; padding: 3rem;">
          <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <p style="color: var(--text-muted);">No complaints match this filter criteria.</p>
        </div>
      `;
      return;
    }

    complaintsList.forEach(complaint => {
      const card = document.createElement('div');
      card.className = 'complaint-card glass-panel';
      
      const imgPath = complaint.Image ? `/uploads/${complaint.Image}` : '/uploads/pothole.svg';
      const formattedDate = new Date(complaint.Date).toLocaleDateString(undefined, { 
        month: 'short', day: 'numeric', year: 'numeric' 
      });

      const hasSeconded = currentUser && complaint.UpvotedBy && complaint.UpvotedBy.includes(currentUser.User_ID);
      const isResolved = complaint.Status === 'Resolved';
      const upvotesCount = complaint.Upvotes || 0;
      
      card.innerHTML = `
        <div class="complaint-img-container">
          <img class="complaint-img" src="${imgPath}" alt="${complaint.Issue_Type}">
          <div class="complaint-badge-group">
            <span class="badge badge-priority-${complaint.Priority.toLowerCase()}">${complaint.Priority}</span>
            <span class="badge badge-status ${complaint.Status.toLowerCase().replace(' ', '-')}">${complaint.Status}</span>
          </div>
        </div>
        <div class="complaint-content">
          <div class="complaint-type">${complaint.Issue_Type}</div>
          <p class="complaint-desc">${complaint.Description}</p>
          <div class="complaint-footer-meta">
            <div class="complaint-loc" title="${complaint.Location.address}">
              <i class="fa-solid fa-location-dot"></i> ${complaint.Location.address}
            </div>
            <div>
              <i class="fa-solid fa-calendar"></i> ${formattedDate}
            </div>
          </div>
          <div class="complaint-action-row" style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 0.75rem;">
            <button class="btn-second ${hasSeconded ? 'active' : ''}" ${isResolved ? 'disabled title="Resolved complaints cannot be seconded"' : ''}>
              <i class="fa-solid ${hasSeconded ? 'fa-check-double' : 'fa-plus'}"></i>
              <span>${hasSeconded ? 'Seconded' : 'Second Issue'}</span>
              <span class="upvote-badge">${upvotesCount}</span>
            </button>
          </div>
        </div>
      `;
      
      card.addEventListener('click', () => {
        showComplaintDetail(complaint.Complaint_ID);
      });

      const secondBtn = card.querySelector('.btn-second');
      if (secondBtn) {
        secondBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!currentUser) {
            showToast('Please login to support/second issues!', 'warning');
            return;
          }
          
          try {
            const res = await fetch(`/api/complaints/${complaint.Complaint_ID}/second`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: currentUser.User_ID })
            });
            const data = await res.json();
            
            if (data.success) {
              if (data.seconded) {
                showToast('You seconded this issue! Earned +5 Karma points.', 'success');
              } else {
                showToast('You retracted your support for this issue.', 'info');
              }
              loadHomeData();
              loadUserComplaints();
              updateNavbar();
            } else {
              showToast(data.error || 'Failed to update support status', 'error');
            }
          } catch (err) {
            showToast('Network error updating support status', 'error');
          }
        });
      }
      
      gridElement.appendChild(card);
    });
  }

  // --- HOME FEED LOAD ---
  async function loadHomeData() {
    const grid = document.getElementById('home-complaints-grid');
    const filter = document.getElementById('home-issue-filter').value;
    
    try {
      const res = await fetch('/api/complaints');
      const data = await res.json();
      
      if (data.success) {
        allComplaints = data.complaints;
        
        // Compute statistics counts
        const total = allComplaints.length;
        const pending = allComplaints.filter(c => c.Status === 'Pending').length;
        const progress = allComplaints.filter(c => c.Status === 'In Progress').length;
        const resolved = allComplaints.filter(c => c.Status === 'Resolved').length;
        
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-progress').textContent = progress;
        document.getElementById('stat-resolved').textContent = resolved;
        
        const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        document.getElementById('resolution-percentage').textContent = `${rate}%`;
        document.getElementById('resolution-progress-bar').style.width = `${rate}%`;
        
        // Filter and display in feed
        const filtered = filter ? allComplaints.filter(c => c.Issue_Type === filter) : allComplaints;
        renderComplaintsGrid(grid, filtered);
      }
    } catch (err) {
      showToast('Failed to load recent complaints', 'error');
    }
  }

  document.getElementById('home-issue-filter').addEventListener('change', loadHomeData);

  // --- CITIZEN DASHBOARD LOAD ---
  async function loadUserComplaints() {
    const grid = document.getElementById('user-complaints-grid');
    const emptyState = document.getElementById('user-empty-state');
    const filter = document.getElementById('user-status-filter').value;
    
    if (!currentUser) return;
    
    try {
      const res = await fetch(`/api/complaints?userId=${currentUser.User_ID}`);
      const data = await res.json();
      
      if (data.success) {
        const userComplaints = data.complaints;
        
        if (userComplaints.length === 0) {
          grid.style.display = 'none';
          emptyState.style.display = 'block';
        } else {
          grid.style.display = 'grid';
          emptyState.style.display = 'none';
          
          const filtered = filter ? userComplaints.filter(c => c.Status === filter) : userComplaints;
          renderComplaintsGrid(grid, filtered);
        }
      }
    } catch (err) {
      showToast('Failed to load dashboard', 'error');
    }
  }

  document.getElementById('user-status-filter').addEventListener('change', loadUserComplaints);

  // --- ADMIN DASHBOARD LOAD ---
  async function loadAdminDashboard() {
    const tbody = document.getElementById('admin-complaints-tbody');
    const filter = document.getElementById('admin-table-status-filter').value;
    
    try {
      const res = await fetch('/api/complaints');
      const data = await res.json();
      
      if (data.success) {
        const complaints = data.complaints;
        
        // Set stats cards
        const total = complaints.length;
        const pending = complaints.filter(c => c.Status === 'Pending').length;
        const progress = complaints.filter(c => c.Status === 'In Progress').length;
        const resolved = complaints.filter(c => c.Status === 'Resolved').length;
        
        document.getElementById('admin-stat-total').textContent = total;
        document.getElementById('admin-stat-pending').textContent = pending;
        document.getElementById('admin-stat-progress').textContent = progress;
        document.getElementById('admin-stat-resolved').textContent = resolved;
        
        // Filter table rows
        const filtered = filter ? complaints.filter(c => c.Status === filter) : complaints;
        
        tbody.innerHTML = '';
        if (filtered.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" class="text-center" style="color: var(--text-muted); padding: 2rem;">No complaints require action matching this filter.</td>
            </tr>
          `;
        } else {
          filtered.forEach(c => {
            const tr = document.createElement('tr');
            const dateStr = new Date(c.Date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            
            tr.innerHTML = `
              <td><strong>#${c.Complaint_ID}</strong></td>
              <td>${c.Issue_Type}</td>
              <td><span class="badge badge-priority-${c.Priority.toLowerCase()}">${c.Priority}</span></td>
              <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.Location.address}">${c.Location.address}</td>
              <td>${dateStr}</td>
              <td><span class="badge badge-status ${c.Status.toLowerCase().replace(' ', '-')}">${c.Status}</span></td>
              <td style="text-align: right;">
                <button class="admin-action-btn" data-id="${c.Complaint_ID}">Manage</button>
              </td>
            `;
            
            tr.querySelector('.admin-action-btn').addEventListener('click', () => {
              showComplaintDetail(c.Complaint_ID);
            });
            
            tbody.appendChild(tr);
          });
        }
      }
      
      // Load outbox email log
      loadEmailLogs();
    } catch (err) {
      showToast('Error loading administrative data', 'error');
    }
  }

  document.getElementById('admin-table-status-filter').addEventListener('change', loadAdminDashboard);

  async function loadEmailLogs() {
    const list = document.getElementById('email-log-list');
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      
      if (data.success) {
        list.innerHTML = '';
        if (data.notifications.length === 0) {
          list.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">No email notifications logged yet.</p>';
          return;
        }
        
        data.notifications.forEach(mail => {
          const item = document.createElement('div');
          item.className = 'email-log-item';
          const time = new Date(mail.sentAt).toLocaleTimeString();
          
          item.innerHTML = `
            <div class="email-log-header">
              <span>To: <strong class="email-log-to">${mail.to}</strong></span>
              <span><i class="fa-regular fa-clock"></i> ${time}</span>
            </div>
            <div class="email-log-subject">${mail.subject}</div>
            <div class="email-log-body">${mail.body}</div>
          `;
          
          list.appendChild(item);
        });
      }
    } catch (err) {
      console.error('Error loading email logs:', err);
    }
  }

  // --- DETAILS MODAL CONTROLLER ---
  const modal = document.getElementById('detail-modal-overlay');
  const closeModalBtn = document.getElementById('close-modal-btn');
  let currentlyEditingComplaintId = null;

  async function showComplaintDetail(id) {
    try {
      const res = await fetch(`/api/complaints/${id}`);
      const data = await res.json();
      
      if (data.success) {
        const c = data.complaint;
        currentlyEditingComplaintId = c.Complaint_ID;
        
        // Fill details
        document.getElementById('modal-title').textContent = `${c.Issue_Type}`;
        
        const statusBadge = document.getElementById('modal-status-badge');
        statusBadge.textContent = c.Status;
        statusBadge.className = `badge badge-status ${c.Status.toLowerCase().replace(' ', '-')}`;
        
        const imgPath = c.Image ? `/uploads/${c.Image}` : '/uploads/pothole.svg';
        document.getElementById('modal-image').src = imgPath;
        
        document.getElementById('modal-id').textContent = `#${c.Complaint_ID}`;
        document.getElementById('modal-priority').textContent = c.Priority;
        document.getElementById('modal-priority').className = `badge badge-priority-${c.Priority.toLowerCase()}`;
        document.getElementById('modal-address').textContent = c.Location.address;
        
        const dateStr = new Date(c.Date).toLocaleDateString(undefined, { 
          month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        document.getElementById('modal-date').textContent = dateStr;
        document.getElementById('modal-description').textContent = c.Description;
        
        // Render upvote / seconds count
        const secondsCount = document.getElementById('modal-seconds-count');
        if (secondsCount) {
          secondsCount.textContent = `${c.Upvotes || 0} Seconds`;
        }
        
        // Render timeline
        const timelineContainer = document.getElementById('modal-timeline');
        timelineContainer.innerHTML = '';
        
        c.Timeline.forEach(node => {
          const item = document.createElement('div');
          item.className = `timeline-node status-${node.Status.toLowerCase().replace(' ', '-')}`;
          
          const time = new Date(node.Date).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          
          item.innerHTML = `
            <div class="timeline-title">${node.Status}</div>
            <div class="timeline-date">${time}</div>
            <div class="timeline-desc">${node.Message}</div>
          `;
          timelineContainer.appendChild(item);
        });

        // Toggle Admin Controls Panel if Admin is logged in
        const adminPanel = document.getElementById('modal-admin-control-panel');
        if (currentUser && currentUser.Role === 'Admin') {
          adminPanel.style.display = 'block';
          // Pre-populate admin options
          document.getElementById('admin-update-status').value = c.Status;
          document.getElementById('admin-update-priority').value = c.Priority;
          document.getElementById('admin-update-message').value = '';
        } else {
          adminPanel.style.display = 'none';
        }

        // Show Modal overlay
        modal.classList.add('active');
      }
    } catch (err) {
      showToast('Error reading complaint details', 'error');
    }
  }

  // Close modal click handlers
  closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    currentlyEditingComplaintId = null;
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      currentlyEditingComplaintId = null;
    }
  });

  // Commit Admin Status Update Form
  document.getElementById('admin-update-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentlyEditingComplaintId || !currentUser) return;

    const status = document.getElementById('admin-update-status').value;
    const priority = document.getElementById('admin-update-priority').value;
    const message = document.getElementById('admin-update-message').value;

    try {
      const res = await fetch(`/api/complaints/${currentlyEditingComplaintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          priority,
          message,
          senderName: currentUser.Name
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Complaint status updated and notification email sent!');
        // Refresh detail views
        showComplaintDetail(currentlyEditingComplaintId);
        
        // Refresh parent screen views
        if (activeView === 'view-admin') {
          loadAdminDashboard();
        } else {
          loadHomeData();
        }
      } else {
        showToast(data.error || 'Failed to update complaint', 'error');
      }
    } catch (err) {
      showToast('Network error updating complaint', 'error');
    }
  });

  // --- FORM SUBMISSIONS ---

  // Auth: Register Submission
  document.getElementById('register-form-element').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Account created successfully! Please sign in.');
        
        // Swap tab to login
        document.getElementById('tab-login-btn').click();
        
        // Reset inputs
        document.getElementById('register-form-element').reset();
      } else {
        showToast(data.error || 'Registration failed', 'error');
      }
    } catch (err) {
      showToast('Network connection error', 'error');
    }
  });

  // Auth: Login Submission
  document.getElementById('login-form-element').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showToast(`Welcome back, ${currentUser.Name}!`);
        updateNavbar();
        
        // Redirect based on role
        if (currentUser.Role === 'Admin') {
          showView('view-admin');
        } else {
          showView('view-my-complaints');
        }
        
        document.getElementById('login-form-element').reset();
      } else {
        showToast(data.error || 'Invalid credentials', 'error');
      }
    } catch (err) {
      showToast('Login connection failed', 'error');
    }
  });

  // Report Form Submission
  document.getElementById('report-issue-form-element').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
      showToast('You must be logged in to report a civic issue!', 'warning');
      showView('view-auth');
      return;
    }

    const issueType = document.getElementById('report-issue-type').value;
    const priority = document.getElementById('report-priority').value;
    const description = document.getElementById('report-description').value;
    const address = document.getElementById('report-address').value;
    const latitude = document.getElementById('report-latitude').value;
    const longitude = document.getElementById('report-longitude').value;
    
    const formData = new FormData();
    formData.append('userId', currentUser.User_ID);
    formData.append('issueType', issueType);
    formData.append('priority', priority);
    formData.append('description', description);
    formData.append('address', address);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);

    // Image attachment: either file input or selected preset
    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    } else if (selectedPresetImage) {
      formData.append('presetImage', selectedPresetImage);
    }

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        showToast('Complaint registered successfully! Email alert sent.');
        
        // Reset form
        document.getElementById('report-issue-form-element').reset();
        clearImageBtn.click();
        resetPresetSelection();
        
        // Redirect to dashboard
        showView('view-my-complaints');
      } else {
        showToast(data.error || 'Failed to submit complaint', 'error');
      }
    } catch (err) {
      showToast('Network error submitting complaint', 'error');
    }
  });

  // --- BUTTON CLICKS / STATIC EVENT LISTENERS ---

  // Auth Screen Tab Swap
  document.getElementById('tab-login-btn').addEventListener('click', () => {
    document.getElementById('tab-login-btn').classList.add('active');
    document.getElementById('tab-register-btn').classList.remove('active');
    document.getElementById('form-login').classList.add('active');
    document.getElementById('form-register').classList.remove('active');
  });

  document.getElementById('tab-register-btn').addEventListener('click', () => {
    document.getElementById('tab-register-btn').classList.add('active');
    document.getElementById('tab-login-btn').classList.remove('active');
    document.getElementById('form-register').classList.add('active');
    document.getElementById('form-login').classList.remove('active');
  });

  // Navbar Links Routing
  navs.home.addEventListener('click', () => showView('view-home'));
  navs.logo.addEventListener('click', (e) => {
    e.preventDefault();
    showView('view-home');
  });
  
  navs.report.addEventListener('click', () => {
    if (!currentUser) {
      showToast('Please sign in to report an issue', 'warning');
      showView('view-auth');
    } else {
      showView('view-report');
    }
  });
  
  navs.myComplaints.addEventListener('click', () => showView('view-my-complaints'));
  navs.admin.addEventListener('click', () => showView('view-admin'));
  navs.auth.addEventListener('click', () => showView('view-auth'));
  
  navs.logout.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showToast('Logged out successfully');
    updateNavbar();
    showView('view-home');
  });

  // CTA Buttons on Home View
  document.getElementById('hero-report-btn').addEventListener('click', () => {
    navs.report.click();
  });
  
  document.getElementById('hero-track-btn').addEventListener('click', () => {
    // Scroll down to recent complaints on home page
    document.getElementById('home-complaints-grid').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('empty-state-report-btn').addEventListener('click', () => {
    navs.report.click();
  });

  // --- INITIALIZE APPLICATION ---
  updateNavbar();
  showView('view-home'); // Initially load Home view and trigger fetch
});
