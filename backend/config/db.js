// const mongoose = require('mongoose');

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGODB_URI);
//     console.log(`MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error(`MongoDB Connection Error: ${error.message}`);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;


const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log("FULL ERROR:");
    console.dir(error, { depth: null });

    if (error.reason?.servers) {
      for (const [host, server] of error.reason.servers) {
        console.log("\nHOST:", host);
        console.dir(server, { depth: null });
      }
    }

    process.exit(1);
  }
};

module.exports = connectDB;