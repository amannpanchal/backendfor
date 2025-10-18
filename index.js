// const express = require('express');
// const app = express();
// const mongoose = require('mongoose');
// const cors = require('cors');

// app.use(cors({
//   origin: '*',
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// app.use(express.json());

// const connectDb = async () => {
//   try {
//     await mongoose.connect('mongodb+srv://amanpanchal144:amanpanchal144@displayforce.igkk4.mongodb.net/?retryWrites=true&w=majority&appName=displayforce');
//     console.log('Database connected successfully');
//   } catch (e) {
//     console.log('Error connecting to DB:', e.message);
//   }
// };
// connectDb();

// const schema = new mongoose.Schema({
//   count: {
//     type: Number,
//     default: 0
//   },
//   time: [{
//     type: Date,
//     default: Date.now
//   }]
// }, { timestamps: true });

// const Counter = mongoose.model('Counter', schema);

// app.get('/product', async (req, res) => {
//   try {
//     let product = await Counter.findOne();
//     if (!product) {
//       product = new Counter();
//       await product.save();
//     }
//     return res.json(product);
//   } catch (e) {
//     res.status(500).json({ message: 'Error fetching product', error: e.message });
//   }
// });

// app.post('/product/increase', async (req, res) => {
//   try {
//     let product = await Counter.findOne();
//     if (!product) {
//       product = new Counter();
//       await product.save();
//     }
//     product.count += 1;
//     product.time.push(new Date());
//     await product.save();
//     res.json({
//       message: 'Count increased successfully',
//       count: product.count,
//       totalIncreases: product.time.length,
//       lastIncreasedAt: product.time[product.time.length - 1],
//     });
//   } catch (e) {
//     res.status(500).json({ message: 'Error increasing product', error: e.message });
//   }
// });

// app.listen(4000, () => {
//   console.log('App is running at port 4000');
// });




















const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const backendLink = "http://localhost:4000"

const app = express();
const PORT = process.env.PORT || 4000;
const USERS_FILE = path.join(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'very-secret-key';
const JWT_EXPIRES_IN = '1h';

app.use(cors({ origin: '*' }));
app.use(express.json());

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
}

function readUsers() {
  const raw = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(raw).users;
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
}

app.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, and password required.' });
    }
    const users = readUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    const salt = await bcrypt.genSalt(10);
    const pwdHash = await bcrypt.hash(password, salt);

    const verificationToken = uuidv4();
    const newUser = {
      id: uuidv4(),
      name,
      email: email.toLowerCase(),
      passwordHash: pwdHash,
      verified: false,
      verificationToken,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeUsers(users);

    const verifyLink = `${backendLink}/verify?token=${verificationToken}`;

    console.log('=== NEW SIGNUP ===');
    console.log(`verification link for ${email}: ${verifyLink}`);

    return res.status(201).json({
      success: true,
      message: 'Signup successful. Please verify your email using the link.',
      verifyLink
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.get('/verify', (req, res) => {
  try {
    const { token } = req.query || {};
    if (!token) {
      return res.status(400).send('<h3>Invalid verification request: token missing</h3>');
    }
    const users = readUsers();
    const user = users.find(u => u.verificationToken === token);
    if (!user) {
      return res.status(400).send('<h3>Invalid or expired verification token.</h3>');
    }
    user.verified = true;
    delete user.verificationToken;
    writeUsers(users);

    return res.send(`<h2>Email verification successful</h2><p>User <strong>${user.email}</strong> verified. You can now login on the frontend.</p>`);
  } catch (err) {
    console.error(err);
    return res.status(500).send('<h3>Server error</h3>');
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password required.' });
    }
    const users = readUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    if (!user.verified) {
      return res.status(403).json({ success: false, message: 'Email not verified. Please verify before logging in.' });
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    const payload = { id: user.id, email: user.email, name: user.name };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ success: true, message: 'Login successful', token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/dashboard', (req, res) => {
  try {
    const auth = req.headers.authorization

    
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing token' });
    }
    const token = auth.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return res.json({ success: true, message: 'Welcome to the dashboard', user: decoded });
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});

