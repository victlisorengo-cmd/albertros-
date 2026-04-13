const jobList = document.getElementById('job-list');
const jobForm = document.getElementById('job-form');
const filterLocation = document.getElementById('filter-location');
const filterType = document.getElementById('filter-type');

const DB_NAME = 'albertrosJobsDB';
const DB_VERSION = 1;
const STORE_NAME = 'jobs';
const supportsIndexedDB = 'indexedDB' in window;
let jobsCache = [];
let dbPromise = null;

const defaultJobs = [
  {
    title: 'Remote Customer Success Lead',
    company: 'BrightPath Studio',
    location: 'Remote',
    type: 'Contract',
    email: 'careers@brightpath.com',
    phone: '+1 415 555 0198',
    description:
      'Lead customer relationships for a growing product team. Flexible hours and remote-friendly role.',
  },
  {
    title: 'Part-time UX Researcher',
    company: 'Nova Collective',
    location: 'Europe',
    type: 'Part-time',
    email: 'hiring@novacollective.eu',
    phone: '+44 20 7946 0011',
    description:
      'Conduct interviews, analyze insights, and help shape the next generation of user-centered products.',
  },
  {
    title: 'Freelance Content Marketing Specialist',
    company: 'Alchemy Labs',
    location: 'Americas',
    type: 'Freelance',
    email: 'talent@alchemylabs.io',
    phone: '+1 303 555 0345',
    description:
      'Create friendly and persuasive content for modern tech brands. Ideal for experienced remote writers.',
  },
];

function createJobCard(job) {
  const card = document.createElement('article');
  card.className = 'job-card';

  card.innerHTML = `
    <header>
      <div>
        <h3>${job.title}</h3>
        <div class="job-meta">${job.company} · ${job.location}</div>
      </div>
      <div class="job-meta">${job.type}</div>
    </header>
    <div class="job-contact">
      <span>Email: <a href="mailto:${job.email || 'info@albertros.com'}">${job.email || 'info@albertros.com'}</a></span>
      <span>Phone: <a href="tel:${job.phone || ''}">${job.phone || 'Not provided'}</a></span>
    </div>
    <p>${job.description}</p>
  `;

  return card;
}

function getDatabase() {
  if (!supportsIndexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function readAllJobsFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function addJobToDB(db, job) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add({ ...job, createdAt: new Date().toISOString() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function bulkSaveJobsToDB(db, jobs) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    jobs.forEach((job) => {
      store.add({ ...job, createdAt: new Date().toISOString() });
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function loadJobsFromStorage() {
  const stored = localStorage.getItem('albertrosJobs');
  return stored ? JSON.parse(stored) : defaultJobs;
}

function saveJobsToStorage(jobs) {
  localStorage.setItem('albertrosJobs', JSON.stringify(jobs));
}

async function loadJobs() {
  if (!supportsIndexedDB) {
    jobsCache = loadJobsFromStorage();
    return jobsCache;
  }

  const db = await getDatabase();
  const storedJobs = await readAllJobsFromDB(db);

  if (!storedJobs.length) {
    await bulkSaveJobsToDB(db, defaultJobs);
    jobsCache = [...defaultJobs];
  } else {
    jobsCache = storedJobs;
  }

  return jobsCache;
}

async function addJob(job) {
  if (supportsIndexedDB) {
    const db = await getDatabase();
    await addJobToDB(db, job);
    jobsCache.unshift({ ...job, createdAt: new Date().toISOString() });
  } else {
    const jobs = loadJobsFromStorage();
    jobs.unshift(job);
    saveJobsToStorage(jobs);
    jobsCache = jobs;
  }
}

function renderJobs() {
  const selectedLocation = filterLocation.value;
  const selectedType = filterType.value;

  const filteredJobs = jobsCache.filter((job) => {
    const locationMatch = selectedLocation === 'all' || job.location === selectedLocation;
    const typeMatch = selectedType === 'all' || job.type === selectedType;
    return locationMatch && typeMatch;
  });

  jobList.innerHTML = '';

  if (!filteredJobs.length) {
    jobList.innerHTML = '<p class="empty-state">No roles match your filters yet. Try another selection or add a new listing.</p>';
    return;
  }

  filteredJobs.forEach((job) => jobList.appendChild(createJobCard(job)));
}

async function initApp() {
  try {
    await loadJobs();
    renderJobs();
  } catch (error) {
    console.error('Unable to load job database:', error);
    jobsCache = defaultJobs;
    renderJobs();
  }
}

jobForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = document.getElementById('job-title').value.trim();
  const company = document.getElementById('job-company').value.trim();
  const location = document.getElementById('job-location').value.trim();
  const type = document.getElementById('job-type').value;
  const email = document.getElementById('job-email').value.trim();
  const phone = document.getElementById('job-phone').value.trim();
  const description = document.getElementById('job-description').value.trim();

  if (!title || !company || !location || !email || !phone || !description) {
    return;
  }

  const newJob = { title, company, location, type, email, phone, description };
  await addJob(newJob);
  renderJobs();
  jobForm.reset();

  const submitButton = jobForm.querySelector('button[type="submit"]');
  submitButton.textContent = 'Posted!';
  setTimeout(() => {
    submitButton.textContent = 'Post Job';
  }, 1800);
});

filterLocation.addEventListener('change', renderJobs);
filterType.addEventListener('change', renderJobs);

initApp();
