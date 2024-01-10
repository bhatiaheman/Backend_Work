import connectDb from './db/index.js';
import dotenv from 'dotenv';
import { httpServer } from './app.js';

dotenv.config({
    path: './.env'
});
 

connectDb()


const startServer = () => {
    httpServer.listen(process.env.PORT || 8000, () => {
        console.log("⚙️  Server is running on port: " + process.env.PORT);
    })
}

startServer();








