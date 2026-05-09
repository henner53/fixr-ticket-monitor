const DOM = {
  masterToggle: document.getElementById('masterToggle'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  eventUrl: document.getElementById('eventUrl'),
  autoRotate: document.getElementById('autoRotate'),
  addEventBtn: document.getElementById('addEventBtn'),
  eventsList: document.getElementById('eventsList'),
  profileName: document.getElementById('profileName'),
  profileEmail: document.getElementById('profileEmail'),
  profilePassword: document.getElementById('profilePassword'),
  profileAutoLogin: document.getElementById('profileAutoLogin'),
  addProfileBtn: document.getElementById('addProfileBtn'),
  profilesList: document.getElementById('profilesList'),
  scannerUrl: document.getElementById('scannerUrl'),
  scannerKeywords: document.getElementById('scannerKeywords'),
  addScannerBtn: document.getElementById('addScannerBtn'),
  scannerList: document.getElementById('scannerList'),
  weeklyCounter: document.getElementById('weeklyCounter'),
  normalProfileSelect: document.getElementById('normalProfileSelect'),
  incognitoProfileSelect: document.getElementById('incognitoProfileSelect'),
  saveDualBtn: document.getElementById('saveDualBtn'),
  openBothBtn: document.getElementById('openBothBtn'),
  ntfyTopic: document.getElementById('ntfyTopic'),
  testNtfyBtn: document.getElementById('testNtfyBtn'),
  ntfyStatus: document.getElementById('ntfyStatus'),
  testAllAlertsBtn: document.getElementById('testAllAlertsBtn'),
  alertTestStatus: document.getElementById('alertTestStatus'),
  pollOpenInterval: document.getElementById('pollOpenInterval'),
  pollClosedInterval: document.getElementById('pollClosedInterval'),
  openIntervalDisplay: document.getElementById('openIntervalDisplay'),
  closedIntervalDisplay: document.getElementById('closedIntervalDisplay'),
  enableDesktopNotif: document.getElementById('enableDesktopNotif'),
  enableSound: document.getElementById('enableSound'),
  autoOpenTabs: document.getElementById('autoOpenTabs'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  lastChecked: document.getElementById('lastChecked'),
  pinBtn: document.getElementById('pinBtn'),
  checkNowBtn: document.getElementById('checkNowBtn'),
};

let port;

function connectToServiceWorker() {
  port = chrome.runtime.connect({ name: 'popup' });
  port.onMessage.addListener((msg) => {
    if (msg.type === 'statusUpdate') {
      updateEventDisplay(msg.events);
    }
    if (msg.type === 'lastChecked') {
      DOM.lastChecked.textContent = new Date(msg.timestamp).toLocaleTimeString();
    }
  });
}

async function loadSettings() {
  const data = await chrome.storage.local.get();
  
  if (data.settings) {
    const { settings } = data;
    DOM.masterToggle.classList.toggle('active', settings.monitoringEnabled);
    DOM.pollOpenInterval.value = settings.pollIntervalOpen || 8;
    DOM.pollClosedInterval.value = settings.pollIntervalClosed || 30;
    DOM.enableDesktopNotif.checked = settings.enableDesktopNotif !== false;
    DOM.enableSound.checked = settings.enableSound !== false;
    DOM.autoOpenTabs.checked = settings.autoOpenTabs !== false;
    updateIntervalDisplays();
  }
  
  if (data.ntfyTopic) {
    DOM.ntfyTopic.value = data.ntfyTopic;
  }
  
  if (data.events) {
    updateEventDisplay(data.events);
  }
  
  if (data.profiles) {
    updateProfilesList(data.profiles);
    updateProfileSelects(data.profiles, data.activeProfileId);
  }
  
  if (data.scanners) {
    updateScannerList(data.scanners);
  }
  
  if (data.weeklyStats) {
    updateWeeklyCounter(data.weeklyStats);
  }
  
  if (data.lastPolled) {
    DOM.lastChecked.textContent = new Date(data.lastPolled).toLocaleTimeString();
  }
}

DOM.masterToggle.addEventListener('click', async () => {
  DOM.masterToggle.classList.toggle('active');
  const enabled = DOM.masterToggle.classList.contains('active');
  const data = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({
    'settings': { ...(data.settings || {}), monitoringEnabled: enabled }
  });
  chrome.runtime.sendMessage({ type: 'toggleMonitoring', enabled });
});

DOM.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    DOM.tabBtns.forEach(b => b.classList.remove('active'));
    DOM.tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  });
});

