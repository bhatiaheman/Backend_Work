import { Mongoose } from "mongoose";
import { ChatEventEnum } from "../../constants";
import { Chat } from "../../models/chat-app/chat.model";
import { Message } from "../../models/chat-app/message.model";
import { emitSocketEvent } from "../../socket/index.js";
import { ApiError } from "../../utils/ApiError.js";
import {  ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/AsyncHandler.js";


const chatMessageCommonAggregation = () => {

    return [
        {
            $lookup: {
                from: "users",
                foreignField: "_id",
                localField: "sender",
                as: "sender",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            email: 1
                        }
                    }
                ]
            }
        },

        {
            $addFields: {
                sender: { $first: "$sender"}
            },
        },
    ];
};


const getAllMessage = asyncHandler( async() => {

    // select messages by chatid
    // check the message is there or not in Chat database by id
    // if no chat found
    // if the user is not authenticated then access denied
    // if user authenticated then create a message pipeline to get all message
    // match with chat id and sort by createdAt
    // return the response


    const {chatId} = req.params;

    const selectedChat = await Chat.findById(chatId);

    if(!selectedChat){
        throw new ApiError(404, "Chat not found");
    }

    if(!selectedChat.participants.includes(req.user._id)){
        throw new ApiError(403, "Access denied");
    }

    const messages = await Message.aggregate(
        [
            {
                $match: {
                    chat: Mongoose.Types.ObjectId(chatId)
                },
            
            },

            ...chatMessageCommonAggregation(),

            {
                $sort: {
                    createdAt: -1
                }
            },
        ]
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200, messages || [],  "Get all messages successfully")
    )
    
})


const sendMessage = asyncHandler(async(req, res) => {

    // take the chat id and content 
    // check if the content is not attached or empty
    // check if there the chat exists of not by id
    //  
});