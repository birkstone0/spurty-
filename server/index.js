require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Admin = require('./models/Admin');
const PromoCode = require('./models/PromoCode');
const Claim = require('./models/Claim');
const { performVisualRegistration, verifyVisualOtp, performPromoClaim } = require('./services/browser');

const DEFAULT_PROMO_CODES = ['WELCOMESP50', 'SPWELCOME50', 'pvlfree50'];

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() }).single('idImage');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB Connected');
    await seedPromoCodes();
  })
  .catch(err => console.error('MongoDB Error:', err));

async function seedPromoCodes() {
  for (const code of DEFAULT_PROMO_CODES) {
    await PromoCode.updateOne(
      { code },
      { $setOnInsert: { code, active: true, createdBy: 'system' } },
      { upsert: true }
    );
  }
  console.log('[*] Promo codes ensured:', DEFAULT_PROMO_CODES.join(', '));
}

// ==========================================
// OCR PARSER
// ==========================================
function parseIdText(text) {
    const flatText = text.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    let firstName = "", lastName = "", dob = null;

    const lastNameRegex = /(?:Apelyido|Last Name)[^a-zA-Z]*([A-Z]{3,})/i;
    const lastNameMatch = flatText.match(lastNameRegex);
    if (lastNameMatch) lastName = lastNameMatch[1].trim();

    const firstNameRegex = /(?:Mga Pangalan|Given Names)[^a-zA-Z]*([A-Z\s]+?)(?=\s*(?:Gitnang|MASANGKAY|Petsa|Date|$))/i;
    const firstNameMatch = flatText.match(firstNameRegex);
    if (firstNameMatch) firstName = firstNameMatch[1].trim();

    const dobRegex = /(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|DELEMBER|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{1,2})[,\s]*(\d{4})/i;
    const dobMatch = flatText.match(dobRegex);
    if (dobMatch) {
        const monthStr = dobMatch[1].toUpperCase();
        const monthNum = monthStr.startsWith('DE') ? '12' :
                         monthStr.startsWith('JA') ? '01' :
                         monthStr.startsWith('FE') ? '02' :
                         monthStr === 'MAY' ? '05' :
                         monthStr.startsWith('MA') ? '03' :
                         monthStr.startsWith('AP') ? '04' :
                         monthStr.startsWith('JU') ? '06' :
                         monthStr.startsWith('AU') ? '08' :
                         monthStr.startsWith('SE') ? '09' :
                         monthStr.startsWith('OC') ? '10' : '11';
        dob = `${dobMatch[3]}-${monthNum}-${dobMatch[2].padStart(2, '0')}`;
    }

    return { firstName, lastName, dob, rawText: text };
}

function calculateAge(dobStr) {
    if (!dobStr) return 0;
    const dob = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function generatePassword(length = 10) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    let password = '';
    password += letters.charAt(Math.floor(Math.random() * 26)); 
    password += letters.charAt(Math.floor(Math.random() * 26) + 26); 
    password += numbers.charAt(Math.floor(Math.random() * numbers.length)); 
    const allChars = letters + numbers;
    for (let i = 3; i < length; i++) {
        password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// ==========================================
// AUTH MIDDLEWARE
// ==========================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, process.env.JWT_SECRET || 'supersecret', (err, user) => {
        if (err) return res.status(403).json({ error: "Forbidden" });
        req.user = user;
        next();
    });
};

// ==========================================
// AUTH ROUTE
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const account = await Admin.findOne({ username });
        if (!account) return res.status(401).json({ error: "Invalid credentials" });
        
        const valid = await bcrypt.compare(password, account.password);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { id: account._id, role: account.role, username: account.username }, 
            process.env.JWT_SECRET || 'supersecret', 
            { expiresIn: '1d' }
        );
        
        res.json({ token, role: account.role, username: account.username });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// PROTECTED ROUTES