DOM.addEventBtn.addEventListener('click', async () => {
  const url = DOM.eventUrl.value.trim();
  if (!url) return;
  
  const match = url.match(/\/([a-z0-9-]+)-tickets\/?$/i);
  const name = match ? match[1].replace(/-/g, ' ').toUpperCase() : 'Event';
  
  const event = {
    id: `event_${Date.now()}`,
    name,
    url,
    autoRotate: DOM.autoRotate.checked,
    enabled: true,
    status: 'pending',
    lastChecked: null,
    createdAt: new Date().toISOString()
  };
  
  const data = await chrome.storage.local.get('events');
  const events = data.events || [];
  events.push(event);
  
  await chrome.storage.local.set({ events });
  DOM.eventUrl.value = '';
  DOM.autoRotate.checked = false;
  
  updateEventDisplay(events);
  chrome.runtime.sendMessage({ type: 'pollNow' });
});

function updateEventDisplay(events) {
  DOM.eventsList.innerHTML = '';
  
  if (!events || events.length === 0) {
    DOM.eventsList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No events added. Add one to get started!</p></div>';
    return;
  }
  
  events.forEach(event => {
    const statusClass = event.status === 'live' ? 'live' : event.status === 'soldout' ? 'soldout' : 'pending';
    const lastCheckedText = event.lastChecked ? new Date(event.lastChecked).toLocaleTimeString() : 'Never';
    
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="event-card-left">
        <div class="event-name">${event.name}</div>
        <div class="event-meta">
          <div style="margin-bottom: 4px;"><span class="status-dot ${statusClass}"></span> ${event.status}</div>
          <div>Last: ${lastCheckedText}</div>
          <div style="word-break: break-all; font-size: 10px;">${event.url}</div>
        </div>
      </div>
      <div class="event-controls">
        ${event.autoRotate ? '<span class="badge">🔄 Rotate</span>' : ''}
        <button class="btn-danger btn-small" data-event-id="${event.id}">Remove</button>
      </div>
    `;
    
    card.querySelector('[data-event-id]').addEventListener('click', async () => {
      const data = await chrome.storage.local.get('events');
      const filtered = data.events.filter(e => e.id !== event.id);
      await chrome.storage.local.set({ events: filtered });
      updateEventDisplay(filtered);
    });
    
    DOM.eventsList.appendChild(card);
  });
}

DOM.addProfileBtn.addEventListener('click', async () => {
  const name = DOM.profileName.value.trim();
  const email = DOM.profileEmail.value.trim();
  const password = DOM.profilePassword.value;
  
  if (!name || !email || !password) return;
  
  const profile = {
    id: `profile_${Date.now()}`,
    name,
    email,
    password,
    autoLogin: DOM.profileAutoLogin.checked,
    createdAt: new Date().toISOString()
  };
  
  const data = await chrome.storage.local.get('profiles');
  const profiles = data.profiles || [];
  profiles.push(profile);
  
  await chrome.storage.local.set({ profiles });
  DOM.profileName.value = '';
  DOM.profileEmail.value = '';
  DOM.profilePassword.value = '';
  DOM.profileAutoLogin.checked = false;
  
  updateProfilesList(profiles);
  updateProfileSelects(profiles, data.activeProfileId);
});

function updateProfilesList(profiles) {
  DOM.profilesList.innerHTML = '';
  
  if (!profiles || profiles.length === 0) {
    DOM.profilesList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👤</div><p>No profiles. Add one to enable auto-login.</p></div>';
    return;
  }
  
  profiles.forEach(profile => {
    const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${initials}</div>
        <div class="profile-info">
          <div class="profile-name">${profile.name}</div>
          <div class="profile-email">${profile.email}</div>
        </div>
      </div>
      <div class="profile-actions">
        <button class="btn-primary btn-small" data-activate="${profile.id}">Activate</button>
        <button class="btn-danger btn-small" data-delete="${profile.id}">Delete</button>
      </div>
    `;
    
    card.querySelector(`[data-activate="${profile.id}"]`).addEventListener('click', async () => {
      const data = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({
        'settings': {
          ...(data.settings || {}),
          fixrEmail: profile.email,
          fixrPassword: profile.password
        },
        'activeProfileId': profile.id
      });
      chrome.tabs.create({ url: 'https://fixr.co' });
    });
    
    card.querySelector(`[data-delete="${profile.id}"]`).addEventListener('click', async () => {
      const data = await chrome.storage.local.get('profiles');
      const filtered = data.profiles.filter(p => p.id !== profile.id);
      await chrome.storage.local.set({ profiles: filtered });
      updateProfilesList(filtered);
      updateProfileSelects(filtered, data.activeProfileId);
    });
    
    DOM.profilesList.appendChild(card);
  });
}

