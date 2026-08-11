const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// --- CSV SPREADSHEET AUTOMATION SETUP ---
const DATA_DIR = path.join(__dirname, 'data');
const CSV_FILE_PATH = path.join(DATA_DIR, 'user_leads_sheet.csv');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

if (!fs.existsSync(CSV_FILE_PATH)) {
  const headers = 'Timestamp,Lead_Type,Name_Or_School,Email,Phone_Or_School,City,Notes_Or_Message\n';
  fs.writeFileSync(CSV_FILE_PATH, headers, 'utf8');
}

function appendToCsvSheet(type, details) {
  try {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const sanitize = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
    
    const row = [
      sanitize(timestamp),
      sanitize(type),
      sanitize(details.name || details.schoolName || 'Subscriber'),
      sanitize(details.email || 'N/A'),
      sanitize(details.contactNumber || details.school || 'N/A'),
      sanitize(details.city || 'N/A'),
      sanitize(details.message || details.notes || 'N/A')
    ].join(',') + '\n';

    fs.appendFileSync(CSV_FILE_PATH, row, 'utf8');
    console.log(`📊 [EXCEL SHEET UPDATED] Row appended to user_leads_sheet.csv: [${type}] ${details.email || details.name}`);
  } catch (err) {
    console.error('Error writing CSV sheet:', err);
  }
}

// In-Memory Storage Fallback (Ensures server works flawlessly even without active Mongo service)
const memoryDb = {
  messages: [],
  workshopRequests: [],
  subscribers: [],
  images: [],
  certificates: [
    {
      certId: "AISI-2026-6001",
      studentName: "Lingala Sampath Kumar",
      school: "KKR and KSR Institute of Technology",
      courseTitle: "AI Foundations (Class 6)",
      grade: "Class 6",
      issueDate: "2026-01-15",
      verified: true,
      gradeScore: "A+ Distinction",
      partner: "Strint Technologies"
    },
    {
      certId: "AISI-2026-7002",
      studentName: "Velluri Tarun Shetty",
      school: "Strint Academy of Excellence",
      courseTitle: "AI Explorer (Class 7)",
      grade: "Class 7",
      issueDate: "2026-02-10",
      verified: true,
      gradeScore: "A+ Distinction",
      partner: "Strint Technologies"
    },
    {
      certId: "AISI-2026-8003",
      studentName: "Siddharth Verma",
      school: "Hyderabad Public School",
      courseTitle: "AI Master (Class 8)",
      grade: "Class 8",
      issueDate: "2026-03-05",
      verified: true,
      gradeScore: "A Distinction",
      partner: "Strint Technologies"
    },
    {
      certId: "AISI-2026-9004",
      studentName: "Meera Krishnan",
      school: "Vijayawada Model School",
      courseTitle: "AI Innovator (Class 9)",
      grade: "Class 9",
      issueDate: "2026-04-01",
      verified: true,
      gradeScore: "A+ Distinction",
      partner: "Strint Technologies"
    }
  ]
};

// --- MONGODB CONNECTION WITH HYBRID FALLBACK ---
let isMongoConnected = false;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aisi_db';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 2000
})
  .then(() => {
    isMongoConnected = true;
    console.log('✅ Connected successfully to MongoDB Database!');
  })
  .catch(err => {
    isMongoConnected = false;
    console.log('ℹ️  MongoDB connection skipped/unavailable. Operating in In-Memory DB & CSV Auto-Spreadsheet Mode.');
  });

// --- MONGOOSE SCHEMAS & MODELS ---

// 1. Contact Form Schema
const messageSchema = new mongoose.Schema({
  name: String,
  email: String,
  school: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// 2. Workshop Request Schema
const workshopRequestSchema = new mongoose.Schema({
  schoolName: String,
  city: String,
  contactNumber: String,
  email: String,
  estimatedStudents: String,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});
const WorkshopRequest = mongoose.model('WorkshopRequest', workshopRequestSchema);

// 3. Certificate Schema
const certificateSchema = new mongoose.Schema({
  certId: { type: String, unique: true, required: true },
  studentName: String,
  school: String,
  courseTitle: String,
  grade: String,
  issueDate: String,
  verified: { type: Boolean, default: true },
  gradeScore: { type: String, default: 'A+ Distinction' },
  partner: { type: String, default: 'Strint Technologies' },
  createdAt: { type: Date, default: Date.now }
});
const Certificate = mongoose.model('Certificate', certificateSchema);

// 4. Subscriber Schema
const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Subscriber = mongoose.model('Subscriber', subscriberSchema);

// 5. Workshop Image Schema
const imageSchema = new mongoose.Schema({
  title: String,
  description: String,
  imageUrl: String,
  category: { type: String, default: 'workshop' },
  createdAt: { type: Date, default: Date.now }
});
const WorkshopImage = mongoose.model('WorkshopImage', imageSchema);

// --- MULTER SETUP (Image Upload) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// --- API ROUTES ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'AISI Backend API',
    mongoConnected: isMongoConnected,
    mode: isMongoConnected ? 'Database Mode' : 'In-Memory + CSV Auto-Spreadsheet Mode',
    csvSheet: fs.existsSync(CSV_FILE_PATH) ? 'Active & Auto-Updating' : 'Pending',
    timestamp: new Date()
  });
});

