import express from 'express';
import dotenv from 'dotenv/config';
import mongoDBConnect from './mongoDB/connection.js';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';
import messageRoutes from './routes/message.js';
import * as Server from 'socket.io';
import axios from 'axios';

const app = express();

const allowedOrigins = process.env.BASE_URL.split(',');

const corsConfig = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const PORT = process.env.PORT || 8000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors(corsConfig));

app.use('/', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);

async function checkFlaskServer() {
  try {
    console.log('Checking Flask server at:', process.env.FLASK_SERVER_URL);
    const response = await axios.post(
      `${process.env.FLASK_SERVER_URL}/encrypt`,
      { binary: "01", shared_key: "11101" },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    console.log('Flask server is reachable:', response.data);
  } catch (error) {
    console.error('Flask server not reachable:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.response) console.error('Flask response:', error.response.data);
  }
}

mongoose.set('strictQuery', false);
mongoDBConnect()
  .then(() => {
    checkFlaskServer();
  })
  .catch((error) => {
    console.error('Failed to start server due to MongoDB connection error:', error.message);
    process.exit(1);
  });

const server = app.listen(PORT, () => {
  console.log(`Server Listening at PORT - ${PORT}`);
});

const io = new Server.Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: '*',
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('setup', (userData) => {
    socket.join(userData.id);
    socket.emit('connected');
    console.log(`User ${userData.id} joined room`);
  });

  socket.on('join room', (room) => {
    socket.join(room);
    console.log(`Socket joined room: ${room}`);
  });

  socket.on('typing', (room) => socket.in(room).emit('typing'));
  socket.on('stop typing', (room) => socket.in(room).emit('stop typing'));

  socket.on('new message', (newMessageRecieved) => {
    if (!newMessageRecieved || !newMessageRecieved.chatId) {
      console.error('Invalid message received:', newMessageRecieved);
      return;
    }

    const chatId = newMessageRecieved.chatId._id || newMessageRecieved.chatId;
    console.log('New message received for chat:', chatId);

    const senderId = newMessageRecieved.sender._id;
    const chatUsers = newMessageRecieved.chatId.users || [];
    chatUsers.forEach((user) => {
      if (user._id && user._id.toString() !== senderId) {
        socket.to(user._id.toString()).emit('message received', newMessageRecieved);
        console.log(`Emitted message to user: ${user._id}`);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});