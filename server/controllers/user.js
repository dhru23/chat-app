import user from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';

// Register a new user
export const register = async (req, res) => {
  const { firstname, lastname, email, password } = req.body;
  try {
    const existingUser = await user.findOne({ email });
    if (existingUser) {
      console.log(`User already exists: ${email}`);
      return res.status(400).json({ error: 'User already exists' });
    }
    const fullname = firstname + ' ' + lastname;
    const newUser = new user({ email, password, name: fullname });
    const token = await newUser.generateAuthToken();
    await newUser.save();
    console.log(`User registered: ${email}`);
    res.status(200).json({ message: 'success', token: token });
  } catch (error) {
    console.error('Error in register:', error.message);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// Login an existing user
export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const validUser = await user.findOne({ email });
    if (!validUser) {
      return res.status(400).json({ message: 'User does not exist' });
    }
    const validPassword = await bcrypt.compare(password, validUser.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = await validUser.generateAuthToken();
    await validUser.save();
    res.cookie('userToken', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
    res.status(200).json({ token, status: 200 });
  } catch (error) {
    console.error('Error in login:', error.message);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// Validate an authenticated user
export const validUser = async (req, res) => {
  try {
    const validUser = await user.findOne({ _id: req.rootUserId }).select('-password');
    if (!validUser) {
      return res.status(400).json({ message: 'User is not valid' });
    }
    res.status(200).json({
      user: validUser,
      token: req.token,
    });
  } catch (error) {
    console.error('Error in validUser:', error.message);
    res.status(500).json({ error: 'Server error during validation' });
  }
};

// Google OAuth authentication
export const googleAuth = async (req, res) => {
  try {
    const { tokenId } = req.body;
    const client = new OAuth2Client(process.env.CLIENT_ID);
    const verify = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.CLIENT_ID,
    });
    const { email_verified, email, name, picture } = verify.payload;
    if (!email_verified) {
      return res.status(400).json({ message: 'Email not verified' });
    }
    let userExist = await user.findOne({ email }).select('-password');
    if (userExist) {
      res.cookie('userToken', tokenId, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      });
      return res.status(200).json({ token: tokenId, user: userExist });
    }
    const password = email + process.env.CLIENT_ID; // Simple password generation
    const newUser = new user({
      name,
      profilePic: picture,
      password,
      email,
    });
    await newUser.save();
    res.cookie('userToken', tokenId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.status(200).json({ message: 'User registered successfully', token: tokenId });
  } catch (error) {
    console.error('Error in googleAuth:', error.message);
    res.status(500).json({ error: 'Server error during Google auth' });
  }
};

// Logout (currently incomplete)
export const logout = async (req, res) => {
  try {
    req.rootUser.tokens = req.rootUser.tokens.filter((e) => e.token !== req.token);
    await req.rootUser.save();
    res.clearCookie('userToken');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logout:', error.message);
    res.status(500).json({ error: 'Server error during logout' });
  }
};

// Search users
export const searchUsers = async (req, res) => {
  try {
    const search = req.query.search
      ? {
          $or: [
            { name: { $regex: req.query.search, $options: 'i' } },
            { email: { $regex: req.query.search, $options: 'i' } },
          ],
        }
      : {};
    const users = await user.find(search).find({ _id: { $ne: req.rootUserId } }).select('-password');
    res.status(200).json(users);
  } catch (error) {
    console.error('Error in searchUsers:', error.message);
    res.status(500).json({ error: 'Server error during user search' });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const selectedUser = await user.findOne({ _id: id }).select('-password');
    if (!selectedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(selectedUser);
  } catch (error) {
    console.error('Error in getUserById:', error.message);
    res.status(500).json({ error: 'Server error retrieving user' });
  }
};

// Update user info
export const updateInfo = async (req, res) => {
  const { id } = req.params;
  const { bio, name } = req.body;
  try {
    const updatedUser = await user.findByIdAndUpdate(id, { name, bio }, { new: true }).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error in updateInfo:', error.message);
    res.status(500).json({ error: 'Server error updating user info' });
  }
};