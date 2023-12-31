import mongoose from 'mongoose';
import {DB_NAME} from '../constants.js';

const connectDb = async () => {
    try {
        const connection = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MongoDB Connected !! DB Host ${connection.connection.host}`)
        
    } catch (error) {
        console.log("MongoDB connection errro ", error);
        process.exit(1);
    }
}

export default connectDb;