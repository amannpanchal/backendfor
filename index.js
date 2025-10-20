const express = require('express');
const fs = require('fs');
require('dotenv').config();
const path = require('path');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4000;

// ====== Middleware ======
app.use(express.json());
app.use(cors({ origin: "*" }));

// ====== Constants ======
const USERS_FILE = path.join(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'amanpanchal';
const TOKEN_EXPIRY_MINUTES = 10;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://loginsystem-chi.vercel.app";

// ====== Ensure users.json file exists ======
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
}

// ====== Helper Functions ======
function readUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data).users;
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
}

// ====== Email Function ======
const sendEmail = async (options) => {
    try{
  const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      service: process.env.SMTP_SERVICE,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

 const info =   await   transporter.sendMail(mailOptions);

    }catch(e){
        
        console.log(e,'the options are')
    }
 
  
};

// ====== SIGNUP ROUTE ======
app.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;

    if (!firstName || !lastName || !email || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Signup failed. Missing required fields.",
      });
    }

    const users = readUsers();
    const existing = users.find((u) => u?.email?.toLowerCase() === email?.toLowerCase());

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User already exists.",
      });
    }

    const verificationToken = uuidv4();
    const expiresAt = Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000;

    const newUser = {
      id: uuidv4(),
      firstName,
      lastName,
      email,
      phoneNumber,
      verificationToken,
      tokenExpiresAt: expiresAt,
      verified: false,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    writeUsers(users);

    const verifyLink = `${FRONTEND_URL}/set-password/${verificationToken}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
        <h2 style="color: #333;">Hi ${firstName},</h2>
        <p>Welcome to our platform! Please verify your email and set your password to activate your account.</p>
        <p>This link is valid for <strong>10 minutes</strong>.</p>
        <a href="${verifyLink}" 
           style="display: inline-block; margin-top: 15px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
           Verify Email & Set Password
        </a>
        <p style="margin-top: 20px; color: #555;">If you didn’t create this account, you can safely ignore this email.</p>
        <p>Best,<br/>The Team</p>
      </div>
    `;

    await  sendEmail({
  to: email,
  subject: "Verify your email and set your password",
  html: htmlContent,
})


    return res.status(200).json({
      success: true,
      message: "Signup successful. Verification email sent.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(400).json({
      success: false,
      message: "Signup failed.",
      error: error.message,
    });
  }
});



app.post('/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and password are required.",
      });
    }

    const users = readUsers();
    const user = users.find((u) => u.verificationToken === token);
    

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    if (Date.now() > user.tokenExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "Token expired, please sign up again.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.verified = true;
    delete user.verificationToken;
    delete user.tokenExpiresAt;
    writeUsers(users);

    res.status(200).json({
      success: true,
      message: "Password set successfully.",
    });
  } catch (e) {
    return res.status(400).json({
      success: false,
      message: "Setting password failed.",
      error: e.message,
    });
  }
});


app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const users = readUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Email is not registered.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect password.",
      });
    }

    const payload = {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      phoneNumber: user.phoneNumber,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
    });
  } catch (e) {
    return res.status(400).json({
      success: false,
      message: "Login failed.",
      error: e.message,
    });
  }
});


app.get("/dashboard", (req, res) => {
  const token = req.headers.authorization;

  if (!token || !token.startsWith('Bearer ')) {
    return res.status(400).json({
      success: false,
      message: "Token not found.",
    });
  }

  const mainToken = token.split(" ")[1];

  try {
    const decoded = jwt.verify(mainToken, JWT_SECRET);
    res.json({
      success: true,
      message: "Welcome to your dashboard",
      user: decoded,
    });
  } catch (e) {
    return res.status(400).json({
      success: false,
       message: "Invalid or expired token.",
      error: e.message,
    });
  }
});

// ====== Start Server ======
app.listen(PORT, () => {
  console.log(` Auth server running at http://localhost:${PORT}`);
});
