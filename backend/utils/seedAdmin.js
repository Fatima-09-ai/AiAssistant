/**
 * Promotes an existing user to admin by email. There's no UI for this by
 * design — the first admin has to be granted deliberately, not by a signup
 * checkbox anyone could tick.
 *
 * Usage:
 *   cd backend
 *   node utils/seedAdmin.js your-email@example.com
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node utils/seedAdmin.js <email>");
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`No user found with email "${email}"`);
    process.exit(1);
  }

  if (user.role === "admin") {
    console.log(`${user.email} is already an admin.`);
  } else {
    user.role = "admin";
    await user.save();
    console.log(`${user.email} is now an admin. Log out and back in to pick up the new role.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
