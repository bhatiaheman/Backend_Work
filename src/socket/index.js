import { Server } from "socket.io"
import { ChatEventEnum } from "../constants.js";
import { ApiError } from "../utils/ApiError.js"
import  cookie  from "cookie";
import { User} from "../models/user.model.js"
import jwt from "jsonwebtoken";



const mountJoinChatEvent = (socket) => {

    socket.on(ChatEventEnum.JOIN_CHAT_EVENT, (chatId) => {

        console.log(`User ${socket.id} joined chat ${chatId}`)

        socket.join(chatId);
    });
}

const mountParticipantTypingEvent = (socket) => {

    socket.on(ChatEventEnum.TYPING_EVENT, (chatId) => {
        socket.in(chatId).emit(ChatEventEnum.TYPING_EVENT, socket.id)
    })
}

const mountParticipantStopTypingEvent = (socket) => {

    socket.on(ChatEventEnum.STOP_TYPING_EVENT, (chatId) => {
        socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, socket.id)
    })
}


const initializeSocketIo = (io) => {
    // check for the token if available then initialize the socket
    // decode the jwt token 

    return io.on("connection", async (socket) => {

        try {
        
            const cookies = cookie.parse(socket.handshake.headers?.cookie || "")
    
            let token = cookies?.accessToken || "";
    
            if(!token) {
                token = socket.handshake.auth?.token;
            }
    
            if(!token) {
                throw new ApiError(401, "UnAuthorized handshake, no token provided")
            }
    
        
            const decodedToken = jwt.decode(token , process.env.ACCESS_TOKEN_SECRET);
    
            const user = await  User.findById(decodedToken?._id).select(
                "-password -refreshToken"
            );

            if(!user) {
                throw new ApiError(401, "UnAuthorized handshake, Token is invalid")
            }

            socket.user = user;

            socket.join(user._id.toString());
            socket.emit(ChatEventEnum.CONNECTED_EVENT);
            console.log("User connected 🗼. userId: ", user._id.toString());

            mountJoinChatEvent(socket);
            mountParticipantTypingEvent(socket);
            mountParticipantStopTypingEvent(socket);

            socket.on(ChatEventEnum.DISCONNECT_EVENT, () => {
                console.log("User disconnected 🗼. userId: " +  socket.user?._id);

                if (socket.user?._id) {
                    socket.leave(socket.user._id);
                }
            })
    
        } catch (error) {
            socket.emit(
                ChatEventEnum.SOCKET_ERROR_EVENT,
                error?.message || "Something went wrong while connecting to the socket."   
            )
        }

    });

}

const emitSocketEvent = (req, roomId, event, payload) => {
    req.app.get("io").in(roomId).emit(event, payload);
}

export { initializeSocketIo,
            emitSocketEvent }