// ==========================================
app.get('/api/accounts', authenticateToken, async (req, res) => {
    try {
        // Data Isolation: Admin sees all, users see only what they created
        let query = req.user.role === 'admin' ? {} : { createdBy: req.user.username };
        const accounts = await User.find(query).select('-generatedPassword').sort({ createdAt: -1 });
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/accounts/add', authenticateToken, async (req, res) => {
    const { mobile, password, kycVerified } = req.body;
    if (!mobile || !password) return res.status(400).json({ error: "Mobile and password are required." });

    try {
        const existing = await User.findOne({ mobile });
        if (existing) return res.status(400).json({ error: "Account already exists" });

        const newUser = await User.create({
            firstName: 'Manual',
            lastName: 'Entry',
            dob: '',
            age: 21,
            mobile,
            generatedPassword: password,
            plainPassword: password, 
            status: 'verified',
            kycStatus: kycVerified === 'Yes' ? 'approved' : 'none',
            createdBy: req.user.username
        });
        res.json({ success: true, user: { _id: newUser._id, mobile: newUser.mobile } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/scan', authenticateToken, upload, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No ID image provided" });
        
        const processedBuffer = await sharp(req.file.buffer)
            .resize(1500)
            .greyscale()
            .normalize()
            .sharpen()
            .threshold(140)
            .toBuffer();

        const { data: { text } } = await Tesseract.recognize(processedBuffer, 'eng');
        const parsed = parseIdText(text);
        
        if (!parsed.dob) return res.status(422).json({ error: "Could not extract DOB. Please upload a clearer image.", rawText: text });
        
        res.json({ extracted: { ...parsed, age: calculateAge(parsed.dob) }, rawText: parsed.rawText });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/register', authenticateToken, async (req, res) => {
    const { mobile, firstName, lastName, dob, age } = req.body;
    
    if (!mobile || !firstName || !lastName || !dob) return res.status(400).json({ error: "Missing required fields" });
    if (age < 21) return res.status(403).json({ error: `Underage. Age is ${age}` });

    let cleanMobile = mobile.trim();
    if (cleanMobile.startsWith('+63')) cleanMobile = cleanMobile.slice(3);
    else if (cleanMobile.startsWith('0')) cleanMobile = cleanMobile.slice(1);

    const realPassword = generatePassword(); 
    
    try {
        await performVisualRegistration(cleanMobile, firstName, lastName, dob, realPassword);
        res.json({ success: true, password: realPassword });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verify-otp', authenticateToken, async (req, res) => {
    const { otpValue, mobile, firstName, lastName, dob, age, password } = req.body;
    
    try {
        await verifyVisualOtp(otpValue);
        const newUser = await User.create({ 
            firstName, lastName, dob, age, mobile, 
            otpFlowId: "visual_flow", 
            generatedPassword: password, 
            plainPassword: password, 
            status: 'verified', 
            kycStatus: 'none',
            createdBy: req.user.username
        });
        res.json({ success: true, userId: newUser._id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/claim-promo-bulk', authenticateToken, async (req, res) => {
    const { accounts, promoCodes } = req.body;
    
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0 || !promoCodes || promoCodes.length === 0) {
        return res.status(400).json({ error: "Missing accounts or promo codes." });
    }

    const results = [];
    const successSummary = [];

    for (const acc of accounts) {
        for (const promoCode of promoCodes) {
            try {
                if (!acc.password) throw new Error('No plaintext password on record for this account.');
                const existing = await Claim.findOne({ promoCode, mobile: acc.mobile, success: true });
                if (existing) throw new Error('This promo code has already been claimed for this account.');
                const result = await performPromoClaim(acc.mobile, acc.password, promoCode);
                await Claim.create({
                    promoCode,
                    mobile: acc.mobile,
                    success: true,
                    balance: result.balance || 0,
                    claimedBy: req.user.username
                });
                results.push({ mobile: acc.mobile, promoCode, success: true, balance: result.balance });
                successSummary.push({ mobile: acc.mobile, promoCode, balance: result.balance });
            } catch (error) {
                const reason = error.message.includes('already been claimed')
                    ? 'Duplicate claim'
                    : error.message;
                results.push({ mobile: acc.mobile, promoCode, success: false, error: reason });
            }
        }
    }

    res.json({ success: true, results, successSummary });
});

app.get('/api/promos', authenticateToken, async (req, res) => {
    try {
        const promos = await PromoCode.find({}).sort({ createdAt: -1 });
        const counts = await Claim.aggregate([
            { $match: { success: true } },
            { $group: { _id: '$promoCode', total: { $sum: 1 } } }
        ]);
        const countMap = {};
        for (const c of counts) countMap[c._id] = c.total;
        res.json(promos.map(p => ({ _id: p._id, code: p.code, active: p.active, claimCount: countMap[p.code] || 0 })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/promos', authenticateToken, async (req, res) => {
    const { code } = req.body;
    if (!code || !code.trim()) return res.status(400).json({ error: "Promo code is required." });

    const trimmed = code.trim();
    try {
        const existing = await PromoCode.findOne({ code: trimmed });
        if (existing) return res.status(400).json({ error: "This promo code already exists." });
        const created = await PromoCode.create({ code: trimmed, active: true, createdBy: req.user.username });
        res.json({ success: true, promo: { _id: created._id, code: created.code, active: created.active, claimCount: 0 } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/claims', authenticateToken, async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? {} : { claimedBy: req.user.username };
        const claims = await Claim.find(query).sort({ createdAt: -1 });
        res.json(claims);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));