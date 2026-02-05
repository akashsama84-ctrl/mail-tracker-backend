
/**
 * VAPORMAIL BACKEND SERVER (Node.js + MongoDB)
 * ---------------------------------
 * Dependencies: express, nodemailer, cors, body-parser, mongoose
 * 
 * To run:
 * 1. npm install express nodemailer cors body-parser mongoose
 * 2. Ensure MongoDB is running on your machine
 * 3. node server.js
 */

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// 1. MongoDB Connection
const MONGO_URI = 'mongodb+srv://kambojsama84:bHBB6eCihl9ul7oJ@cluster0.ku5w0.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// 2. Define Email Schema
const emailSchema = new mongoose.Schema({
  trackingId: { type: String, required: true, unique: true },
  recipients: [String],
  subject: String,
  body: String,
  opens: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  sentAt: { type: Date, default: Date.now },
  lastOpenedAt: Date,
  lastClickedAt: Date
});

const Email = mongoose.model('Email', emailSchema);

// 3. SMTP Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'kambojsama84@gmail.com',
    pass: 'fbwp ayrb squa xrlx'
  }
});

// const BASE_URL = 'http://localhost:5001'; 
const BASE_URL = 'https://mail-tracker-backend-dbo5.onrender.com'; 

// 4. Email Sending Endpoint
app.post('/api/send', async (req, res) => {
  const { id, recipients, subject, body } = req.body;

  try {
    // Save to MongoDB first
    const newEmail = new Email({
      trackingId: id,
      recipients,
      subject,
      body
    });
    await newEmail.save();

    // Inject Tracking Pixel
    const trackingPixel = `<img src="${BASE_URL}/api/track/open/${id}" width="1" height="1" style="display:none; opacity:0;" alt="" />`;
    
    // Wrap Links for click tracking
    const trackedBody = body.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
      return `href="${BASE_URL}/api/track/click/${id}?url=${encodeURIComponent(url)}"`;
    });

    const htmlContent = `
      <div style="font-family: sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          ${trackedBody.replace(/\n/g, '<br>')}
        </div>
        ${trackingPixel}
      </div>
    `;

    const info = await transporter.sendMail({
      from: '"VaporMail Tracker" <kambojsama84@gmail.com>',
      to: recipients.join(', '),
      subject: subject,
      html: htmlContent,
    });

    console.log(`[SMTP] Email ${id} sent. MessageID: ${info.messageId}`);
   return res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('[ERROR] Failed to send or save email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Tracking Pixel Endpoint (Open Tracking)
app.get('/api/track/open/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Atomically increment the open count in MongoDB
    const updated = await Email.findOneAndUpdate(
      { trackingId: id },
      { 
        $inc: { opens: 1 },
        $set: { lastOpenedAt: new Date() }
      },
      { new: true }
    );

    if (updated) {
      console.log(`[TRACK] Email ${id} opened. Total: ${updated.opens}`);
    }
  } catch (err) {
    console.error('[ERROR] Failed to track open:', err);
  }

  // Always return the pixel
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(pixel);
});

// 6. Link Redirect Endpoint (Click Tracking)
app.get('/api/track/click/:id', async (req, res) => {
  const { id } = req.params;
  const { url } = req.query;

  try {
    const updated = await Email.findOneAndUpdate(
      { trackingId: id },
      { 
        $inc: { clicks: 1 },
        $set: { lastClickedAt: new Date() }
      },
      { new: true }
    );

    if (updated) {
      console.log(`[TRACK] Link in ${id} clicked. Total: ${updated.clicks}`);
    }
  } catch (err) {
    console.error('[ERROR] Failed to track click:', err);
  }

  res.redirect(url || '/');
});

// 7. Stats Endpoint for Dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const allEmails = await Email.find().sort({ sentAt: -1 });
    // Transform to the format the frontend expects if necessary, 
    // though the current frontend uses localStorage. This API can now power the UI.
    res.json(allEmails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log('-----------------------------------------');
  console.log(`VaporMail Backend (MongoDB) running at ${BASE_URL}`);
  console.log(`Database: ${MONGO_URI}`);
  console.log('-----------------------------------------');
});
