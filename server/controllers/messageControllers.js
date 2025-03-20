import Message from '../models/messageModel.js';
import User from '../models/userModel.js';
import Chat from '../models/chatModel.js';
import { huffmanEncode, huffmanDecode, applyQuantumEncryption, applyQuantumDecryption, bb84KeyExchange } from '../utils/quantumUtils.js';

const sharedKeys = new Map();

export const sendMessage = async (req, res) => {
  const { chatId, message } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ error: 'Chat ID and message are required' });
  }

  try {
    const { encodedBinary, tree } = huffmanEncode(message);
    if (!encodedBinary || !tree) {
      throw new Error('Huffman encoding failed');
    }

    const pairId = `${req.rootUserId}-${chatId}`;
    let sharedKey = sharedKeys.get(pairId);
    if (!sharedKey) {
      sharedKey = bb84KeyExchange();
      sharedKeys.set(pairId, sharedKey);
    }

    let encryptedMessage;
    try {
      encryptedMessage = await applyQuantumEncryption(encodedBinary, sharedKey);
    } catch (encryptionError) {
      console.error('Encryption failed, falling back to plaintext:', encryptionError.message);
      encryptedMessage = encodedBinary; // Fallback to unencrypted for now
    }

    if (!encryptedMessage) {
      throw new Error('Quantum encryption returned no result');
    }

    console.log('Saving to DB:', { sender: req.rootUserId, message, encryptedMessage, huffmanTree: tree, chatId });

    let msg = await Message.create({
      sender: req.rootUserId,
      message,
      encryptedMessage,
      huffmanTree: tree,
      chatId,
    });

    console.log('Saved Message:', msg);

    msg = await (
      await msg.populate('sender', 'name profilePic email')
    ).populate({
      path: 'chatId',
      select: 'chatName isGroup users',
      model: 'Chat',
      populate: {
        path: 'users',
        select: 'name email profilePic',
        model: 'User',
      },
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: msg });
    res.status(200).json(msg);
    return msg;
  } catch (error) {
    console.error('Error in sendMessage:', error.message);
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
};

export const getMessages = async (req, res) => {
  const { chatId } = req.params;
  try {
    console.log('Fetching messages for chatId:', chatId);
    let messages = await Message.find({ chatId })
      .populate({
        path: 'sender',
        model: 'User',
        select: 'name profilePic email',
      })
      .populate({
        path: 'chatId',
        model: 'Chat',
      });

    const pairId = `${req.rootUserId}-${chatId}`;
    const sharedKey = sharedKeys.get(pairId);
    if (!sharedKey) {
      console.warn('No shared key found for pairId:', pairId);
      return res.status(200).json(messages);
    }

    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const decryptedBinary = await applyQuantumDecryption(msg.encryptedMessage, sharedKey);
          const decryptedText = huffmanDecode(decryptedBinary, msg.huffmanTree);
          return { ...msg._doc, message: decryptedText };
        } catch (error) {
          console.error('Error decrypting message, returning original:', error.message);
          return { ...msg._doc }; // Fallback to stored message
        }
      })
    );

    console.log('Returning decrypted messages:', decryptedMessages);
    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.error('Error in getMessages:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
};