// 1. Contact Form Submit
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, school, message } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and Email are required.' });
    }

    const payload = { name, email, school: school || 'N/A', message: message || '', createdAt: new Date() };

    if (isMongoConnected) {
      const newMessage = new Message(payload);
      await newMessage.save();
    }
    memoryDb.messages.unshift(payload);

    // Auto-update Excel / CSV Spreadsheet
    appendToCsvSheet('Contact Inquiry', payload);

    console.log(`📩 New Contact Inquiry from ${name} (${email})`);
    res.status(201).json({ success: true, message: 'Message sent successfully! Our team will contact you.' });
  } catch (err) {
    console.error('Contact submit error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// 2. School Workshop Request Submit
app.post('/api/workshops/request', async (req, res) => {
  try {
    const { schoolName, city, contactNumber, email, estimatedStudents, notes } = req.body;
    if (!schoolName || !contactNumber) {
      return res.status(400).json({ error: 'School Name and Contact Number are required.' });
    }

    const payload = {
      schoolName,
      city: city || 'N/A',
      contactNumber,
      email: email || 'N/A',
      estimatedStudents: estimatedStudents || '50+',
      notes: notes || '',
      createdAt: new Date()
    };

    if (isMongoConnected) {
      const newRequest = new WorkshopRequest(payload);
      await newRequest.save();
    }
    memoryDb.workshopRequests.unshift(payload);

    // Auto-update Excel / CSV Spreadsheet
    appendToCsvSheet('Workshop Request', payload);

    console.log(`🏫 New Workshop Request from ${schoolName} (${city})`);
    res.status(201).json({ success: true, message: 'Workshop request submitted successfully! We will schedule a call.' });
  } catch (err) {
    console.error('Workshop request error:', err);
    res.status(500).json({ error: 'Failed to submit workshop request.' });
  }
});

// 3. Newsletter Subscription
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const payload = { email, createdAt: new Date() };

    if (isMongoConnected) {
      const newSub = new Subscriber(payload);
      await newSub.save();
    }
    memoryDb.subscribers.unshift(payload);

    // Auto-update Excel / CSV Spreadsheet
    appendToCsvSheet('Newsletter Subscription', payload);

    console.log(`📧 New Newsletter Subscriber: ${email}`);
    res.status(200).json({ success: true, message: 'Subscribed successfully to AISI Newsletter!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

// 4. Download Excel / CSV Sheet Endpoint
app.get('/api/admin/export-sheet', (req, res) => {
  if (fs.existsSync(CSV_FILE_PATH)) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="AISI_User_Submissions_Sheet.csv"');
    fs.createReadStream(CSV_FILE_PATH).pipe(res);
  } else {
    res.status(404).json({ error: 'CSV sheet not generated yet.' });
  }
});

// 5. Get All Leads for Admin Table View
app.get('/api/admin/all-leads', async (req, res) => {
  try {
    const leads = [
      ...memoryDb.messages.map(m => ({ ...m, type: 'Contact Inquiry' })),
      ...memoryDb.workshopRequests.map(w => ({ ...w, type: 'Workshop Demo' })),
      ...memoryDb.subscribers.map(s => ({ ...s, type: 'Newsletter Sub' }))
    ];
    res.json({ count: leads.length, leads });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// 6. Certificate Verification API
app.get('/api/certificates/verify/:certId', async (req, res) => {
  try {
    const searchId = req.params.certId.trim().toUpperCase();

    let cert = null;
    if (isMongoConnected) {
      cert = await Certificate.findOne({ certId: new RegExp(`^${searchId}$`, 'i') });
    }

    if (!cert) {
      cert = memoryDb.certificates.find(c => c.certId.toUpperCase() === searchId);
    }

    if (cert) {
      console.log(`✅ Verified Certificate: ${searchId} for ${cert.studentName}`);
      res.json({
        found: true,
        verified: true,
        certificate: cert
      });
    } else {
      console.log(`❌ Certificate Verification Failed for: ${searchId}`);
      res.status(404).json({
        found: false,
        verified: false,
        message: `No active AISI certificate found matching ID '${searchId}'. Please verify the ID format (e.g. AISI-2026-6001).`
      });
    }
  } catch (err) {
    console.error('Cert verify error:', err);
    res.status(500).json({ error: 'Error processing certificate verification.' });
  }
});

// 7. Create / Issue Certificate API
app.post('/api/certificates/create', async (req, res) => {
  try {
    const { certId, studentName, school, courseTitle, grade, gradeScore } = req.body;
    if (!certId || !studentName || !courseTitle) {
      return res.status(400).json({ error: 'certId, studentName and courseTitle are required.' });
    }

    const newCert = {
      certId: certId.toUpperCase(),
      studentName,
      school: school || 'AISI Partner School',
      courseTitle,
      grade: grade || 'Class 6-9',
      issueDate: new Date().toISOString().split('T')[0],
      verified: true,
      gradeScore: gradeScore || 'A+ Distinction',
      partner: 'Strint Technologies'
    };

    if (isMongoConnected) {
      const certDoc = new Certificate(newCert);
      await certDoc.save();
    }
    memoryDb.certificates.unshift(newCert);

    res.status(201).json({ success: true, certificate: newCert });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create certificate' });
  }
});

// 8. List All Certificates
app.get('/api/certificates', async (req, res) => {
  try {
    let list = [];
    if (isMongoConnected) {
      list = await Certificate.find().sort({ createdAt: -1 });
    }
    if (list.length === 0) {
      list = memoryDb.certificates;
    }
    res.json(list);
  } catch (err) {
    res.json(memoryDb.certificates);
  }
});

// 9. Upload Workshop Image
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const imageData = {
      title: req.body.title || 'AISI Workshop',
      description: req.body.description || 'Hands-on AI classroom session',
      imageUrl: `/uploads/${req.file.filename}`,
      createdAt: new Date()
    };

    if (isMongoConnected) {
      const newImage = new WorkshopImage(imageData);
      await newImage.save();
    }
    memoryDb.images.unshift(imageData);

    res.status(201).json(imageData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// 10. Admin Stats Overview Dashboard API
app.get('/api/admin/stats', async (req, res) => {
  try {
    res.json({
      totalMessages: isMongoConnected ? await Message.countDocuments() : memoryDb.messages.length,
      totalWorkshopRequests: isMongoConnected ? await WorkshopRequest.countDocuments() : memoryDb.workshopRequests.length,
      totalSubscribers: isMongoConnected ? await Subscriber.countDocuments() : memoryDb.subscribers.length,
      totalCertificates: isMongoConnected ? await Certificate.countDocuments() : memoryDb.certificates.length,
      csvExportUrl: 'http://localhost:5000/api/admin/export-sheet',
      recentMessages: memoryDb.messages.slice(0, 5),
      recentWorkshopRequests: memoryDb.workshopRequests.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Default Root Route
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; padding: 40px; background: #F9F7F2; color: #332D27; border-radius: 16px; max-width: 650px; margin: 40px auto; border: 2px solid #BAA892;">
      <h2 style="margin-top:0;">🚀 AISI Backend API & Auto-Excel Server</h2>
      <p>Server status: <strong>Online & Active</strong></p>
      <p>Port: <strong>${PORT}</strong></p>
      <p>Auto CSV Sheet: <strong>server/data/user_leads_sheet.csv</strong></p>
      <hr style="border: 0; border-top: 1px solid #D8CEBF; margin: 20px 0;">
      <h4>Available Endpoints:</h4>
      <ul>
        <li><code>POST /api/contact</code> - Submit Contact Form (Auto-writes to CSV)</li>
        <li><code>POST /api/workshops/request</code> - Submit Workshop Request (Auto-writes to CSV)</li>
        <li><code>POST /api/newsletter/subscribe</code> - Newsletter Subscription</li>
        <li><code>GET /api/admin/export-sheet</code> - 📥 <strong>Download User Submissions Excel CSV Sheet</strong></li>
        <li><code>GET /api/certificates/verify/:certId</code> - Live Certificate Verification</li>
      </ul>
    </div>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 AISI Backend Server running on port ${PORT}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}`);
  console.log(`📊 Excel CSV Sheet: file://${CSV_FILE_PATH}`);
});
