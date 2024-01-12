import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer}  from "http";
import { Server } from "socket.io";


const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
    pingTimeout: 60000,
    cors: {
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }
});

app.set("io", io);

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({
    limit: "20kb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "20kb"
}));

app.use(express.static("public"));

app.use(cookieParser());


import userRouter from "./routes/user.routes.js";
import  chatRouter  from "./routes/chat-app/chat.routes.js";
import  messageRouter  from "./routes/chat-app/message.routes.js";
import  {initializeSocketIo}  from "./socket/index.js";


app.use("/api/v1/users", userRouter);

app.use("/api/v1/chat-app/chats", chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);


initializeSocketIo(io);








export { httpServer }