function updateProfileSelects(profiles, activeId) {
  [DOM.normalProfileSelect, DOM.incognitoProfileSelect].forEach(select => {
    select.innerHTML = '<option value="">-- Select Profile --</option>';
    if (profiles) {
      profiles.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
      });
    }
  });
}

DOM.addScannerBtn.addEventListener('click', async () => {
  const url = DOM.scannerUrl.value.trim();
  const keywords = DOM.scannerKeywords.value.split(',').map(k => k.trim()).filter(k => k);
  
  if (!url || keywords.length === 0) return;
  
  const scanner = {
    id: `scanner_${Date.now()}`,
    url,
    keywords,
    enabled: true,
    status: 'pending',
    lastChecked: null,
    createdAt: new Date().toISOString()
  };
  
  const data = await chrome.storage.local.get('scanners');
  const scanners = data.scanners || [];
  scanners.push(scanner);
  
  await chrome.storage.local.set({ scanners });
  DOM.scannerUrl.value = '';
  DOM.scannerKeywords.value = '';
  
  updateScannerList(scanners);
  chrome.runtime.sendMessage({ type: 'pollScanners' });
});

function updateScannerList(scanners) {
  DOM.scannerList.innerHTML = '';
  
  if (!scanners || scanners.length === 0) {
    DOM.scannerList.innerHTML = '<div class="empty-state"><p>No keyword scanners active.</p></div>';
    return;
  }
  
  scanners.forEach(scanner => {
    const statusClass = scanner.status === 'found' ? 'live' : 'pending';
    const card = document.createElement('div');
    card.className = 'scanner-card';
    card.innerHTML = `
      <div class="scanner-card-left">
        <div class="event-name" style="font-size: 12px;">${scanner.url}</div>
        <div class="event-meta">
          <div><span class="status-dot ${statusClass}"></span> ${scanner.keywords.join(', ')}</div>
        </div>
      </div>
      <button class="btn-danger btn-small" data-delete-scanner="${scanner.id}">Remove</button>
    `;
    
    card.querySelector(`[data-delete-scanner="${scanner.id}"]`).addEventListener('click', async () => {
      const data = await chrome.storage.local.get('scanners');
      const filtered = data.scanners.filter(s => s.id !== scanner.id);
      await chrome.storage.local.set({ scanners: filtered });
      updateScannerList(filtered);
    });
    
    DOM.scannerList.appendChild(card);
  });
}

function updateWeeklyCounter(weeklyStats) {
  const today = new Date();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - today.getDay());
  lastSunday.setHours(0, 0, 0, 0);
  const key = lastSunday.toISOString().split('T')[0];
  
  const count = weeklyStats[key] || 0;
  DOM.weeklyCounter.textContent = `${count} checks since Sunday`;
}

DOM.pollOpenInterval.addEventListener('input', async () => {
  DOM.openIntervalDisplay.textContent = DOM.pollOpenInterval.value;
  const data = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({
    'settings': { ...(data.settings || {}), pollIntervalOpen: parseInt(DOM.pollOpenInterval.value) }
  });
});

DOM.pollClosedInterval.addEventListener('input', async () => {
  DOM.closedIntervalDisplay.textContent = DOM.pollClosedInterval.value;
  const data = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({
    'settings': { ...(data.settings || {}), pollIntervalClosed: parseInt(DOM.pollClosedInterval.value) }
  });
});

[DOM.enableDesktopNotif, DOM.enableSound, DOM.autoOpenTabs].forEach(el => {
  el.addEventListener('change', async () => {
    const data = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({
      'settings': {
        ...(data.settings || {}),
        enableDesktopNotif: DOM.enableDesktopNotif.checked,
        enableSound: DOM.enableSound.checked,
        autoOpenTabs: DOM.autoOpenTabs.checked
      }
    });
  });
});

DOM.saveDualBtn.addEventListener('click', async () => {
  const normalId = DOM.normalProfileSelect.value;
  const incognitoId = DOM.incognitoProfileSelect.value;
  
  if (!normalId || !incognitoId) {
    alert('Select both profiles');
    return;
  }
  
  await chrome.storage.local.set({ dualSelectedIds: [normalId, incognitoId] });
  alert('Dual tab selection saved!');
});

