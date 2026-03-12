// db.js — IndexedDB wrapper (acts like SQLite for PWA)
const DB_NAME = 'Mark_Verification';
const DB_VERSION = 1;

const SUBJECTS_LIST = [
  "Accountancy","Advanced Language","Agricultural Science - Theory",
  "Basic Automobile Engineering - Theory","Basic Civil Engineering - Theory",
  "Basic Electrical Engineering - Theory","Basic Electronics Engineering - Theory",
  "Basic Mechanical Engineering - Theory","Bio Chemistry","Biology",
  "Botany","Business Mathematics and Statistics","Chemistry",
  "Commerce","Communicative English","Computer Science","Computer Technology",
  "Economics","Employability Skills","English","Ethics and Indian Culture",
  "Food Service Management - Theory","Geography","History","Home Science",
  "Language","Mathematics","Micro-Biology","Nursing General","Nursing-Theory",
  "Nutrition & Dietetics","Office Management and Secretaryship - Theory",
  "Physics","Political Science","Statistics",
  "Textile Technology - Theory","Textiles and Dress Designing - Theory","Zoology"
].sort();

let db = null;

async function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('Subjects')) {
        const subStore = d.createObjectStore('Subjects', { keyPath: 'Subjects' });
        // Pre-populate subjects
        subStore.transaction.oncomplete = () => {
          const tx = d.transaction('Subjects', 'readwrite');
          const s = tx.objectStore('Subjects');
          SUBJECTS_LIST.forEach(sub => s.add({ Subjects: sub }));
        };
      }
      if (!d.objectStoreNames.contains('Sub_Ques_Format')) {
        d.createObjectStore('Sub_Ques_Format', { keyPath: 'Subject' });
      }
    };
  });
}

async function getSubjects() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('Subjects', 'readonly');
    const store = tx.objectStore('Subjects');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.map(r => r.Subjects).sort());
    req.onerror = () => reject(req.error);
  });
}

async function checkFormatExists(subject) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('Sub_Ques_Format', 'readonly');
    const store = tx.objectStore('Sub_Ques_Format');
    const req = store.get(subject);
    req.onsuccess = () => resolve(req.result ? true : false);
    req.onerror = () => reject(req.error);
  });
}

async function getFormat(subject) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('Sub_Ques_Format', 'readonly');
    const store = tx.objectStore('Sub_Ques_Format');
    const req = store.get(subject);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function saveFormat(formatObj) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('Sub_Ques_Format', 'readwrite');
    const store = tx.objectStore('Sub_Ques_Format');
    const req = store.put(formatObj);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function getAllFormats() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('Sub_Ques_Format', 'readonly');
    const store = tx.objectStore('Sub_Ques_Format');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
