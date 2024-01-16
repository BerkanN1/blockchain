const express = require('express');
const crypto = require('crypto');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const app = express();
dotenv.config();
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define User schema and model
const userSchema = new mongoose.Schema({
  username:{ type: String, required: true, unique: true },
  password: String,
});

const User = mongoose.model('User', userSchema);

// Define Message schema and model
const messageSchema = new mongoose.Schema({
  sender: String,
  recipient: String,
  message: String,
  timestamp: Number,
});

const Message = mongoose.model('Message', messageSchema);

// WebSocket server setup
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const { userId, recipient, content } = JSON.parse(message);

    try {
      const sender = await User.findById(userId);
      if (!sender) {
        return ws.send(JSON.stringify({ error: 'Invalid user ID' }));
      }

      const encryptedMessage = encryptMessage(content);

      const block = new Message({
        sender: sender.username,
        recipient,
        message: encryptedMessage,
        timestamp: new Date().getTime(),
      });

      await block.save();

      wss.clients.forEach((client) => {
        if (client !== ws) {
          client.send(JSON.stringify({ type: 'message', block }));
        }
      });
    } catch (error) {
      console.error(error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const userId = crypto.randomBytes(16).toString('hex');
    const user = new User({ username, password });
    await user.save();

    res.json({ message: 'User registered successfully', userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful', userId: user._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
//Update password
app.post('/update-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  try {
    // Find the user by username
    const user = await User.findOne({ username });

    // Check if the user exists
    if (!user) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    // Check if the current password provided matches the stored password
    if (user.password !== currentPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update the password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/send', async (req, res) => {
  const { userId, recipient, message } = req.body;

  try {
    const sender = await User.findById(userId);
    if (!sender) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const encryptedMessage = encryptMessage(message);

    const block = new Message({
      sender: sender.username,
      recipient,
      message: encryptedMessage,
      timestamp: new Date().getTime(),
    });

    await block.save();

    res.json({ message: 'Message sent successfully', block });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
//
app.get('/user/messages/:recipient', async (req, res) => {
  try {
    const recipient = req.params.recipient;

    // Find messages where the user is the recipient
    const messages = await Message.find({ recipient });

    res.json({ messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/chat', async (req, res) => {
  try {
    const blockchain = await Message.find();
    res.json({ blockchain });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


//Get all Users
app.get('/user',async(req,res) => {
  try {
    const users = await User.find();
    res.json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
  
});
//Get all messages of a user
app.get('/user/:username',async(req,res) => {
  try {
    const messages = await Message.find({sender: req.params.username});
    res.json({ messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
//Get all messages 2 users sent to each other
app.get('/user/:username/:recipient',async(req,res) => {
  try {
    const messages = await Message.find({sender: req.params.username, recipient: req.params.recipient});
    res.json({ messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
//Get messages between two users and decrypt 
app.get('/chat/:username/:recipient', async (req, res) => {
  try {
    const blockchain = await Message.find({sender: req.params.username, recipient: req.params.recipient});
    const messages = blockchain.map((block) => {
      const decryptedMessage = decryptMessage(block.message);
      return {
        _id: block._id,
        sender: block.sender,
        recipient: block.recipient,
        message: decryptedMessage,
        timestamp: block.timestamp,
        
      };
    });
    res.json({ messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
function encryptMessage(message) {
    const key = crypto.randomBytes(16);
    const encrypted = Buffer.from(
      message
        .split('')
        .map((char, index) => char.charCodeAt() ^ key[index % 16])
    );
  
    return JSON.stringify({
      message: encrypted.toString('hex'),
      key: key.toString('hex'),
    });
  }
  
  //Decrypt message func
  function decryptMessage(message) {
    const { message: encryptedMessage, key } = JSON.parse(message);
    const encryptedBytes = Buffer.from(encryptedMessage, 'hex');
    const keyBytes = Buffer.from(key, 'hex');

    const decrypted = Buffer.alloc(encryptedBytes.length);

    for (let i = 0; i < encryptedBytes.length; i++) {
        decrypted[i] = encryptedBytes[i] ^ keyBytes[i % 16];
    }

    return decrypted.toString();
}

// Use the WebSocket server with the Express app
app.server = app.listen(3000, () => {
  console.log('Server running on port 3000');
});

app.server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});