DOM.openBothBtn.addEventListener('click', async () => {
  const data = await chrome.storage.local.get(['dualSelectedIds', 'profiles']);
  if (!data.dualSelectedIds || data.dualSelectedIds.length < 2) {
    alert('Save a dual tab selection first');
    return;
  }
  
  const [normalId, incognitoId] = data.dualSelectedIds;
  const normalProfile = data.profiles.find(p => p.id === normalId);
  const incognitoProfile = data.profiles.find(p => p.id === incognitoId);
  
  if (!normalProfile || !incognitoProfile) {
    alert('Profile not found');
    return;
  }
  
  const settings = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({
    'settings': {
      ...(settings.settings || {}),
      fixrEmail: normalProfile.email,
      fixrPassword: normalProfile.password
    }
  });
  chrome.tabs.create({ url: 'https://fixr.co' });
  
  await chrome.storage.local.set({ incognitoProfileId: incognitoId });
  chrome.windows.create({ url: 'https://fixr.co', incognito: true });
});

DOM.testNtfyBtn.addEventListener('click', async () => {
  const topic = DOM.ntfyTopic.value.trim();
  if (!topic) {
    DOM.ntfyStatus.innerHTML = '<div class="alert-status error">Enter a topic first</div>';
    return;
  }
  
  DOM.ntfyStatus.innerHTML = '<div class="alert-status"><span class="spinner"></span> Testing...</div>';
  
  try {
    const response = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        'Title': 'Fixr Monitor Test',
        'Priority': '5',
        'Tags': 'test,fixr'
      },
      body: 'Extension connection test'
    });
    
    if (response.ok) {
      DOM.ntfyStatus.innerHTML = '<div class="alert-status">✅ Connection successful!</div>';
      await chrome.storage.local.set({ ntfyTopic: topic });
    } else {
      throw new Error('Server error');
    }
  } catch (err) {
    DOM.ntfyStatus.innerHTML = `<div class="alert-status error">❌ Failed: ${err.message}</div>`;
  }
});

DOM.testAllAlertsBtn.addEventListener('click', async () => {
  DOM.alertTestStatus.innerHTML = '<div class="alert-status"><span class="spinner"></span> Testing all alerts...</div>';
  
  try {
    if (DOM.enableDesktopNotif.checked) {
      chrome.notifications.create('test_notif', {
        type: 'basic',
        iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" font-size="50" text-anchor="middle" dy=".3em">🎫</text></svg>',
        title: 'Fixr Monitor Test',
        message: 'All alerts working! 🎉',
        requireInteraction: true,
        priority: 2
      });
    }
    
    if (DOM.enableSound.checked) {
      chrome.runtime.sendMessage({ type: 'playSound' });
    }
    
    const data = await chrome.storage.local.get('ntfyTopic');
    if (data.ntfyTopic) {
      await fetch(`https://ntfy.sh/${data.ntfyTopic}`, {
        method: 'POST',
        headers: {
          'Title': 'Fixr Monitor Alert Test',
          'Priority': '5',
          'Tags': 'test,ticket'
        },
        body: 'All alerts working!'
      });
    }
    
    DOM.alertTestStatus.innerHTML = '<div class="alert-status">✅ All alerts tested!</div>';
  } catch (err) {
    DOM.alertTestStatus.innerHTML = `<div class="alert-status error">❌ Error: ${err.message}</div>`;
  }
});

DOM.clearAllBtn.addEventListener('click', async () => {
  if (confirm('⚠️ This will erase all events, profiles, and settings. Are you sure?')) {
    await chrome.storage.local.clear();
    location.reload();
  }
});

DOM.pinBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});

DOM.checkNowBtn.addEventListener('click', async () => {
  chrome.runtime.sendMessage({ type: 'pollNow' });
  DOM.checkNowBtn.textContent = '⏳ Checking...';
  setTimeout(() => {
    DOM.checkNowBtn.textContent = '⚡ CHECK NOW';
  }, 2000);
});

function updateIntervalDisplays() {
  DOM.openIntervalDisplay.textContent = DOM.pollOpenInterval.value;
  DOM.closedIntervalDisplay.textContent = DOM.pollClosedInterval.value;
}

loadSettings();
connectToServiceWorker();
