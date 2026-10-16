const User = require('../models/User');

// @desc    Get all users (with optional filtering)
// @route   GET /api/users
// @access  Private (Admin & Manager)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, search, team } = req.query;
    const filter = {};

    if (role) {
      filter.role = role;
    }
    if (team) {
      filter.teams = team;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('teams', 'name')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('teams', 'name description');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/users/:id/role
// @access  Private (Admin only)
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['Admin', 'Manager', 'Employee'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified. Allowed roles: Admin, Manager, Employee.',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserRole,
};
