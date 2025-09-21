// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ---- helpers ---------------------------------------------------------------

function requireJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  return process.env.JWT_SECRET;
}

function generateToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, requireJwtSecret(), { expiresIn });
}

// Remove sensitive/internal fields before sending to client
function sanitizeUser(userDoc) {
  if (!userDoc) return userDoc;
  const u = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete u.password;
  delete u.__v;
  return u;
}

// Single auth middleware (removed duplicate)
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, requireJwtSecret());
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};

// ---- routes ----------------------------------------------------------------

// Get all users (searchable)
router.get('/', auth, async (req, res) => {
  try {
    const { search, role, grade, section } = req.query;
    let query = {};
    
    // Role filter
    if (role) {
      query.role = role;
    }
    
    // Grade and section filters
    if (grade) {
      query.grade = grade;
    }
    if (section) {
      query.section = section;
    }
    
    // Search filter
    if (search) {
      const rx = { $regex: search, $options: 'i' };
      const searchQuery = {
        $or: [
          { name: rx }, 
          { email: rx }, 
          { username: rx }, 
          { mobile: rx }, // Added mobile number search
          { role: rx },
          { grade: rx },
          { section: rx },
          { subject: rx },
          { parent: rx }
        ],
      };
      
      // Combine role/grade/section filters with search
      if (role || grade || section) {
        query = { $and: [query, searchQuery] };
      } else {
        query = searchQuery;
      }
    }

    // Use populate to include parent information
    const users = await User.find(query).populate('parent', 'name email').lean();
    
    const safe = users.map(u => {
      delete u.password;
      delete u.__v;
      return u;
    });
    
    return res.json(safe);
  } catch (err) {
    console.error("Users fetch error:", err);
    return res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// Get children for a parent user
router.get('/children', auth, async (req, res) => {
  try {
    const parentUserId = req.user.id;
    
    // First, let's verify the parent user exists and is a parent
    const parentUser = await User.findById(parentUserId);
    
    if (!parentUser) {
      return res.status(404).json({ msg: 'Parent user not found' });
    }
    
    if (parentUser.role !== 'Parent') {
      return res.json([]); // Return empty array for non-parents
    }
    
    // Find all students where parent field references this user
    const children = await User.find({ 
      role: 'Student', 
      parent: parentUserId 
    }).populate('parent', 'name email').lean();
    
    // Format children data for frontend
    const formattedChildren = children.map(child => ({
      id: child._id,
      name: child.name,
      grade: child.grade,
      section: child.section,
      class: child.grade && child.section ? `${child.grade}${child.section}` : '',
      email: child.email,
      mobile: child.mobile
    }));
    
    res.json(formattedChildren);
  } catch (err) {
    console.error("Get children error:", err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// Get parent profile with children
router.get('/parent/profile', auth, async (req, res) => {
  try {
    const parentUserId = req.user.id;
    
    // Get parent user info
    const parent = await User.findById(parentUserId).lean();
    if (!parent || parent.role !== 'Parent') {
      return res.status(404).json({ msg: 'Parent not found' });
    }
    
    // Find all children
    const children = await User.find({ 
      role: 'Student', 
      parent: parentUserId 
    }).lean();
    
    // Format response
    const response = {
      parent: {
        id: parent._id,
        name: parent.name,
        email: parent.email,
        mobile: parent.mobile,
        role: parent.role
      },
      children: children.map(child => ({
        id: child._id,
        name: child.name,
        grade: child.grade,
        section: child.section,
        class: child.grade && child.section ? `${child.grade}${child.section}` : '',
        email: child.email,
        mobile: child.mobile
      }))
    };
    
    res.json(response);
  } catch (err) {
    console.error("Get parent profile error:", err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// Assign parent to student
router.put('/assign-parent/:studentId', auth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { parentId } = req.body;
    
    // Validate student exists and is a student
    const student = await User.findById(studentId);
    if (!student || student.role !== 'Student') {
      return res.status(404).json({ msg: 'Student not found' });
    }
    
    // Validate parent exists and is a parent (if parentId provided)
    if (parentId) {
      const parent = await User.findById(parentId);
      if (!parent || parent.role !== 'Parent') {
        return res.status(404).json({ msg: 'Parent not found' });
      }
    }
    
    // Update student's parent field
    student.parent = parentId || null;
    await student.save();
    
    // Return updated student with populated parent info
    const updatedStudent = await User.findById(studentId).populate('parent', 'name email').lean();
    
    res.json({
      msg: 'Parent assigned successfully',
      student: {
        id: updatedStudent._id,
        name: updatedStudent.name,
        grade: updatedStudent.grade,
        section: updatedStudent.section,
        email: updatedStudent.email,
        parent: updatedStudent.parent
      }
    });
  } catch (err) {
    console.error("Assign parent error:", err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password, mobile, profileImage, role, grade, section, parent, subject } = req.body;

    // Basic validation
    if (!name || !username || !email || !password) {
      return res.status(400).json({ msg: 'name, username, email, and password are required' });
    }

    const userWithEmail = await User.findOne({ email });
    if (userWithEmail) {
      return res.status(400).json({ msg: 'User with this email already exists' });
    }

    const userWithUsername = await User.findOne({ username });
    if (userWithUsername) {
      return res.status(400).json({ msg: 'Username is already taken' });
    }

    let user = new User({
      name,
      username,
      email,
      password,
      mobile,
      profileImage,
      role,
      grade,
      section,
      parent,
      subject,
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const payload = { user: { id: user.id, role: user.role } };
    const token = generateToken(payload);

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

// Login (step 1): get profile image by username
router.post('/login-step-one', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ msg: 'Username is required' });

    const user = await User.findOne({ username }).select('profileImage');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    return res.json({ profileImage: user.profileImage || null });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

// Login (step 2): verify credentials -> token
router.post('/login-step-two', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ msg: 'Username and password are required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const payload = { user: { id: user.id, role: user.role } };
    const token = generateToken(payload);

    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

// Update profile (authenticated)
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, profileImage, name, mobile } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({ msg: 'Username already taken' });
      }
      user.username = username;
    }

    if (typeof name === 'string') user.name = name;
    if (typeof mobile === 'string') user.mobile = mobile;
    if (typeof profileImage === 'string') user.profileImage = profileImage;

    await user.save();
    return res.json(sanitizeUser(user));
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

// Get own profile (authenticated)
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    return res.json(sanitizeUser(user));
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

// Verify if email exists
router.post('/verify-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email is required' });

    const user = await User.findOne({ email }).select('_id');
    if (!user) return res.status(404).json({ msg: 'Email not found' });

    return res.json({ msg: 'Email exists' });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

// Password reset (INSECURE: username/email-only; prefer token-based flow)
// TODO: Replace with a two-step flow (issue reset token via email, then verify token)
router.post('/reset-password', async (req, res) => {
  try {
    const { username, email, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ msg: 'New password is required' });

    let user = null;
    if (email) user = await User.findOne({ email });
    else if (username) user = await User.findOne({ username });

    if (!user) return res.status(404).json({ msg: 'User not found' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.json({ msg: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

// Change password (authenticated)
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'currentPassword and newPassword are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

// Delete account (authenticated)
router.delete('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('_id');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    await User.findByIdAndDelete(req.user.id);
    return res.json({ msg: 'Account deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

// Admin: Update any user by ID (authenticated, admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if the requesting user has admin role
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser || requestingUser.role !== 'Admin') {
      return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }

    const { name, username, email, role, mobile, password, grade, section, parent, subject } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Check if username is being changed and is already taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({ msg: 'Username already taken' });
      }
      user.username = username;
    }

    // Check if email is being changed and is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({ msg: 'Email already exists' });
      }
      user.email = email;
    }

    // Update other fields
    if (typeof name === 'string') user.name = name;
    if (typeof role === 'string') user.role = role;
    if (typeof mobile === 'string') user.mobile = mobile;
    
    // Update student-specific fields
    if (typeof grade === 'string') user.grade = grade;
    if (typeof section === 'string') user.section = section;
    if (parent) {
      // Validate that parent exists and has 'Parent' role
      const parentUser = await User.findById(parent);
      if (!parentUser) {
        return res.status(400).json({ msg: 'Parent user not found' });
      }
      if (parentUser.role !== 'Parent') {
        return res.status(400).json({ msg: 'Selected user is not a parent' });
      }
      user.parent = parent;
    } else if (parent === null || parent === '') {
      user.parent = undefined;
    }
    
    // Update teacher-specific fields
    if (typeof subject === 'string') {
      user.subject = subject;
    } else if (subject === null || subject === '') {
      user.subject = undefined;
    }

    // Update password if provided
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();
    return res.json(sanitizeUser(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

// Admin: Delete any user by ID (authenticated, admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if the requesting user has admin role
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser || requestingUser.role !== 'Admin') {
      return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }

    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ msg: 'Cannot delete your own account' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    await User.findByIdAndDelete(userId);
    return res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
